import type { ContratoVariable } from '../templates/template.models';

export type EstadoContrato = 'BORRADOR' | 'GENERADO' | 'EMITIDO' | 'ANULADO';

export interface ContratoVersionSnapshot {
  id: string;
  version: number;
  contenidoHtml: string;
  variablesDetectadas: ContratoVariable[];
}

export interface ContratoCreado {
  id: string;
  empleadoId: string;
  plantillaId: string;
  plantillaVersion: number;
  estado: EstadoContrato;
  creadoEn: Date;
}

export interface ContratoDetalle {
  id: string;
  empleadoId: string;
  plantillaId: string;
  plantillaVersionId: string;
  plantillaVersion: ContratoVersionSnapshot;
  estado: EstadoContrato;
  fechaInicio: Date | null;
  observacion: string | null;
  creadoEn: Date;
}

export interface CreateContratoData {
  empleadoId: string;
  plantillaId: string;
  plantillaVersionId: string;
  fechaInicio: Date | null;
  observacion: string | null;
  /** Snapshot mínimo para trazabilidad; nunca incluye CI ni remuneración. */
  empleadoSnapshot: Record<string, string | number | null>;
  creadoPor: string;
}

export interface PreviewContrato {
  contratoId: string | null;
  empleadoId: string;
  plantillaId: string;
  plantillaVersion: number;
  htmlPreview: string;
  variablesResueltas: ContratoVariable[];
  camposFaltantes: ContratoVariable[];
  advertencias: string[];
}
