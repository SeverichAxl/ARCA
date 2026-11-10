import { ApiError } from '@/lib/api/api-error';
import {
  getMockErrorFor,
  getMockLatencyMs,
  type MockErrorStatus,
} from '@/lib/api/mock-status';
import { centsToDecimalString } from '@/lib/format/money';
import { PREVIEW_SUBJECTS } from '@/lib/api/mocks/contratos.mock';
import type {
  Boleta,
  BoletaDesglose,
  BoletaDetalle,
  BoletaListFilters,
  PageResult,
  PagoPlanilla,
  PlanillaCabecera,
  PlanillaListFilters,
  SubsidioInformativo,
} from '@/lib/api/planillas/types';

/**
 * Mock del dominio `planillas`.
 *
 * Solo lo importa la capa de API. Los importes se construyen en centavos
 * enteros y se serializan como string decimal, igual que el backend real.
 * El hash es un hex determinista de 64 caracteres para la demo; NO es un
 * SHA-256 criptográfico real.
 */

const MOCK_ERROR_MESSAGES: Record<MockErrorStatus, { code: string; message: string }> = {
  401: { code: 'AUTH_TOKEN_EXPIRED', message: 'La sesión expiró.' },
  403: { code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta operación.' },
  404: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' },
  409: {
    code: 'CONFLICT',
    message: 'La operación entra en conflicto con el estado actual.',
  },
  500: {
    code: 'INTERNAL_ERROR',
    message: 'Ocurrió un error interno. Use el traceId para soporte.',
  },
};

const EMPLEADO_PRINCIPAL = PREVIEW_SUBJECTS[0]!.id;
const EMPLEADO_SECUNDARIO = PREVIEW_SUBJECTS[1]!.id;

export const MOCK_BOLETA_EMPLOYEE_IDS = {
  principal: EMPLEADO_PRINCIPAL,
  secundario: EMPLEADO_SECUNDARIO,
} as const;

export interface MockBoleta extends Boleta {
  desglose: BoletaDesglose;
}

function traceId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}`;
  return `mock-${random}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mockError(status: MockErrorStatus): ApiError {
  const entry = MOCK_ERROR_MESSAGES[status];
  return new ApiError({
    statusCode: status,
    code: entry.code,
    message: entry.message,
    traceId: traceId(),
  });
}

function throwIfConfiguredError(): void {
  const status = getMockErrorFor('planillas');
  if (status) throw mockError(status);
}

async function simulate(seed: string): Promise<void> {
  const latency = getMockLatencyMs(seed);
  if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
}

/** Hex determinista de 64 caracteres (simulación de SHA-256). */
function mockHashSha256(seed: string): string {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619) >>> 0;
  }

  let output = '';
  while (output.length < 64) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    output += (state >>> 0).toString(16).padStart(8, '0');
  }
  return output.slice(0, 64);
}

function mockUuid(kind: 'boleta' | 'planilla', empleadoSeq: number, index: number): string {
  const tail = `2026${String(index + 1).padStart(2, '0')}${String(empleadoSeq).padStart(2, '0')}0000`;
  return kind === 'boleta'
    ? `33333333-3333-4333-8333-${tail}`
    : `22222222-2222-4222-8222-${tail}`;
}

function emittedAt(periodo: string): string {
  const [year, month] = periodo.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-05T15:30:00.000Z`;
}

function sum(...values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function buildBoleta(input: {
  empleadoId: string;
  empleadoSeq: number;
  index: number;
  periodo: string;
  haberBasico: number;
  bonoAntiguedad: number;
  horasExtra: number;
  ans: number;
  rcIva: number;
  otrosDescuentos: number;
  subsidiosInformativos: SubsidioInformativo[];
}): MockBoleta {
  const otrosIngresos = 0;
  const totalGanado = sum(
    input.haberBasico,
    input.bonoAntiguedad,
    input.horasExtra,
    otrosIngresos,
  );
  // Aporte laboral de ley 12.71 % y patronal 16.71 % (informativo).
  const aporteLaboral = Math.round((totalGanado * 1271) / 10000);
  const aportePatronal = Math.round((totalGanado * 1671) / 10000);
  const totalDescuentos = sum(
    aporteLaboral,
    input.ans,
    input.rcIva,
    input.otrosDescuentos,
  );
  const liquidoPagable = totalGanado - totalDescuentos;

  const id = mockUuid('boleta', input.empleadoSeq, input.index);
  const planillaId = mockUuid('planilla', 0, input.index);
  const emitidaEn = emittedAt(input.periodo);
  const liquido = centsToDecimalString(liquidoPagable);

  return {
    id,
    planillaId,
    periodo: input.periodo,
    empleadoId: input.empleadoId,
    liquidoPagable: liquido,
    hashSha256: mockHashSha256(`${id}|${input.periodo}|${liquido}|${emitidaEn}`),
    emitidaEn,
    estado: 'EMITIDA',
    desglose: {
      haberBasico: centsToDecimalString(input.haberBasico),
      bonoAntiguedad: centsToDecimalString(input.bonoAntiguedad),
      horasExtra: centsToDecimalString(input.horasExtra),
      otrosIngresos: centsToDecimalString(otrosIngresos),
      totalGanado: centsToDecimalString(totalGanado),
      aporteLaboral: centsToDecimalString(aporteLaboral),
      aportePatronal: centsToDecimalString(aportePatronal),
      ans: centsToDecimalString(input.ans),
      rcIva: centsToDecimalString(input.rcIva),
      otrosDescuentos: centsToDecimalString(input.otrosDescuentos),
      totalDescuentos: centsToDecimalString(totalDescuentos),
      liquidoPagable: liquido,
      subsidiosInformativos: input.subsidiosInformativos,
    },
  };
}

const TRANSPORTE_Y_REFRIGERIO: SubsidioInformativo[] = [
  { concepto: 'Subsidio de transporte', monto: '250.00' },
  { concepto: 'Refrigerio', monto: '120.00' },
];

const BOLETAS_EMPLEADO_PRINCIPAL: MockBoleta[] = [
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 0,
    periodo: '2026-01',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 0,
    ans: 0,
    rcIva: 0,
    otrosDescuentos: 0,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 1,
    periodo: '2026-02',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 42500,
    ans: 0,
    rcIva: 0,
    otrosDescuentos: 0,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 2,
    periodo: '2026-03',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 0,
    ans: 0,
    rcIva: 12750,
    otrosDescuentos: 0,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 3,
    periodo: '2026-04',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 21000,
    ans: 0,
    rcIva: 0,
    otrosDescuentos: 1500,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 4,
    periodo: '2026-05',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 0,
    ans: 0,
    rcIva: 0,
    otrosDescuentos: 0,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 5,
    periodo: '2026-06',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 38000,
    ans: 0,
    rcIva: 0,
    otrosDescuentos: 0,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 6,
    periodo: '2026-07',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 0,
    ans: 0,
    rcIva: 25000,
    otrosDescuentos: 0,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 7,
    periodo: '2026-08',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 0,
    ans: 0,
    rcIva: 0,
    otrosDescuentos: 0,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 8,
    periodo: '2026-09',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 27500,
    ans: 0,
    rcIva: 0,
    otrosDescuentos: 0,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
  buildBoleta({
    empleadoId: EMPLEADO_PRINCIPAL,
    empleadoSeq: 1,
    index: 9,
    periodo: '2026-10',
    haberBasico: 850000,
    bonoAntiguedad: 85000,
    horasExtra: 0,
    ans: 0,
    rcIva: 0,
    otrosDescuentos: 0,
    subsidiosInformativos: TRANSPORTE_Y_REFRIGERIO,
  }),
];

const BOLETAS_EMPLEADO_SECUNDARIO: MockBoleta[] = [
  buildBoleta({
    empleadoId: EMPLEADO_SECUNDARIO,
    empleadoSeq: 2,
    index: 8,
    periodo: '2026-09',
    haberBasico: 1240000,
    bonoAntiguedad: 248000,
    horasExtra: 35000,
    ans: 0,
    rcIva: 45000,
    otrosDescuentos: 0,
    subsidiosInformativos: [],
  }),
  buildBoleta({
    empleadoId: EMPLEADO_SECUNDARIO,
    empleadoSeq: 2,
    index: 9,
    periodo: '2026-10',
    haberBasico: 1240000,
    bonoAntiguedad: 248000,
    horasExtra: 0,
    ans: 0,
    rcIva: 0,
    otrosDescuentos: 0,
    subsidiosInformativos: [],
  }),
];

const ALL_BOLETAS: MockBoleta[] = [
  ...BOLETAS_EMPLEADO_PRINCIPAL,
  ...BOLETAS_EMPLEADO_SECUNDARIO,
];

function toBoleta(boleta: MockBoleta): Boleta {
  return {
    id: boleta.id,
    planillaId: boleta.planillaId,
    periodo: boleta.periodo,
    empleadoId: boleta.empleadoId,
    liquidoPagable: boleta.liquidoPagable,
    hashSha256: boleta.hashSha256,
    emitidaEn: boleta.emitidaEn,
    estado: boleta.estado,
  };
}

function toPagoPlanilla(boleta: MockBoleta): PagoPlanilla {
  const { desglose } = boleta;
  const isPrimary = boleta.empleadoId === EMPLEADO_PRINCIPAL;
  return {
    id: boleta.id,
    planillaId: boleta.planillaId,
    periodo: boleta.periodo,
    estadoPlanilla: 'CERRADA',
    empleado: {
      empleadoId: boleta.empleadoId,
      nombreCompleto: isPrimary ? 'Funcionario de demostración' : 'Funcionario de muestra',
      ciEnmascarado: isPrimary ? '***4821' : '***9034',
      areaId: null,
      cargoId: null,
      fechaIngreso: '2021-01-15',
      aniosAntiguedad: 4,
    },
    diasTrabajados: 30,
    haberes: {
      haberBasico: desglose.haberBasico,
      haberGanado: desglose.totalGanado,
      porcentajeBonoAntiguedad: '0.0000',
      bonoAntiguedad: desglose.bonoAntiguedad,
      otrosIngresos: desglose.otrosIngresos,
      totalGanado: desglose.totalGanado,
    },
    descuentos: {
      aporteLaboral: desglose.aporteLaboral,
      ans: desglose.ans,
      rcIva: desglose.rcIva,
      otrosDescuentos: desglose.otrosDescuentos,
      totalDescuentos: desglose.totalDescuentos,
    },
    rcIvaDetalle: {
      baseImponible: '0.00',
      impuesto: '0.00',
      computable: desglose.rcIva,
      saldoAnterior: '0.00',
      saldoSiguiente: '0.00',
    },
    liquidoPagable: boleta.liquidoPagable,
    aportePatronal: desglose.aportePatronal,
    subsidiosInformativos: Object.fromEntries(
      desglose.subsidiosInformativos.map(({ concepto, monto }) => [concepto, monto]),
    ),
  };
}

function mockPlanilla(boletas: MockBoleta[]): PlanillaCabecera {
  const periodo = boletas[0]!.periodo;
  const [anio, mes] = periodo.split('-').map(Number);
  return {
    id: boletas[0]!.planillaId,
    periodo,
    anio: anio!,
    mes: mes!,
    estado: 'CERRADA',
    totalEmpleados: boletas.length,
    totales: {
      totalGanado: boletas.reduce(
        (total, boleta) => total + Number(boleta.desglose.totalGanado),
        0,
      ).toFixed(2),
      aportesLaborales: boletas.reduce(
        (total, boleta) => total + Number(boleta.desglose.aporteLaboral),
        0,
      ).toFixed(2),
      ans: boletas.reduce((total, boleta) => total + Number(boleta.desglose.ans), 0).toFixed(2),
      rcIva: boletas.reduce((total, boleta) => total + Number(boleta.desglose.rcIva), 0).toFixed(2),
      otrosDescuentos: boletas.reduce(
        (total, boleta) => total + Number(boleta.desglose.otrosDescuentos),
        0,
      ).toFixed(2),
      liquidoPagable: boletas.reduce(
        (total, boleta) => total + Number(boleta.liquidoPagable),
        0,
      ).toFixed(2),
      aportesPatronales: boletas.reduce(
        (total, boleta) => total + Number(boleta.desglose.aportePatronal),
        0,
      ).toFixed(2),
    },
    cerradoEn: `${periodo}-28T15:00:00.000Z`,
    inmutable: true,
  };
}

function findOwnOrThrow(id: string, empleadoId: string): MockBoleta {
  const boleta = ALL_BOLETAS.find(
    (item) => item.id === id && item.empleadoId === empleadoId,
  );
  if (!boleta) {
    throw new ApiError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'El recurso solicitado no existe.',
      traceId: traceId(),
    });
  }
  return boleta;
}

/** Lista paginada del funcionario autenticado. */
export async function listMisBoletas(
  filters: BoletaListFilters,
  empleadoId: string,
): Promise<PageResult<Boleta>> {
  await simulate(
    `planillas:list:${empleadoId}:${filters.periodo ?? ''}:${filters.planillaId ?? ''}:${filters.page ?? 1}`,
  );
  throwIfConfiguredError();

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 20));

  const rows = ALL_BOLETAS.filter(
    (boleta) =>
      boleta.empleadoId === empleadoId &&
      (!filters.periodo || boleta.periodo === filters.periodo) &&
      (!filters.planillaId || boleta.planillaId === filters.planillaId),
  ).sort((left, right) => right.periodo.localeCompare(left.periodo));

  const start = (page - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize).map(toBoleta),
    meta: { page, pageSize, total: rows.length },
  };
}

export async function listMisPagos(empleadoId: string): Promise<PageResult<PagoPlanilla>> {
  await simulate(`planillas:mis-pagos:${empleadoId}`);
  throwIfConfiguredError();
  const rows = ALL_BOLETAS.filter((boleta) => boleta.empleadoId === empleadoId)
    .sort((left, right) => right.periodo.localeCompare(left.periodo))
    .map(toPagoPlanilla);
  return {
    data: rows,
    meta: { page: 1, pageSize: 200, total: rows.length, totalPages: 1 },
  };
}

export async function listClosedPlanillas(
  filters: PlanillaListFilters,
): Promise<PageResult<PlanillaCabecera>> {
  await simulate(`planillas:autorizadas:${filters.desde ?? ''}:${filters.hasta ?? ''}`);
  throwIfConfiguredError();
  const grouped = new Map<string, MockBoleta[]>();
  for (const boleta of ALL_BOLETAS) {
    if (
      (filters.desde && boleta.periodo < filters.desde) ||
      (filters.hasta && boleta.periodo > filters.hasta)
    ) {
      continue;
    }
    const rows = grouped.get(boleta.planillaId) ?? [];
    rows.push(boleta);
    grouped.set(boleta.planillaId, rows);
  }
  const allPlanillas = [...grouped.values()]
    .map(mockPlanilla)
    .sort((left, right) => right.periodo.localeCompare(left.periodo));
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 12));
  const start = (page - 1) * pageSize;
  return {
    data: allPlanillas.slice(start, start + pageSize),
    meta: {
      page,
      pageSize,
      total: allPlanillas.length,
      totalPages: Math.ceil(allPlanillas.length / pageSize),
    },
  };
}

export async function listPlanillaDetalle(
  planillaId: string,
  page: number,
  pageSize: number,
): Promise<PageResult<PagoPlanilla>> {
  await simulate(`planillas:detalle:${planillaId}:${page}`);
  throwIfConfiguredError();
  const rows = ALL_BOLETAS.filter((boleta) => boleta.planillaId === planillaId)
    .map(toPagoPlanilla)
    .sort((left, right) => left.empleado.nombreCompleto.localeCompare(right.empleado.nombreCompleto));
  const currentPage = Math.max(1, page);
  const currentPageSize = Math.min(200, Math.max(1, pageSize));
  const start = (currentPage - 1) * currentPageSize;
  return {
    data: rows.slice(start, start + currentPageSize),
    meta: {
      page: currentPage,
      pageSize: currentPageSize,
      total: rows.length,
      totalPages: Math.ceil(rows.length / currentPageSize),
    },
  };
}

export async function descargarBoletaPropia(
  periodo: string,
  empleadoId: string,
): Promise<Response> {
  const boleta = ALL_BOLETAS.find(
    (item) => item.empleadoId === empleadoId && item.periodo === periodo,
  );
  if (!boleta) throw mockError(404);
  return descargarBoleta(boleta.id, empleadoId);
}

export async function descargarBoletaAutorizada(
  planillaId: string,
  empleadoId: string,
): Promise<Response> {
  const boleta = ALL_BOLETAS.find(
    (item) => item.planillaId === planillaId && item.empleadoId === empleadoId,
  );
  if (!boleta) throw mockError(404);
  return descargarBoleta(boleta.id, empleadoId);
}

/** Detalle propio. El mock agrega `desglose`; el contrato real no lo publica. */
export async function getBoleta(
  id: string,
  empleadoId: string,
): Promise<BoletaDetalle> {
  await simulate(`planillas:get:${id}:${empleadoId}`);
  throwIfConfiguredError();
  return clone(findOwnOrThrow(id, empleadoId));
}

/**
 * Descarga simulada. Devuelve un PDF mínimo con `Content-Disposition`, igual
 * que la respuesta final que el backend real entrega tras su URL firmada.
 */
export async function descargarBoleta(
  id: string,
  empleadoId: string,
): Promise<Response> {
  await simulate(`planillas:download:${id}:${empleadoId}`);
  throwIfConfiguredError();

  const boleta = findOwnOrThrow(id, empleadoId);
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`;

  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="boleta-${boleta.periodo}.pdf"`,
    },
  });
}

/** Solo para pruebas: copia de las boletas con su desglose completo. */
export function getMockBoletasForTests(): MockBoleta[] {
  return clone(ALL_BOLETAS);
}
