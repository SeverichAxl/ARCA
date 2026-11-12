import type { Requester } from '@/lib/personal-api';

export interface PayrollPeriod {
  periodo: string;
  totalEmpleados: number;
  totalGanado: number;
  totalAportesPatronales: number;
  costoTotal: number;
  totalLiquido: number;
}

export interface ExecutiveDashboardData {
  activeEmployees: number;
  activeJobProtections: number;
  payrollPeriods: PayrollPeriod[];
}

interface PageMeta {
  total: number;
}

interface EmployeeCountPage {
  meta: PageMeta;
}

interface PayrollSummaryResponse {
  data: Array<{
    periodo: string;
    totalEmpleados: number;
    totalGanado: string | number;
    totalAportesPatronales: string | number;
    costoTotal: string | number;
    totalLiquido: string | number;
  }>;
}

const MAX_PAYROLL_MONTHS = 36;

function periodCode(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getPayrollRange(now: Date, months: number): { desde: string; hasta: string } {
  if (!Number.isInteger(months) || months < 1 || months > MAX_PAYROLL_MONTHS) {
    throw new Error(`El rango del dashboard debe tener entre 1 y ${MAX_PAYROLL_MONTHS} meses.`);
  }

  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  return { desde: periodCode(start), hasta: periodCode(end) };
}

async function readJson<T>(request: Requester, path: string): Promise<T> {
  const response = await request(path);
  if (!response.ok) {
    let message = `La solicitud falló (${response.status}).`;
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) {
        message = body.message.filter((item): item is string => typeof item === 'string').join(' ');
      }
    } catch {
      // Some API errors do not include a JSON response body.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function parseAmount(value: string | number, field: string): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error(`El servicio de planillas devolvió un importe no válido (${field}).`);
  }
  return amount;
}

async function employeeCount(
  request: Requester,
  filters: { estado?: string; inamovilidad?: boolean },
): Promise<number> {
  const query = new URLSearchParams({ page: '1', pageSize: '1' });
  if (filters.estado) query.set('estado', filters.estado);
  if (filters.inamovilidad !== undefined) query.set('inamovilidad', String(filters.inamovilidad));

  const result = await readJson<EmployeeCountPage>(
    request,
    `/personal/employees?${query.toString()}`,
  );
  if (!Number.isInteger(result.meta?.total) || result.meta.total < 0) {
    throw new Error('El servicio de personal devolvió un total de empleados no válido.');
  }
  return result.meta.total;
}

export async function getExecutiveDashboard(
  request: Requester,
  now: Date = new Date(),
): Promise<ExecutiveDashboardData> {
  const range = getPayrollRange(now, MAX_PAYROLL_MONTHS);
  const [employeesOnTrial, ratifiedEmployees, activeJobProtections, summary] = await Promise.all([
    employeeCount(request, { estado: 'EN_PRUEBA' }),
    employeeCount(request, { estado: 'RATIFICADO' }),
    employeeCount(request, { inamovilidad: true }),
    readJson<PayrollSummaryResponse>(
      request,
      `/planillas/resumen?desde=${range.desde}&hasta=${range.hasta}`,
    ),
  ]);

  if (!Array.isArray(summary.data)) {
    throw new Error('El servicio de planillas devolvió un resumen no válido.');
  }

  return {
    activeEmployees: employeesOnTrial + ratifiedEmployees,
    activeJobProtections,
    payrollPeriods: summary.data.map((item) => ({
      periodo: item.periodo,
      totalEmpleados: item.totalEmpleados,
      totalGanado: parseAmount(item.totalGanado, 'totalGanado'),
      totalAportesPatronales: parseAmount(item.totalAportesPatronales, 'totalAportesPatronales'),
      costoTotal: parseAmount(item.costoTotal, 'costoTotal'),
      totalLiquido: parseAmount(item.totalLiquido, 'totalLiquido'),
    })),
  };
}
