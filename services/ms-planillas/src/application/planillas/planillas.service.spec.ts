import { HttpException } from '@nestjs/common';
import { toCents } from '../../domain/common/money';
import type { EmpleadoNomina } from '../../domain/nomina/calculo';
import {
  type Actor,
  type EmpleadosNominaPort,
  PersonalNoDisponibleError,
} from '../../domain/planillas/planilla.models';
import { InMemoryRepo, uuid } from '../../test-support/in-memory-planilla.repository';
import { mapDomainError } from './domain-error.interceptor';
import { PlanillasService } from './planillas.service';

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
    areaId: uuid(900),
    cargoId: uuid(901),
    fechaIngreso: '2020-01-01',
    haberBasico: toCents('5000'),
  }));
}

function harness(lista: EmpleadoNomina[] = empleados(3)) {
  const repo = new InMemoryRepo();
  const personal: EmpleadosNominaPort = { listarActivos: jest.fn().mockResolvedValue(lista) };
  const clock = { now: () => new Date('2026-11-05T15:00:00.000Z') };
  return { repo, personal, service: new PlanillasService(repo, personal, clock) };
}

async function codigoDe(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    const http = mapDomainError(error);
    const body = http?.getResponse() as { code?: string } | undefined;
    return body?.code;
  }
}

describe('PlanillasService — ejecución, cierre e inmutabilidad', () => {
  it('calcula un BORRADOR y la respuesta no expone importes individuales', async () => {
    const { service } = harness();
    const r = await service.calcular('2026-10', ENCARGADO);
    expect(r.planilla.estado).toBe('BORRADOR');
    expect(r.planilla.totalEmpleados).toBe(3);
    expect(r.planilla.totales.totalGanado).toBe('18267.00'); // 3 × 6089.00
    expect(JSON.stringify(r)).not.toContain('haberBasico');
  });

  it('recalcular el mismo periodo no duplica: incrementa la versión', async () => {
    const { service, repo } = harness();
    await service.calcular('2026-10', ENCARGADO);
    const r = await service.calcular('2026-10', ENCARGADO);
    expect(r.planilla.version).toBe(2);
    expect(repo.planillas.size).toBe(1);
  });

  it('cierra con retención de 8 años y bloquea doble cierre', async () => {
    const { service } = harness();
    const { planilla } = await service.calcular('2026-10', ENCARGADO);
    const cerrada = await service.cerrar(planilla.id, ENCARGADO);
    expect(cerrada.estado).toBe('CERRADA');
    expect(cerrada.retencionHasta).toBe('2034-11-05');
    expect(cerrada.inmutable).toBe(true);
    expect(await codigoDe(service.cerrar(planilla.id, ENCARGADO))).toBe('PLAN_CERRADA');
  });

  it('una planilla cerrada no se recalcula, no se borra y sus novedades no cambian', async () => {
    const { service } = harness();
    const { planilla } = await service.calcular('2026-10', ENCARGADO);
    await service.cerrar(planilla.id, ENCARGADO);
    expect(await codigoDe(service.calcular('2026-10', ENCARGADO))).toBe('PLAN_CERRADA');
    expect(await codigoDe(service.eliminarBorrador(planilla.id))).toBe('PLAN_CERRADA');
    expect(
      await codigoDe(
        service.registrarNovedad('2026-10', uuid(1), { otrosIngresos: '1' }, ENCARGADO),
      ),
    ).toBe('PLAN_CERRADA');
  });

  it('un BORRADOR sí puede descartarse', async () => {
    const { service, repo } = harness();
    const { planilla } = await service.calcular('2026-10', ENCARGADO);
    await service.eliminarBorrador(planilla.id);
    expect(repo.planillas.size).toBe(0);
  });

  it('las novedades (RC-IVA computable) se aplican al recalcular', async () => {
    const lista = empleados(1).map((e) => ({
      ...e,
      fechaIngreso: '2025-03-01',
      haberBasico: toCents('20000'),
    }));
    const { service, repo } = harness(lista);
    const primera = await service.calcular('2026-10', ENCARGADO);
    expect(primera.planilla.totales.rcIva).toBe('544.44');
    const nov = await service.registrarNovedad(
      '2026-10',
      uuid(1),
      { rcIvaComputable: '3000', subsidios: { natalidad: '3300' } },
      ENCARGADO,
    );
    expect(nov.requiereRecalculo).toBe(true);
    expect(nov.subsidios).toEqual({ natalidad: '3300.00' });
    const segunda = await service.calcular('2026-10', ENCARGADO);
    expect(segunda.planilla.totales.rcIva).toBe('154.44');
    const detalle = repo.detalles.get(segunda.planilla.id)?.[0];
    expect(detalle?.subsidios).toEqual({ natalidad: '3300.00' });
  });

  it('el saldo RC-IVA a favor se arrastra desde el periodo anterior cerrado', async () => {
    const lista = empleados(1).map((e) => ({
      ...e,
      fechaIngreso: '2025-03-01',
      haberBasico: toCents('20000'),
    }));
    const { service } = harness(lista);
    await service.registrarNovedad('2026-09', uuid(1), { rcIvaComputable: '5000' }, ENCARGADO);
    const septiembre = await service.calcular('2026-09', ENCARGADO);
    await service.cerrar(septiembre.planilla.id, ENCARGADO);
    const octubre = await service.calcular('2026-10', ENCARGADO);
    expect(octubre.planilla.totales.rcIva).toBe('438.88'); // 544.44 − 105.56
  });

  it('rechaza periodos futuros, inválidos y sin funcionarios', async () => {
    expect(await codigoDe(harness().service.calcular('2026-12', ENCARGADO))).toBe(
      'PLAN_PERIODO_FUTURO',
    );
    expect(await codigoDe(harness().service.calcular('2026-13', ENCARGADO))).toBe(
      'VALIDATION_ERROR',
    );
    expect(await codigoDe(harness([]).service.calcular('2026-10', ENCARGADO))).toBe(
      'PLAN_SIN_EMPLEADOS',
    );
  });

  it('propaga la caída de ms-personal como 502 sin crear planilla', async () => {
    const { service, repo, personal } = harness();
    (personal.listarActivos as jest.Mock).mockRejectedValue(new PersonalNoDisponibleError());
    const error = await service
      .calcular('2026-10', ENCARGADO)
      .catch((e: unknown) => mapDomainError(e));
    expect((error as HttpException).getStatus()).toBe(502);
    expect(repo.planillas.size).toBe(0);
  });

  it('PLAN_LIQUIDO_NEGATIVO cuando un descuento supera el total ganado', async () => {
    const { service } = harness(empleados(1));
    await service.registrarNovedad('2026-10', uuid(1), { otrosDescuentos: '99999' }, ENCARGADO);
    expect(await codigoDe(service.calcular('2026-10', ENCARGADO))).toBe('PLAN_LIQUIDO_NEGATIVO');
  });
});

describe('PlanillasService — consultas, autoconsulta y dashboard', () => {
  it('autoconsulta: solo pagos propios y solo de planillas cerradas', async () => {
    const { service } = harness();
    const funcionario: Actor = {
      userId: uuid(8000),
      empleadoId: uuid(2),
      rol: 'FUNCIONARIO',
      permisos: ['boleta:read_own'],
    };
    const { planilla } = await service.calcular('2026-10', ENCARGADO);
    expect((await service.misPagos(funcionario, 1, 20)).data).toHaveLength(0); // borrador no visible
    await service.cerrar(planilla.id, ENCARGADO);
    const pagos = await service.misPagos(funcionario, 1, 20);
    expect(pagos.data).toHaveLength(1);
    expect(pagos.data[0].empleado.empleadoId).toBe(uuid(2));
    expect((await service.miPago(funcionario, '2026-10')).liquidoPagable).toBe('5315.09');
    const ajeno: Actor = { ...funcionario, empleadoId: uuid(999) };
    expect(await codigoDe(service.miPago(ajeno, '2026-10'))).toBe('NOT_FOUND');
    const sinEmpleado: Actor = { ...funcionario, empleadoId: null };
    expect((await service.misPagos(sinEmpleado, 1, 20)).data).toHaveLength(0);
  });

  it('detalle por funcionario para la boleta y 404 si no pertenece', async () => {
    const { service } = harness();
    const { planilla } = await service.calcular('2026-10', ENCARGADO);
    const detalle = await service.obtenerDetalleEmpleado(planilla.id, uuid(1));
    expect(detalle.haberes.totalGanado).toBe('6089.00');
    expect(detalle.descuentos.totalDescuentos).toBe('773.91');
    expect(await codigoDe(service.obtenerDetalleEmpleado(planilla.id, uuid(77)))).toBe('NOT_FOUND');
    expect(await codigoDe(service.obtener(uuid(4444)))).toBe('NOT_FOUND');
  });

  it('resumen de costos: solo cerradas y rango válido', async () => {
    const { service } = harness();
    const { planilla } = await service.calcular('2026-10', ENCARGADO);
    expect((await service.resumenCostos('2026-01', '2026-12')).data).toHaveLength(0);
    await service.cerrar(planilla.id, ENCARGADO);
    const r = await service.resumenCostos('2026-01', '2026-12');
    expect(r.data[0].costoTotal).toBe('21319.41'); // 18267.00 + 3052.41
    expect(await codigoDe(service.resumenCostos('2026-12', '2026-01'))).toBe('VALIDATION_ERROR');
    expect(await codigoDe(service.resumenCostos('2020-01', '2026-12'))).toBe('VALIDATION_ERROR');
  });

  it('expone parámetros vigentes y la política de retención', async () => {
    const { service } = harness();
    const p = await service.parametrosVigentes('2026-10-31');
    expect(p.smn).toBe('3300.00');
    expect(p.aporteLaboralPct).toBe('12.7100');
    expect((await service.politicaRetencion()).retencionAnios).toBe(8);
  });
});
