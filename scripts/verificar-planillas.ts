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
import { PARAMETROS_INICIALES } from '../services/ms-planillas/src/domain/nomina/parametros-iniciales';
import type {
  Actor,
  EmpleadosNominaPort,
} from '../services/ms-planillas/src/domain/planillas/planilla.models';
import { mapDomainError } from '../services/ms-planillas/src/application/planillas/domain-error.interceptor';
import { PlanillasService } from '../services/ms-planillas/src/application/planillas/planillas.service';
import { PrismaPlanillaRepository } from '../services/ms-planillas/src/infrastructure/prisma/repositories/prisma-planilla.repository';
import type { PrismaService } from '../services/ms-planillas/src/infrastructure/prisma/prisma.service';

const PERIODO = '2000-01';
const PERIODO_SIGUIENTE = '2000-02';
const PERIODOS_PRUEBA = [PERIODO, PERIODO_SIGUIENTE];
const LIMITE_MS = 30_000;
const VIGENCIA_PRUEBA = '2000-01-01';
const VIGENCIA_PRUEBA_FIN = '2000-12-31';

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
const employeeId = (index: number) => testIds[index];

const app = new PrismaClient({
  datasourceUrl: hostDatabaseUrl(required('PLANILLAS_DATABASE_URL')).toString(),
});
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
  new PrismaPlanillaRepository(app as unknown as PrismaService),
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
  const existentes = await app.planillaMensual.findMany({
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
  if (parametrosExistentes > 0) {
    throw new Error(
      `Verificación cancelada: ya existen parámetros con vigencia ${VIGENCIA_PRUEBA}.`,
    );
  }
}

async function limpiar(): Promise<void> {
  if (planillaIds.size > 0) {
    // DISABLE TRIGGER USER cubre también el refuerzo opcional de migrations-extra.
    // Dentro de la transacción: si algo falla, los triggers vuelven a su estado.
    await owner.$transaction(async (tx) => {
      await tx.$executeRaw`ALTER TABLE planilla_mensual DISABLE TRIGGER USER`;
      await tx.$executeRaw`ALTER TABLE planilla_detalle DISABLE TRIGGER USER`;
      const ids = { in: [...planillaIds] };
      await tx.planillaDetalle.deleteMany({ where: { planillaId: ids } });
      await tx.planillaMensual.deleteMany({ where: { id: ids, procesadaPor: actorId } });
      await tx.$executeRaw`ALTER TABLE planilla_detalle ENABLE TRIGGER USER`;
      await tx.$executeRaw`ALTER TABLE planilla_mensual ENABLE TRIGGER USER`;
    });
  }

  await owner.novedadPlanilla.deleteMany({
    where: { periodo: { in: PERIODOS_PRUEBA }, empleadoId: { in: testIds } },
  });
  if (parametrosCreados) {
    await owner.parametroLegal.deleteMany({ where: { id: { in: parametroIds } } });
  }
}

async function main(): Promise<void> {
  await comprobarBaseLimpia();

  console.log('Parámetros legales persistidos (vigencia de prueba 2000-01-01 a 2000-12-31)');
  const vigenteDesde = new Date(`${VIGENCIA_PRUEBA}T00:00:00.000Z`);
  const vigenteHasta = new Date(`${VIGENCIA_PRUEBA_FIN}T00:00:00.000Z`);
  parametrosCreados = true;
  await app.parametroLegal.createMany({
    data: PARAMETROS_INICIALES.map((parametro, index) => ({
      id: parametroIds[index],
      tipo: parametro.tipo,
      clave: parametro.clave,
      valor: parametro.valor,
      unidad: parametro.unidad,
      ...(parametro.metadata ? { metadata: parametro.metadata as never } : {}),
      vigenteDesde,
      vigenteHasta,
      activo: true,
      creadoPor: actorId,
    })),
  });
  const vigentes = await service.parametrosVigentes(`${PERIODO}-31`);
  check(
    vigentes.smn === '3300.00',
    `el motor lee de BD: SMN ${vigentes.smn}, aporte ${vigentes.aporteLaboralPct} %`,
  );

  console.log('Procesamiento asíncrono de 200 funcionarios (contrato: 202 EN_PROCESO)');
  await service.registrarNovedad(PERIODO, employeeId(0), { rcIvaComputable: '20000.00' }, ACTOR);
  const inicio = Date.now();
  const envios = await Promise.allSettled([
    service.procesar({ periodo: PERIODO }, ACTOR),
    service.procesar({ periodo: PERIODO }, ACTOR),
  ]);
  const aceptados = envios.flatMap((e) => (e.status === 'fulfilled' ? [e.value] : []));
  for (const aceptado of aceptados) planillaIds.add(aceptado.aceptado.id);
  const rechazado = envios.find((e) => e.status === 'rejected');
  check(
    aceptados.length === 1 &&
      rechazado !== undefined &&
      (await codigo(Promise.reject(rechazado.reason))) === 'PLANILLA_PERIODO_DUPLICADO',
    'dos POST simultáneos: uno aceptado (202), el otro PLANILLA_PERIODO_DUPLICADO',
  );
  const proceso = aceptados[0];
  check(proceso.aceptado.estado === 'EN_PROCESO', 'respuesta inmediata con estado EN_PROCESO');
  const resultado = await proceso.completado;
  const ms = Date.now() - inicio;
  const calculada = await service.obtener(proceso.aceptado.id);
  check(resultado.estado === 'CALCULADA' && calculada.estado === 'CALCULADA', 'terminó CALCULADA');
  check(calculada.totalEmpleados === 200, '200 detalles persistidos');
  check(ms < LIMITE_MS, `duración ${ms} ms (< ${LIMITE_MS} ms)`);
  const detalle = await service.listarDetalle(calculada.id, { page: 1, pageSize: 100 });
  const detalle2 = await service.listarDetalle(calculada.id, { page: 2, pageSize: 100 });
  const suma = [...detalle.data, ...detalle2.data].reduce(
    (total, fila) => total + toCents(fila.liquidoPagable),
    0n,
  );
  check(suma === toCents(calculada.totalLiquido), 'Σ líquidos del detalle = total de la cabecera');

  console.log('Concurrencia de recálculo');
  const recalculos = await Promise.allSettled([
    service.recalcular(calculada.id, ACTOR),
    service.recalcular(calculada.id, ACTOR),
  ]);
  const recalculoAceptado = recalculos.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const recalculoRechazado = recalculos.find((r) => r.status === 'rejected');
  check(
    recalculoAceptado.length === 1 &&
      recalculoRechazado !== undefined &&
      (await codigo(Promise.reject(recalculoRechazado.reason))) === 'PLANILLA_ESTADO_INVALIDO',
    'dos recálculos simultáneos: uno aceptado, el otro PLANILLA_ESTADO_INVALIDO',
  );
  await recalculoAceptado[0]?.completado;
  const a = { planilla: await service.obtener(calculada.id) };
  const cabeceras = await app.planillaMensual.count({ where: { periodo: PERIODO } });
  const filas = await app.planillaDetalle.count({ where: { planillaId: a.planilla.id } });
  check(
    cabeceras === 1 && filas === 200 && a.planilla.version === 2,
    'una sola planilla, 200 filas y versión 2 (sin duplicados)',
  );

  console.log('Cierre');
  const cierres = await Promise.allSettled([
    service.cerrar(a.planilla.id, ACTOR),
    service.cerrar(a.planilla.id, ACTOR),
  ]);
  check(
    cierres.filter((cierre) => cierre.status === 'fulfilled').length === 1,
    'un solo cierre concurrente prospera',
  );
  check(
    (await codigo(service.cerrar(a.planilla.id, ACTOR))) === 'PLANILLA_ESTADO_INVALIDO',
    'doble cierre -> PLANILLA_ESTADO_INVALIDO',
  );

  console.log('Inmutabilidad (servicio)');
  check(
    (await codigo(service.procesar({ periodo: PERIODO }, ACTOR))) === 'PLANILLA_PERIODO_DUPLICADO',
    'procesar de nuevo -> PLANILLA_PERIODO_DUPLICADO',
  );
  check(
    (await codigo(service.recalcular(a.planilla.id, ACTOR))) === 'PLANILLA_ESTADO_INVALIDO',
    'recalcular -> PLANILLA_ESTADO_INVALIDO',
  );
  check(
    (await codigo(service.eliminar(a.planilla.id))) === 'PLANILLA_ESTADO_INVALIDO',
    'eliminar -> PLANILLA_ESTADO_INVALIDO',
  );

  console.log('Inmutabilidad (BD con el rol de runtime)');
  const intentos: Array<[string, () => Promise<unknown>]> = [
    [
      'UPDATE planilla',
      () =>
        app.planillaMensual.update({ where: { id: a.planilla.id }, data: { totalLiquido: '1' } }),
    ],
    ['DELETE planilla', () => app.planillaMensual.delete({ where: { id: a.planilla.id } })],
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
  const siguiente = await service.procesar({ periodo: PERIODO_SIGUIENTE }, ACTOR);
  planillaIds.add(siguiente.aceptado.id);
  await siguiente.completado;
  const enero = await service.obtenerDetalleEmpleado(a.planilla.id, employeeId(0));
  const febrero = await service.obtenerDetalleEmpleado(siguiente.aceptado.id, employeeId(0));
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
    'una planilla no cerrada no es visible en autoconsulta',
  );
  check(
    (await service.miPago(yo, PERIODO)).empleadoId === employeeId(4),
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
