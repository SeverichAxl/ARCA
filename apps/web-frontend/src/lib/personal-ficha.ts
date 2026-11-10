import { isApiError } from '@/lib/api/api-error';
import type { ContratoEmpleadoVersion } from '@/lib/api/contratos/types';
import type {
  Employee,
  EmployeeArea,
  EmployeePosition,
} from '@/lib/personal-api';

/** Permisos que habilitan la sección de contratos de la ficha. */
export const CONTRACT_READ_PERMISSIONS = [
  'contrato:read',
  'contrato:download_own',
] as const;

export function canDownloadContracts(permissions: readonly string[]): boolean {
  return CONTRACT_READ_PERMISSIONS.some((permission) => permissions.includes(permission));
}

export function canViewContracts(permissions: readonly string[]): boolean {
  return canDownloadContracts(permissions);
}

export function canGenerateContracts(permissions: readonly string[]): boolean {
  return permissions.includes('contrato:generate');
}

/**
 * La pestaña de boletas solo aparece con `boleta:read_all`. No existe todavía
 * un endpoint de boletas por empleado; la pestaña informa la brecha.
 */
export function showsPayslipsTab(permissions: readonly string[]): boolean {
  return permissions.includes('boleta:read_all');
}

/**
 * La remuneración se renderiza solo cuando la respuesta la incluye. El backend
 * omite la clave sin `personal:read_salary`; no se muestra etiqueta vacía.
 */
export function hasRemuneracion(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function hasHistoryAmount(value: unknown): value is number {
  return hasRemuneracion(value);
}

export function mapEmployeeFicha(
  employee: Employee,
  options: {
    canReadSalary: boolean;
    areas: ReadonlyMap<string, EmployeeArea>;
    cargos: ReadonlyMap<string, EmployeePosition>;
  },
) {
  const remuneration = options.canReadSalary ? employee.remuneracion : undefined;

  return {
    fullName: `${employee.nombres} ${employee.apellidos}`.trim(),
    ci: employee.ci,
    area: resolveCatalogName(
      employee.areaId,
      employee.area?.nombre,
      options.areas,
      'Área no disponible',
    ),
    cargo: resolveCatalogName(
      employee.cargoId,
      employee.cargo?.nombre,
      options.cargos,
      'Cargo no disponible',
    ),
    ...(hasRemuneracion(remuneration) ? { remuneracion: remuneration } : {}),
  };
}

/**
 * Resuelve el nombre de un área/cargo sin inventar datos:
 * 1. nombre incluido por el mock o una respuesta futura;
 * 2. catálogo local (solo si el rol tiene `catalogo:manage`);
 * 3. etiqueta neutral si solo hay ID.
 */
export function resolveCatalogName(
  id: string | null | undefined,
  fallbackName: string | null | undefined,
  catalog: ReadonlyMap<string, { nombre?: string | null }>,
  neutralLabel: string,
): string {
  const provided = fallbackName?.trim();
  if (provided) return provided;

  if (id) {
    const found = catalog.get(id);
    if (found?.nombre?.trim()) return found.nombre.trim();
    return neutralLabel;
  }

  return '—';
}

/**
 * Extrae los campos faltantes de un error 422 sin exponer valores del body.
 * Acepta `details.fields`, `details.camposFaltantes` o `details.variables`.
 */
export function missingContractFields(error: unknown): string[] {
  if (!isApiError(error)) return [];

  const details = error.details;
  if (!details || typeof details !== 'object') return [];

  const record = details as Record<string, unknown>;
  const raw = record.fields ?? record.camposFaltantes ?? record.variables;

  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (raw && typeof raw === 'object') {
    return Object.keys(raw as Record<string, unknown>);
  }

  return [];
}

export function versionHasDocument(version: ContratoEmpleadoVersion): boolean {
  return Boolean(version.documento?.publicIdRef);
}

/** Nombre estable para la descarga; el servidor puede sobrescribirlo. */
export function contractDownloadFileName(name: string, version: number): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `${base || 'contrato'}-v${version}.pdf`;
}
