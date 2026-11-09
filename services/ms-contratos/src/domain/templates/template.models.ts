/**
 * Catálogo cerrado de variables que pueden utilizarse en las plantillas de
 * contrato (HU-17 / RF-20). Cualquier otro placeholder debe rechazarse.
 */
export const CONTRATO_VARIABLES = [
  'nombre_empleado',
  'ci',
  'cargo',
  'remuneracion',
  'fecha_ingreso',
  'duracion_prueba',
] as const;

export type ContratoVariable = (typeof CONTRATO_VARIABLES)[number];

export interface PlantillaListado {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  versionActual: number;
  actualizadoEn: Date;
}

export interface PlantillaVersionDetalle {
  id: string;
  version: number;
  contenidoHtml: string;
  variablesDetectadas: ContratoVariable[];
  creadoEn: Date;
}

export interface PlantillaDetalle extends PlantillaListado {
  contenidoHtml: string;
  variablesDetectadas: ContratoVariable[];
  versiones: PlantillaVersionDetalle[];
  creadoEn: Date;
}

export interface PlantillaListQuery {
  page: number;
  pageSize: number;
  activa?: boolean;
  q?: string;
}

export interface CreatePlantillaData {
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  contenidoHtml: string;
  variablesDetectadas: ContratoVariable[];
  creadoPor: string;
}

export interface UpdatePlantillaData {
  nombre?: string;
  descripcion?: string | null;
  activa?: boolean;
  /** Solo se envía cuando el contenido saneado cambió realmente. */
  contenidoHtml?: string;
  variablesDetectadas?: ContratoVariable[];
  creadoPor: string;
}

export interface Page<T> {
  data: T[];
  total: number;
}
