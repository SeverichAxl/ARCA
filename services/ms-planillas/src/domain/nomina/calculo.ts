import {
  aplicarPorcentaje,
  divideHalfUp,
  max0,
  PORCENTAJE_ESCALA,
  porcentajeExacto,
  redondearExacto,
  sumCents,
} from '../common/money';
import { type ParametrosNomina, porcentajeAntiguedad } from './parametros';
import {
  aniosAntiguedad,
  compararFechas,
  DIAS_MES_COMERCIAL,
  diasTrabajadosPorIngreso,
  type Periodo,
} from './periodo';

/**
 * Motor mensual puro: mismos datos de entrada producen el mismo resultado al
 * centavo. Los parámetros legales provienen de ParametrosNomina.
 */
export interface EmpleadoNomina {
  empleadoId: string;
  nombreCompleto: string;
  ciEnmascarado: string | null;
  areaId: string;
  cargoId: string;
  fechaIngreso: string;
  haberBasico: bigint;
}

export interface NovedadNomina {
  diasTrabajados: number | null;
  otrosIngresos: bigint;
  otrosDescuentos: bigint;
  rcIvaComputable: bigint;
  subsidios: Record<string, string>;
}

export const NOVEDAD_VACIA: NovedadNomina = Object.freeze({
  diasTrabajados: null,
  otrosIngresos: 0n,
  otrosDescuentos: 0n,
  rcIvaComputable: 0n,
  subsidios: {},
});

export interface ResultadoEmpleado {
  empleadoId: string;
  nombreCompleto: string;
  ciEnmascarado: string | null;
  areaId: string;
  cargoId: string;
  fechaIngreso: string;
  haberBasico: bigint;
  diasTrabajados: number;
  haberGanado: bigint;
  aniosAntiguedad: number;
  porcentajeBono: bigint;
  bonoAntiguedad: bigint;
  otrosIngresos: bigint;
  totalGanado: bigint;
  aporteLaboral: bigint;
  ans: bigint;
  rcIvaBaseImponible: bigint;
  rcIvaImpuesto: bigint;
  rcIvaComputable: bigint;
  rcIvaSaldoAnterior: bigint;
  rcIvaSaldoSiguiente: bigint;
  rcIva: bigint;
  otrosDescuentos: bigint;
  totalDescuentos: bigint;
  liquidoPagable: bigint;
  aportePatronal: bigint;
  subsidios: Record<string, string>;
}

export class LiquidoNegativoError extends Error {
  constructor(readonly empleadoId: string) {
    super(`Los descuentos superan el total ganado del funcionario ${empleadoId}.`);
    this.name = 'LiquidoNegativoError';
  }
}

export class NovedadInconsistenteError extends Error {
  constructor(
    readonly empleadoId: string,
    message: string,
  ) {
    super(message);
    this.name = 'NovedadInconsistenteError';
  }
}

const DIAS = BigInt(DIAS_MES_COMERCIAL);

export function calcularEmpleado(
  empleado: EmpleadoNomina,
  novedad: NovedadNomina,
  saldoRcIvaAnterior: bigint,
  periodo: Periodo,
  parametros: ParametrosNomina,
): ResultadoEmpleado {
  const diasPorIngreso = diasTrabajadosPorIngreso(empleado.fechaIngreso, periodo);
  const diasTrabajados = novedad.diasTrabajados ?? diasPorIngreso;
  if (diasTrabajados < 0 || diasTrabajados > diasPorIngreso) {
    throw new NovedadInconsistenteError(
      empleado.empleadoId,
      `Los días trabajados (${diasTrabajados}) superan los ${diasPorIngreso} días ` +
        `posibles según la fecha de ingreso del funcionario ${empleado.empleadoId}.`,
    );
  }
  const dias = BigInt(diasTrabajados);
  const haberGanado = divideHalfUp(empleado.haberBasico * dias, DIAS);
  const anios = aniosAntiguedad(empleado.fechaIngreso, periodo.fechaFin);
  const porcentajeBono = porcentajeAntiguedad(parametros, anios);
  const baseBono = BigInt(parametros.bonoAntiguedadBaseSmn) * parametros.smn;
  const bonoAntiguedad = divideHalfUp(
    baseBono * porcentajeBono * dias,
    100n * PORCENTAJE_ESCALA * DIAS,
  );

  const totalGanado = haberGanado + bonoAntiguedad + novedad.otrosIngresos;
  const aporteLaboral = aplicarPorcentaje(totalGanado, parametros.aporteLaboralPct);
  const ans = redondearExacto(
    sumCents(
      parametros.tramosAns.map((tramo) =>
        porcentajeExacto(max0(totalGanado - tramo.limite), tramo.porcentaje),
      ),
    ),
  );

  const netoRcIva = max0(totalGanado - aporteLaboral - ans);
  const minimoNoImponible = BigInt(parametros.rcIvaMinimoNoImponibleSmn) * parametros.smn;
  const rcIvaBaseImponible = max0(netoRcIva - minimoNoImponible);
  const rcIvaImpuesto = aplicarPorcentaje(rcIvaBaseImponible, parametros.rcIvaPct);
  const computoMinimo = aplicarPorcentaje(minimoNoImponible, parametros.rcIvaPct);
  const computoFacturas = aplicarPorcentaje(novedad.rcIvaComputable, parametros.rcIvaPct);
  const impuestoTrasMinimo = max0(rcIvaImpuesto - computoMinimo);
  const saldoFisco = max0(impuestoTrasMinimo - computoFacturas);
  const favorPeriodo = max0(computoFacturas - impuestoTrasMinimo);
  const rcIva = max0(saldoFisco - saldoRcIvaAnterior);
  const rcIvaSaldoSiguiente = favorPeriodo + max0(saldoRcIvaAnterior - saldoFisco);

  const aportePatronal = aplicarPorcentaje(totalGanado, parametros.aportePatronalPct);
  const totalDescuentos = aporteLaboral + ans + rcIva + novedad.otrosDescuentos;
  const liquidoPagable = totalGanado - totalDescuentos;
  if (liquidoPagable < 0n) throw new LiquidoNegativoError(empleado.empleadoId);

  return {
    empleadoId: empleado.empleadoId,
    nombreCompleto: empleado.nombreCompleto,
    ciEnmascarado: empleado.ciEnmascarado,
    areaId: empleado.areaId,
    cargoId: empleado.cargoId,
    fechaIngreso: empleado.fechaIngreso.slice(0, 10),
    haberBasico: empleado.haberBasico,
    diasTrabajados,
    haberGanado,
    aniosAntiguedad: anios,
    porcentajeBono,
    bonoAntiguedad,
    otrosIngresos: novedad.otrosIngresos,
    totalGanado,
    aporteLaboral,
    ans,
    rcIvaBaseImponible,
    rcIvaImpuesto,
    rcIvaComputable: novedad.rcIvaComputable,
    rcIvaSaldoAnterior: saldoRcIvaAnterior,
    rcIvaSaldoSiguiente,
    rcIva,
    otrosDescuentos: novedad.otrosDescuentos,
    totalDescuentos,
    liquidoPagable,
    aportePatronal,
    subsidios: { ...novedad.subsidios },
  };
}

export interface TotalesPlanilla {
  totalEmpleados: number;
  totalGanado: bigint;
  totalAportesLaborales: bigint;
  totalAns: bigint;
  totalRcIva: bigint;
  totalOtrosDescuentos: bigint;
  totalLiquido: bigint;
  totalAportesPatronales: bigint;
}

export interface ResultadoPlanilla {
  detalles: ResultadoEmpleado[];
  totales: TotalesPlanilla;
  observaciones: string[];
}

export interface EntradaPlanilla {
  periodo: Periodo;
  parametros: ParametrosNomina;
  empleados: readonly EmpleadoNomina[];
  novedades: ReadonlyMap<string, NovedadNomina>;
  saldosRcIva: ReadonlyMap<string, bigint>;
}

export function totalizar(detalles: readonly ResultadoEmpleado[]): TotalesPlanilla {
  const sum = (selector: (detalle: ResultadoEmpleado) => bigint) =>
    sumCents(detalles.map(selector));
  return {
    totalEmpleados: detalles.length,
    totalGanado: sum((d) => d.totalGanado),
    totalAportesLaborales: sum((d) => d.aporteLaboral),
    totalAns: sum((d) => d.ans),
    totalRcIva: sum((d) => d.rcIva),
    totalOtrosDescuentos: sum((d) => d.otrosDescuentos),
    totalLiquido: sum((d) => d.liquidoPagable),
    totalAportesPatronales: sum((d) => d.aportePatronal),
  };
}

/** Calcula la planilla completa. Orden de salida estable por nombre e id. */
export function calcularPlanilla(entrada: EntradaPlanilla): ResultadoPlanilla {
  const observaciones: string[] = [];
  const vistos = new Set<string>();
  const detalles: ResultadoEmpleado[] = [];
  const empleados = [...entrada.empleados].sort(
    (a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, 'es') ||
      a.empleadoId.localeCompare(b.empleadoId),
  );

  for (const empleado of empleados) {
    if (vistos.has(empleado.empleadoId)) continue;
    vistos.add(empleado.empleadoId);
    if (compararFechas(empleado.fechaIngreso, entrada.periodo.fechaFin) > 0) {
      observaciones.push(`Funcionario ${empleado.empleadoId} excluido: ingresa después del periodo.`);
      continue;
    }
    detalles.push(
      calcularEmpleado(
        empleado,
        entrada.novedades.get(empleado.empleadoId) ?? NOVEDAD_VACIA,
        entrada.saldosRcIva.get(empleado.empleadoId) ?? 0n,
        entrada.periodo,
        entrada.parametros,
      ),
    );
  }

  for (const empleadoId of entrada.novedades.keys()) {
    if (!vistos.has(empleadoId)) {
      observaciones.push(`Novedad ignorada: el funcionario ${empleadoId} no está activo.`);
    }
  }

  return { detalles, totales: totalizar(detalles), observaciones };
}
