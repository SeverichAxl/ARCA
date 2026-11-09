/**
 * Tipos del contrato de ms-contratos (TSK-ARQ-201).
 *
 * Fuente de verdad:
 * - docs/api/contratos.md
 * - docs/api/openapi/contratos.yaml
 *
 * No agregar campos que el contrato no publique. Los tipos de lista usan
 * exactamente `{ data, meta: { page, pageSize, total } }`.
 */

export const VARIABLES_PERMITIDAS = [
  'nombre_empleado',
  'ci',
  'cargo',
  'remuneracion',
  'fecha_ingreso',
  'duracion_prueba',
] as const;

export type VariablePermitida = (typeof VARIABLES_PERMITIDAS)[number];

export const VARIABLE_LABELS: Record<VariablePermitida, string> = {
  nombre_empleado: 'Nombre del empleado',
  ci: 'Cédula de identidad',
  cargo: 'Cargo',
  remuneracion: 'Remuneración',
  fecha_ingreso: 'Fecha de ingreso',
  duracion_prueba: 'Duración del período de prueba',
};

/** Variables que un contrato laboral típico necesita; su ausencia solo advierte. */
export const REQUIRED_TEMPLATE_VARIABLES: readonly VariablePermitida[] = [
  'fecha_ingreso',
  'remuneracion',
  'duracion_prueba',
];

export const TEMPLATE_NAME_MAX_LENGTH = 120;
export const TEMPLATE_DESCRIPTION_MAX_LENGTH = 500;
/** El contrato no fija límite; se usa el valor de respaldo pedido por frontend. */
export const TEMPLATE_CONTENT_MAX_BYTES = 200 * 1024;

export type EstadoContrato = 'BORRADOR' | 'GENERADO' | 'EMITIDO' | 'ANULADO';
export type EstadoVersionContrato = 'BORRADOR' | 'GENERADO' | 'EMITIDO';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}

export interface PlantillaResumen {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  versionActual: number;
  actualizadoEn: string;
}

export interface PlantillaVersionResumen {
  version: number;
  creadoEn: string;
  variablesDetectadas: string[];
}

export interface Plantilla extends PlantillaResumen {
  contenidoHtml: string;
  variablesDetectadas: string[];
  versiones: PlantillaVersionResumen[];
  creadoEn: string;
}

export interface PlantillaCreada extends PlantillaResumen {
  variablesDetectadas: string[];
  creadoEn: string;
}

export interface CrearPlantillaInput {
  nombre: string;
  descripcion?: string;
  contenidoHtml: string;
  activa?: boolean;
}

export interface ActualizarPlantillaInput {
  nombre?: string;
  descripcion?: string;
  contenidoHtml?: string;
  activa?: boolean;
}

export interface PlantillaListFilters {
  page?: number;
  pageSize?: number;
  activa?: boolean;
  q?: string;
}

export interface VersionContrato {
  id: string;
  version: number;
  estado: EstadoVersionContrato;
  creadoEn: string;
  hashSha256?: string;
  firmadoTrabajador: boolean;
  firmadoRepresentante: boolean;
}

export interface Contrato {
  id: string;
  empleadoId: string;
  plantillaId: string;
  plantillaVersion: number;
  estado: EstadoContrato;
  versiones: VersionContrato[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface PreviewContrato {
  contratoId: string;
  empleadoId: string;
  plantillaVersion: number;
  htmlPreview: string;
  variablesResueltas: string[];
  camposFaltantes: string[];
  advertencias: string[];
}

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  traceId: string;
}

export type TemplateField = 'nombre' | 'descripcion' | 'contenidoHtml';

export interface TemplateValidationIssue {
  field: TemplateField;
  code: string;
  message: string;
  variable?: string;
}

export interface TemplateValidationResult {
  errors: TemplateValidationIssue[];
  warnings: TemplateValidationIssue[];
  variables: string[];
  unknownVariables: string[];
  missingRequiredVariables: VariablePermitida[];
  bytes: number;
}

/** Funcionario de ejemplo para la vista previa editorial (solo mock). */
export interface PreviewSubject {
  id: string;
  nombreCompleto: string;
  ci: string;
  cargo: string;
  area: string;
  remuneracion: number;
  fechaIngreso: string;
  duracionPrueba: number;
}
