import { personalApi, type Employee as PersonalEmployee } from '@/lib/personal-api';
import type { Requester } from './contratos-api';
import type { PageResult } from './types';

/**
 * Datos mínimos de un funcionario para el selector de la vista previa.
 *
 * No se muestran CI ni remuneración en el listado. La CI puede venir
 * enmascarada desde `ms-personal`; solo se usa para sustituir la variable del
 * contrato, nunca para identificar al funcionario en pantalla.
 */
export interface ContractEmployee {
  id: string;
  nombres: string;
  apellidos: string;
  ci: string;
  areaId: string;
  cargoId: string;
  fechaIngreso: string;
  estado: string;
  diasPrueba?: number;
  remuneracion?: number;
}

export interface ContractEmployeeFilters {
  nombre?: string;
  ci?: string;
  page?: number;
  pageSize?: number;
}

export const EMPLOYEE_SEARCH_PAGE_SIZE = 20;

/** Respuesta real de `GET /api/personal/employees` (ver `employee.service.ts`). */
export function buildEmployeesQuery(filters: ContractEmployeeFilters): string {
  const params = new URLSearchParams();
  const nombre = filters.nombre?.trim();
  const ci = filters.ci?.trim();
  if (nombre) params.set('nombre', nombre);
  if (ci) params.set('ci', ci);
  params.set('page', String(Math.max(1, filters.page ?? 1)));
  params.set(
    'pageSize',
    String(Math.min(100, Math.max(1, filters.pageSize ?? EMPLOYEE_SEARCH_PAGE_SIZE))),
  );
  return params.toString();
}

export function toContractEmployee(employee: PersonalEmployee): ContractEmployee {
  const rawSalary = employee.remuneracion as unknown;
  const salary =
    typeof rawSalary === 'number'
      ? rawSalary
      : typeof rawSalary === 'string' && rawSalary.trim()
        ? Number(rawSalary)
        : undefined;

  return {
    id: employee.id,
    nombres: employee.nombres,
    apellidos: employee.apellidos,
    ci: employee.ci,
    areaId: employee.areaId,
    cargoId: employee.cargoId,
    fechaIngreso: employee.fechaIngreso,
    estado: employee.estado,
    ...(typeof employee.diasPrueba === 'number' ? { diasPrueba: employee.diasPrueba } : {}),
    ...(typeof salary === 'number' && Number.isFinite(salary) ? { remuneracion: salary } : {}),
  };
}

export const employeesApi = {
  /**
   * Búsqueda paginada de funcionarios. `nombre` busca en nombres/apellidos y
   * `ci` exige coincidencia exacta, tal como el backend. El `signal` permite
   * cancelar búsquedas anteriores desde el combobox.
   */
  async list(
    request: Requester,
    filters: ContractEmployeeFilters = {},
    options?: RequestInit,
  ): Promise<PageResult<ContractEmployee>> {
    const result = await personalApi.listEmployees(
      request,
      {
        nombre: filters.nombre?.trim() ?? '',
        ci: filters.ci?.trim() ?? '',
        areaId: '',
        cargoId: '',
        estado: '',
        inamovilidad: '',
        page: Math.max(1, filters.page ?? 1),
        pageSize: Math.min(
          100,
          Math.max(1, filters.pageSize ?? EMPLOYEE_SEARCH_PAGE_SIZE),
        ),
      },
      options,
    );

    return {
      data: result.data.map(toContractEmployee),
      meta: result.meta,
    };
  },
};
