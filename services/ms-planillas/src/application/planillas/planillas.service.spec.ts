import { toCents } from '../../domain/common/money';
import type { EmpleadoNomina } from '../../domain/nomina/calculo';
import {
  type Actor,
  type EmpleadosNominaPort,
  PersonalNoDisponibleError,
} from '../../domain/planillas/planilla.models';
import { InMemoryRepo, uuid } from '../../test-support/in-memory-planilla.repository';
import { mapDomainError } from './domain-error.interceptor';
import { PlanillasService, PROCESO_ATASCADO_MS } from './planillas.service';

const ENCARGADO: Actor = {
  userId: '00000000-0000-4000-8000-00000000aaaa',
  empleadoId: null,
  rol: 'ENCARGADO_NOMINA',
  permisos: ['personal:read', 'personal:read_salary', 'planilla:calculate', 'planilla:close'],
};

function empleados(n: number): EmpleadoNomina[] {
  return Array.from({ length: n }, (_, i) => ({
    empleadoId: uuid(i + 1),
    nombreCompleto: `Funcionario ${i}`,
    ciEnmascarado: `***${1000 + i}`,
    areaId: uuid(i === 0 ? 901 : 900),
    cargoId: uuid(950),
    fechaIngreso: '2020-01-01',
    haberBasico: toCents('5000'),
  }));
}

function harness(lista: EmpleadoNomina[] = empleados(3)) {
  const repo = new InMemoryRepo();
  const personal: EmpleadosNominaPort = { listarActivos: jest.fn().mockResolvedValue(lista) };
  let ahora = new Date('2026-11-05T15:00:00.000Z');
  const clock = { now: () => ahora };
  const avanzar = (ms: number) => {
    ahora = new Date(ahora.getTime() + ms);
  };
  return { repo, personal, avanzar, service: new PlanillasService(repo, personal, clock) };
}

/** Procesa el periodo y espera el cálculo en segundo plano. */
async function procesado(service: PlanillasService, periodo: string) {
  const { aceptado, completado } = await service.procesar({ periodo }, ENCARGADO);
  const resultado = await completado;
  return { aceptado, resultado, planilla: await service.obtener(aceptado.id) };
}

async function codigoDe(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    const body = mapDomainError(error)?.getResponse() as { code?: string } | undefined;
    return body?.code;
  }
}

describe('PlanillasService — procesamiento asíncrono (contrato TSK-ARQ-201)', () => {
  it('responde EN_PROCESO (202) y termina CALCULADA sin exponer importes en la respuesta', async () => {
    const { service } = harness();
    const { aceptado, completado } = await service.procesar(
      { periodo: '2026-10', observacion: 'Proceso octubre' },
      ENCARGADO,
    );
    expect(aceptado).toEqual({
      id: aceptado.id,
      periodo: '2026-10',
      estado: 'EN_PROCESO',
      totalEmpleados: 0,
      iniciadoEn: '2026-11-05T15:00:00.000Z',
    });
    expect((await completado).estado).toBe('CALCULADA');
    const planilla = await service.obtener(aceptado.id);
    expect(planilla.estado).toBe('CALCULADA');
    expect(planilla.totalEmpleados).toBe(3);
    expect(planilla.totalGanado).toBe('18267.00'); // 3 × 6089.00
    expect(planilla.totalAportesLab).toBe('2321.73');
    expect(planilla.totalAportesPat).toBe('3052.41');
    expect(planilla.observacion).toBe('Proceso octubre');
  });

  it('procesar dos veces el mismo periodo -> PLANILLA_PERIODO_DUPLICADO', async () => {
    const { service } = harness();
    await procesado(service, '2026-10');
    expect(await codigoDe(service.procesar({ periodo: '2026-10' }, ENCARGADO))).toBe(
      'PLANILLA_PERIODO_DUPLICADO',
    );
  });

  it('recalcular incrementa la versión y aplica novedades (RC-IVA computable editable)', async () => {
    const lista = empleados(1).map((e) => ({
      ...e,
      fechaIngreso: '2025-03-01',
      haberBasico: toCents('20000'),
    }));
    const { service, repo } = harness(lista);
    const { planilla } = await procesado(service, '2026-10');
    expect(planilla.totalRcIva).toBe('544.44');
    const nov = await service.registrarNovedad(
      '2026-10',
      uuid(1),
      { rcIvaComputable: '3000', subsidios: { natalidad: '3300' } },
      ENCARGADO,
    );
    expect(nov.requiereRecalculo).toBe(true);
    const { aceptado, completado } = await service.recalcular(planilla.id, ENCARGADO);
    expect(aceptado.estado).toBe('EN_PROCESO');
    await completado;
    const recalculada = await service.obtener(planilla.id);
    expect(recalculada.version).toBe(2);
    expect(recalculada.totalRcIva).toBe('154.44');
    expect(repo.detalles.get(planilla.id)?.[0].subsidios).toEqual({ natalidad: '3300.00' });
  });

  it('un fallo del cálculo deja ERROR con su motivo (sin rechazar la promesa)', async () => {
    const { service, personal } = harness();
    (personal.listarActivos as jest.Mock).mockRejectedValue(new PersonalNoDisponibleError());
    const { resultado, planilla } = await procesado(service, '2026-10');
    expect(resultado.estado).toBe('ERROR');
    expect(planilla.estado).toBe('ERROR');
    expect(planilla.error).toEqual({
      code: 'PLANILLA_PERSONAL_NO_DISPONIBLE',
      message: 'No se pudo obtener la nómina desde el servicio de personal.',
    });
  });

  it('ERROR por líquido negativo identifica al funcionario; se recupera al recalcular', async () => {
    const { service } = harness(empleados(1));
    await service.registrarNovedad('2026-10', uuid(1), { otrosDescuentos: '99999' }, ENCARGADO);
    const { planilla } = await procesado(service, '2026-10');
    expect(planilla.error).toMatchObject({
      code: 'PLANILLA_LIQUIDO_NEGATIVO',
      empleadoId: uuid(1),
    });
    await service.registrarNovedad('2026-10', uuid(1), { otrosDescuentos: '0' }, ENCARGADO);
    await (await service.recalcular(planilla.id, ENCARGADO)).completado;
    const corregida = await service.obtener(planilla.id);
    expect(corregida.estado).toBe('CALCULADA');
    expect(corregida.error).toBeNull();
  });

  it('sin funcionarios activos -> ERROR PLANILLA_SIN_EMPLEADOS', async () => {
    const { planilla } = await procesado(harness([]).service, '2026-10');
    expect(planilla.error?.code).toBe('PLANILLA_SIN_EMPLEADOS');
  });

  it('valida antes de aceptar: periodo futuro, inválido y parámetros faltantes', async () => {
    expect(await codigoDe(harness().service.procesar({ periodo: '2026-12' }, ENCARGADO))).toBe(
      'PLANILLA_PERIODO_FUTURO',
    );
    expect(await codigoDe(harness().service.procesar({ periodo: '2026-13' }, ENCARGADO))).toBe(
      'VALIDATION_ERROR',
    );
    const { service, repo } = harness();
    jest.spyOn(repo, 'obtenerParametrosVigentes').mockResolvedValue([]);
    expect(await codigoDe(service.procesar({ periodo: '2026-10' }, ENCARGADO))).toBe(
      'PLANILLA_PARAMETROS_VIGENTES_FALTANTES',
    );
    expect(repo.planillas.size).toBe(0);
  });

  it('no se recalcula ni descarta mientras está EN_PROCESO, salvo si quedó atascada', async () => {
    const { service, repo, avanzar } = harness();
    const { aceptado } = await repo
      .iniciarProceso('2026-10', ENCARGADO.userId, new Date('2026-11-05T15:00:00.000Z'), null)
      .then((p) => ({ aceptado: p }));
    expect(await codigoDe(service.recalcular(aceptado.id, ENCARGADO))).toBe(
      'PLANILLA_ESTADO_INVALIDO',
    );
    expect(await codigoDe(service.eliminar(aceptado.id))).toBe('PLANILLA_ESTADO_INVALIDO');
    avanzar(PROCESO_ATASCADO_MS + 1);
    await (await service.recalcular(aceptado.id, ENCARGADO)).completado;
    expect((await service.obtener(aceptado.id)).estado).toBe('CALCULADA');
  });
});

describe('PlanillasService — cierre e inmutabilidad (HU-24)', () => {
  it('cierra con retención de 8 años; doble cierre -> PLANILLA_ESTADO_INVALIDO', async () => {
    const { service } = harness();
    const { planilla } = await procesado(service, '2026-10');
    const cerrada = await service.cerrar(planilla.id, ENCARGADO);
    expect(cerrada.estado).toBe('CERRADA');
    expect(cerrada.cerradaEn).toBe('2026-11-05T15:00:00.000Z');
    expect(cerrada.retencionHasta).toBe('2034-11-05');
    expect(cerrada.inmutable).toBe(true);
    expect(await codigoDe(service.cerrar(planilla.id, ENCARGADO))).toBe(
      'PLANILLA_ESTADO_INVALIDO',
    );
  });

  it('solo una planilla CALCULADA puede cerrarse', async () => {
    const { service } = harness([]);
    const { planilla } = await procesado(service, '2026-10'); // queda en ERROR
    expect(await codigoDe(service.cerrar(planilla.id, ENCARGADO))).toBe(
      'PLANILLA_ESTADO_INVALIDO',
    );
  });

  it('una planilla cerrada no se recalcula, no se descarta y sus novedades no cambian', async () => {
    const { service } = harness();
    const { planilla } = await procesado(service, '2026-10');
    await service.cerrar(planilla.id, ENCARGADO);
    expect(await codigoDe(service.recalcular(planilla.id, ENCARGADO))).toBe(
      'PLANILLA_ESTADO_INVALIDO',
    );
    expect(await codigoDe(service.eliminar(planilla.id))).toBe('PLANILLA_ESTADO_INVALIDO');
    expect(
      await codigoDe(
        service.registrarNovedad('2026-10', uuid(1), { otrosIngresos: '1' }, ENCARGADO),
      ),
    ).toBe('PLANILLA_ESTADO_INVALIDO');
  });

  it('una planilla CALCULADA o en ERROR sí puede descartarse', async () => {
    const { service, repo } = harness();
    const { planilla } = await procesado(service, '2026-10');
    await service.eliminar(planilla.id);
    expect(repo.planillas.size).toBe(0);
  });

  it('el saldo RC-IVA a favor se arrastra desde el periodo anterior cerrado', async () => {
    const lista = empleados(1).map((e) => ({
      ...e,
      fechaIngreso: '2025-03-01',
      haberBasico: toCents('20000'),
    }));
    const { service } = harness(lista);
    await service.registrarNovedad('2026-09', uuid(1), { rcIvaComputable: '5000' }, ENCARGADO);
    const septiembre = await procesado(service, '2026-09');
    await service.cerrar(septiembre.planilla.id, ENCARGADO);
    const octubre = await procesado(service, '2026-10');
    expect(octubre.planilla.totalRcIva).toBe('438.88'); // 544.44 − 105.56
  });
});

describe('PlanillasService — consultas, historial, autoconsulta y KPIs', () => {
  it('listar e historial: el historial solo devuelve planillas cerradas', async () => {
    const { service } = harness();
    const septiembre = await procesado(service, '2026-09');
    await service.cerrar(septiembre.planilla.id, ENCARGADO);
    await procesado(service, '2026-10');
    expect((await service.listar({ page: 1, pageSize: 20 })).data).toHaveLength(2);
    expect(
      (await service.listar({ periodo: '2026-10', page: 1, pageSize: 20 })).data[0].estado,
    ).toBe('CALCULADA');
    const historial = await service.historial({ page: 1, pageSize: 20 });
    expect(historial.data.map((p) => p.periodo)).toEqual(['2026-09']);
    expect(
      (await service.historial({ empleadoId: uuid(999), page: 1, pageSize: 20 })).data,
    ).toHaveLength(0);
    expect((await service.historial({ gestion: 2026, page: 1, pageSize: 20 })).data).toHaveLength(
      1,
    );
  });

  it('detalle con el esquema del contrato y desglose para la boleta', async () => {
    const { service } = harness();
    const { planilla } = await procesado(service, '2026-10');
    const detalle = await service.obtenerDetalleEmpleado(planilla.id, uuid(1));
    expect(detalle).toMatchObject({
      empleadoId: uuid(1),
      totalGanado: '6089.00',
      bonoAntiguedad: '1089.00',
      aporteLaboral: '773.91',
      aportePatronal: '1017.47',
      ans: '0.00',
      rcIvaComputable: '0.00',
      liquidoPagable: '5315.09',
      subsidiosInformativos: [],
      totalDescuentos: '773.91',
    });
    expect(await codigoDe(service.obtenerDetalleEmpleado(planilla.id, uuid(77)))).toBe(
      'NOT_FOUND',
    );
    expect(await codigoDe(service.obtener(uuid(4444)))).toBe('NOT_FOUND');
  });

  it('autoconsulta: solo pagos propios y solo de planillas cerradas', async () => {
    const { service } = harness();
    const funcionario: Actor = {
      userId: uuid(8000),
      empleadoId: uuid(2),
      rol: 'FUNCIONARIO',
      permisos: ['boleta:read_own'],
    };
    const { planilla } = await procesado(service, '2026-10');
    expect((await service.misPagos(funcionario, 1, 20)).data).toHaveLength(0);
    await service.cerrar(planilla.id, ENCARGADO);
    const pagos = await service.misPagos(funcionario, 1, 20);
    expect(pagos.data).toHaveLength(1);
    expect(pagos.data[0].empleadoId).toBe(uuid(2));
    expect((await service.miPago(funcionario, '2026-10')).liquidoPagable).toBe('5315.09');
    expect(
      await codigoDe(service.miPago({ ...funcionario, empleadoId: uuid(999) }, '2026-10')),
    ).toBe('NOT_FOUND');
    expect(
      (await service.misPagos({ ...funcionario, empleadoId: null }, 1, 20)).data,
    ).toHaveLength(0);
  });

  it('KPIs: empresa, área propia (dashboard:read_area) y área ajena -> 404', async () => {
    const { service, repo } = harness();
    const { planilla } = await procesado(service, '2026-10');
    expect((await service.kpis({}, { ...ENCARGADO, permisos: ['dashboard:read'] })).periodo).toBe(
      null,
    ); // aún no hay cerradas
    await service.cerrar(planilla.id, ENCARGADO);
    repo.boletas.set(planilla.id, [
      { empleadoId: uuid(1), estado: 'EMITIDA' },
      { empleadoId: uuid(2), estado: 'EMITIDA' },
    ]);

    const gerencia: Actor = { ...ENCARGADO, permisos: ['dashboard:read'] };
    const empresa = await service.kpis({}, gerencia);
    expect(empresa).toMatchObject({
      periodo: '2026-10',
      costoPlanilla: '21319.41', // 18267.00 + 3052.41
      boletasEmitidas: 2,
      tendenciaCostos: [{ periodo: '2026-10', total: '21319.41' }],
    });

    // Jefe del área 900 (funcionarios 2 y 3): 2 × (6089.00 + 1017.47)
    const jefe: Actor = {
      userId: uuid(8001),
      empleadoId: uuid(2),
      rol: 'JEFE_AREA',
      permisos: ['dashboard:read_area'],
    };
    const area = await service.kpis({}, jefe);
    expect(area).toMatchObject({ costoPlanilla: '14212.94', boletasEmitidas: 1, areaId: uuid(900) });
    expect(await codigoDe(service.kpis({ areaId: uuid(901) }, jefe))).toBe('NOT_FOUND');
    expect(await codigoDe(service.kpis({ periodo: '2026-08' }, gerencia))).toBe('NOT_FOUND');
  });

  it('expone parámetros vigentes y la política de retención', async () => {
    const { service } = harness();
    const p = await service.parametrosVigentes('2026-10-31');
    expect(p.smn).toBe('3300.00');
    expect(p.aporteLaboralPct).toBe('12.7100');
    expect((await service.politicaRetencion()).retencionAnios).toBe(8);
  });

  it('onModuleDestroy espera los cálculos en curso', async () => {
    const { service } = harness();
    const { aceptado } = await service.procesar({ periodo: '2026-10' }, ENCARGADO);
    await service.onModuleDestroy();
    expect((await service.obtener(aceptado.id)).estado).toBe('CALCULADA');
  });
});
