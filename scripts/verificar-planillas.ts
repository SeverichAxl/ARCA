/**
 * Verificación de HU-21/HU-24 contra la BD real.
 * Ejecutar solo en una base de desarrollo/QA con las migraciones aplicadas.
 *
 * El script reserva los periodos 2000-01 y 2000-02: si ya existen planillas
 * o parámetros con la vigencia de prueba, aborta sin modificar datos.
 * Al terminar limpia únicamente IDs aleatorios creados durante esta ejecución.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../services/ms-planillas/prisma/generated/client';
import { toCents } from '../services/ms-planillas/src/domain/common/money';
import {
  ESCALA_ANTIGUEDAD_INICIAL,
  PARAMETROS_INICIALES,
} from '../services/ms-planillas/src/domain/nomina/parametros-iniciales';
import type {
  Actor,
  EmpleadosNominaPort,
} from '../services/ms-planillas/src/domain/planillas/planilla.models';
import { mapDomainError } from '../services/ms-planillas/src/application/planillas/domain-error.interceptor';
import { PlanillasService } from '../services/ms-planillas/src/application/planillas/planillas.service';
import { PrismaPlanillaRepository } from '../services/ms-planillas/src/infrastructure/prisma/repositories/prisma-planilla.repository';

const PERIODO = '2000-01';
const PERIODO_SIGUIENTE = '2000-02';
const PERIODOS_PRUEBA = [PERIODO, PERIODO_SIGUIENTE];
const LIMITE_MS = 30_000;
const VIGENCIA_PRUEBA = '2000-01-01';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name} en .env.`);
  return value;
}

function hostDatabaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.hostname === 'postgres') {
    url.hostname = '127.0.0.1';
    url.port = process.env.POSTGRES_PORT ?? '5432';
  }
  if (url.pathname !== '/db_planillas') {
    throw new Error('La verificación solo puede ejecutarse contra db_planillas.');
  }
  return url;
}

const testIds = Array.from({ length: 200 }, () => randomUUID());
const actorId = randomUUID();
const parametroIds = PARAMETROS_INICIALES.map(() => randomUUID());
const escalaIds = ESCALA_ANTIGUEDAD_INICIAL.map(() => randomUUID());
const employeeId = (index: number) => testIds[index];

const app = new PrismaClient({ datasourceUrl: hostDatabaseUrl(required('PLANILLAS_DATABASE_URL')).toString() });
const owner = new PrismaClient({
  datasourceUrl: hostDatabaseUrl(required('PLANILLAS_DIRECT_URL')).toString(),
});

const ACTOR: Actor = {
  userId: actorId,
  empleadoId: null,
  rol: 'ENCARGADO_NOMINA',
  permisos: ['personal:read', 'personal:read_salary', 'planilla:calculate', 'planilla:close'],
};

const empleados = Array.from({ length: 200 }, (_, i) => ({
  empleadoId: employeeId(i),
  nombreCompleto: `Verificación ${String(i).padStart(3, '0')}`,
  ciEnmascarado: `***${1000 + i}`,
  areaId: randomUUID(),
  cargoId: randomUUID(),
  fechaIngreso: `${1975 + (i % 24)}-0${(i % 9) + 1}-1${i % 9}`,
  haberBasico: toCents(`${3300 + i * 211}.${String(i % 100).padStart(2, '0')}`),
}));

const personal: EmpleadosNominaPort = { listarActivos: async () => empleados };
const service = new PlanillasService(
  new PrismaPlanillaRepository(app),
  personal,
  { now: () => new Date() },
);

const planillaIds = new Set<string>();
let parametrosCreados = false;
let fallos = 0;

function check(condicion: boolean, mensaje: string): void {
  console.log(`${condicion ? '  ✔' : '  ✘'} ${mensaje}`);
  if (!condicion) fallos += 1;
}

async function codigo(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
    return 'SIN_ERROR';
  } catch (error) {
    const body = mapDomainError(error)?.getResponse() as { code?: string } | undefined;
    return body?.code ?? (error instanceof Error ? error.message.slice(0, 80) : String(error));
  }
}

async function bloqueadoEnBd(operacion: () => Promise<unknown>): Promise<string> {
  try {
    await operacion();
    return 'PERMITIDO';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('PLAN_INMUTABLE')) return 'PLAN_INMUTABLE';
    if (message.includes('permission denied')) return 'SIN_PRIVILEGIO';
    return message.slice(0, 80);
  }
}

async function comprobarBaseLimpia(): Promise<void> {
  const existentes = await app.planilla.findMany({
    where: { periodo: { in: PERIODOS_PRUEBA } },
    select: { periodo: true },
  });
  if (existentes.length > 0) {
    throw new Error(
      `Verificación cancelada: ya hay planillas en los periodos reservados ${PERIODOS_PRUEBA.join(', ')}.`,
    );
  }
  const parametrosExistentes = await app.parametroLegal.count({
    where: { vigenteDesde: new Date(`${VIGENCIA_PRUEBA}T00:00:00.000Z`) },
  });
  const escalasExistentes = await app.escalaAntiguedad.count({
    where: { vigenteDesde: new Date(`${VIGENCIA_PRUEBA}T00:00:00.000Z`) },
  });
  if (parametrosExistentes > 0 || escalasExistentes > 0) {
    throw new Error(
      `Verificación cancelada: ya existen parámetros o escalas con vigencia ${VIGENCIA_PRUEBA}.`,
    );
  }
}

async function limpiar(): Promise<void> {
  if (planillaIds.size > 0) {
    await owner.$transaction(async (tx) => {
      await tx.$executeRaw`ALTER TABLE planilla DISABLE TRIGGER planilla_proteger_cerrada`;
      await tx.$executeRaw`ALTER TABLE planilla_detalle DISABLE TRIGGER planilla_detalle_proteger`;
      await tx.planilla.deleteMany({
        where: { id: { in: [...planillaIds] }, calculadoPor: actorId },
      });
      await tx.$executeRaw`ALTER TABLE planilla_detalle ENABLE TRIGGER planilla_detalle_proteger`;
      await tx.$executeRaw`ALTER TABLE planilla ENABLE TRIGGER planilla_proteger_cerrada`;
    });
  }

  await owner.novedadPlanilla.deleteMany({
    where: { periodo: { in: PERIODOS_PRUEBA }, empleadoId: { in: testIds } },
  });
  if (parametrosCreados) {
    await owner.$transaction([
      owner.parametroLegal.deleteMany({ where: { id: { in: parametroIds } } }),
      owner.escalaAntiguedad.deleteMany({ where: { id: { in: escalaIds } } }),
    ]);
  }
}

async function main(): Promise<void> {
  await comprobarBaseLimpia();

  console.log('Parámetros legales persistidos (vigencia de prueba 2000-01-01)');
  const vigenteDesde = new Date(`${VIGENCIA_PRUEBA}T00:00:00.000Z`);
  parametrosCreados = true;
  await app.parametroLegal.createMany({
    data: PARAMETROS_INICIALES.map((parametro, index) => ({
      id: parametroIds[index],
      clave: parametro.clave,
      valor: parametro.valor,
      vigenteDesde,
    })),
  });
  await app.escalaAntiguedad.createMany({
    data: ESCALA_ANTIGUEDAD_INICIAL.map((tramo, index) => ({
      ...tramo,
      id: escalaIds[index],
      vigenteDesde,
    })),
  });
  const vigentes = await service.parametrosVigentes(`${PERIODO}-31`);
  check(
    vigentes.smn === '3300.00',
    `el motor lee de BD: SMN ${vigentes.smn}, aporte ${vigentes.aporteLaboralPct} %`,
  );

  console.log('Ejecución de 200 funcionarios');
  await service.registrarNovedad(PERIODO, employeeId(0), { rcIvaComputable: '20000.00' }, ACTOR);
  const inicio = Date.now();
  const calculada = await service.calcular(PERIODO, ACTOR);
  planillaIds.add(calculada.planilla.id);
  const ms = Date.now() - inicio;
  check(calculada.planilla.totalEmpleados === 200, '200 detalles persistidos');
  check(ms < LIMITE_MS, `duración ${ms} ms (< ${LIMITE_MS} ms)`);
  const detalle = await service.listarDetalle(calculada.planilla.id, { page: 1, pageSize: 200 });
  const suma = detalle.data.reduce((total, fila) => total + toCents(fila.liquidoPagable), 0n);
  check(
    suma === toCents(calculada.planilla.totales.liquidoPagable),
    'Σ líquidos del detalle = total de la cabecera',
  );

  console.log('Concurrencia');
  const [a, b] = await Promise.all([
    service.calcular(PERIODO, ACTOR),
    service.calcular(PERIODO, ACTOR),
  ]);
  planillaIds.add(a.planilla.id);
  planillaIds.add(b.planilla.id);
  const cabeceras = await app.planilla.count({ where: { periodo: PERIODO } });
  const filas = await app.planillaDetalle.count({ where: { planillaId: a.planilla.id } });
  check(
    cabeceras === 1 && filas === 200 && a.planilla.id === b.planilla.id,
    'cálculos simultáneos sin duplicados',
  );

  console.log('Cierre');
  const cierres = await Promise.allSettled([
    service.cerrar(a.planilla.id, ACTOR),
    service.cerrar(a.planilla.id, ACTOR),
  ]);
  check(cierres.filter((cierre) => cierre.status === 'fulfilled').length === 1, 'un solo cierre concurrente prospera');
  check(
    (await codigo(service.cerrar(a.planilla.id, ACTOR))) === 'PLAN_CERRADA',
    'doble cierre -> PLAN_CERRADA',
  );

  console.log('Inmutabilidad (servicio)');
  check(
    (await codigo(service.calcular(PERIODO, ACTOR))) === 'PLAN_CERRADA',
    'recalcular -> PLAN_CERRADA',
  );
  check(
    (await codigo(service.eliminarBorrador(a.planilla.id))) === 'PLAN_CERRADA',
    'eliminar -> PLAN_CERRADA',
  );

  console.log('Inmutabilidad (BD con el rol de runtime)');
  const intentos: Array<[string, () => Promise<unknown>]> = [
    [
      'UPDATE planilla',
      () => app.planilla.update({ where: { id: a.planilla.id }, data: { totalLiquido: '1' } }),
    ],
    ['DELETE planilla', () => app.planilla.delete({ where: { id: a.planilla.id } })],
    [
      'UPDATE detalle',
      () =>
        app.planillaDetalle.updateMany({
          where: { planillaId: a.planilla.id },
          data: { liquidoPagable: '0' },
        }),
    ],
    [
      'DELETE detalle',
      () => app.planillaDetalle.deleteMany({ where: { planillaId: a.planilla.id } }),
    ],
    [
      'UPDATE novedad',
      () =>
        app.novedadPlanilla.updateMany({
          where: { periodo: PERIODO, empleadoId: { in: testIds } },
          data: { otrosIngresos: '1' },
        }),
    ],
    ['TRUNCATE detalle', () => app.$executeRawUnsafe('TRUNCATE planilla_detalle')],
    [
      'RETENCION_ANIOS=5',
      () =>
        app.configuracionPlanillas.update({
          where: { clave: 'RETENCION_ANIOS' },
          data: { valor: '5' },
        }),
    ],
  ];
  for (const [etiqueta, operacion] of intentos) {
    const resultado = await bloqueadoEnBd(operacion);
    check(resultado !== 'PERMITIDO', `${etiqueta} -> ${resultado}`);
  }
  check(
    (await app.planillaDetalle.count({ where: { planillaId: a.planilla.id } })) === 200,
    'el historial sigue intacto',
  );

  console.log('Saldo RC-IVA y autoconsulta');
  const siguiente = await service.calcular(PERIODO_SIGUIENTE, ACTOR);
  planillaIds.add(siguiente.planilla.id);
  const enero = await service.obtenerDetalleEmpleado(a.planilla.id, employeeId(0));
  const febrero = await service.obtenerDetalleEmpleado(siguiente.planilla.id, employeeId(0));
  check(
    febrero.rcIvaDetalle.saldoAnterior === enero.rcIvaDetalle.saldoSiguiente,
    `saldo RC-IVA arrastrado ${febrero.rcIvaDetalle.saldoAnterior}`,
  );
  const yo: Actor = {
    userId: actorId,
    empleadoId: employeeId(4),
    rol: 'FUNCIONARIO',
    permisos: ['boleta:read_own'],
  };
  check(
    (await codigo(service.miPago(yo, PERIODO_SIGUIENTE))) === 'NOT_FOUND',
    'un BORRADOR no es visible en autoconsulta',
  );
  check(
    (await service.miPago(yo, PERIODO)).empleado.empleadoId === employeeId(4),
    'autoconsulta devuelve el pago propio cerrado',
  );
}

main()
  .catch((error) => {
    console.error(error);
    fallos += 1;
  })
  .finally(async () => {
    await limpiar().catch((error) => {
      console.error('No se pudo limpiar únicamente los fixtures de esta ejecución:', error);
      fallos += 1;
    });
    await Promise.all([app.$disconnect(), owner.$disconnect()]);
    console.log(
      fallos === 0
        ? '\nVerificación de planillas: OK'
        : `\nVerificación de planillas: ${fallos} fallo(s)`,
    );
    process.exitCode = fallos === 0 ? 0 : 1;
  });
