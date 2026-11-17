import { AUTH_MODE } from '@/lib/auth';
import { readJson } from '@/lib/api/api-error';

export type Requester = (path: string, options?: RequestInit) => Promise<Response>;

export interface EmployeeRecordPage<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface EmployeeLicense {
  id: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'PENDIENTE' | 'AUTORIZADA' | 'RECHAZADA';
  creadoEn: string;
}

export interface EmployeePayslip {
  planillaId: string;
  periodo: string;
  estado: 'EMITIDA' | 'ANULADA' | null;
  emitidaEn: string | null;
  cerradaEn: string | null;
}

function emptyPage<T>(page: number, pageSize: number): EmployeeRecordPage<T> {
  return { data: [], meta: { page, pageSize, total: 0, totalPages: 0 } };
}

export const personalFichaApi = {
  async listLicenses(
    request: Requester,
    employeeId: string,
    page: number,
    pageSize: number,
  ): Promise<EmployeeRecordPage<EmployeeLicense>> {
    if (AUTH_MODE === 'mock') return emptyPage(page, pageSize);
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return readJson<EmployeeRecordPage<EmployeeLicense>>(
      await request(
        `/vacaciones/empleados/${encodeURIComponent(employeeId)}/licencias?${query.toString()}`,
      ),
    );
  },

  async listPayslips(
    request: Requester,
    employeeId: string,
    page: number,
    pageSize: number,
  ): Promise<EmployeeRecordPage<EmployeePayslip>> {
    if (AUTH_MODE === 'mock') return emptyPage(page, pageSize);
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return readJson<EmployeeRecordPage<EmployeePayslip>>(
      await request(
        `/planillas/boletas/funcionarios/${encodeURIComponent(employeeId)}?${query.toString()}`,
      ),
    );
  },
};
