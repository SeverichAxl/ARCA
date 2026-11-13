import type { ContratoVariable } from '../templates/template.models';

export type EstadoContrato = 'BORRADOR' | 'GENERADO' | 'EMITIDO' | 'ANULADO';
export type EstadoVersionContrato = 'BORRADOR' | 'GENERADO' | 'EMITIDO';

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

/**
 * Fila inmutable de `contrato_version`. Los metadatos del documento y las
 * referencias de firma quedan congelados por versión; una nueva firma o
 * modificación siempre crea otra fila (`v1`, `v2`, ...).
 */
export interface ContratoVersionDetalle {
  id: string;
  contratoId: string;
  plantillaVersionId: string;
  version: number;
  estado: EstadoVersionContrato;
  documentoPublicId: string | null;
  documentoVersion: string | null;
  documentoMime: string | null;
  documentoBytes: number | null;
  hashSha256: string | null;
  firmadoTrabajador: boolean;
  firmadoRepresentante: boolean;
  firmaTrabajadorRef: string | null;
  firmaTrabajadorVersion: string | null;
  firmaTrabajadorMime: string | null;
  firmaTrabajadorBytes: number | null;
  firmaRepresentanteRef: string | null;
  firmaRepresentanteVersion: string | null;
  firmaRepresentanteMime: string | null;
  firmaRepresentanteBytes: number | null;
  generadoPor: string;
  generadoEn: Date;
}

export interface CreateContratoVersionData {
  contratoId: string;
  plantillaVersionId: string;
  estado: EstadoVersionContrato;
  /** Estado resultante del contrato; nunca modifica una versión anterior. */
  estadoContrato: Extract<EstadoContrato, 'GENERADO' | 'EMITIDO'>;
  documentoPublicId: string;
  documentoVersion: string | null;
  documentoMime: string;
  documentoBytes: number;
  hashSha256: string;
  firmadoTrabajador: boolean;
  firmadoRepresentante: boolean;
  firmaTrabajadorRef: string | null;
  firmaTrabajadorVersion: string | null;
  firmaTrabajadorMime: string | null;
  firmaTrabajadorBytes: number | null;
  firmaRepresentanteRef: string | null;
  firmaRepresentanteVersion: string | null;
  firmaRepresentanteMime: string | null;
  firmaRepresentanteBytes: number | null;
  generadoPor: string;
}

export interface DocumentoGenerado {
  contratoId: string;
  version: number;
  versionId: string;
  estado: EstadoContrato;
  documento: {
    /** Referencia lógica opaca; nunca expone el `public_id` crudo de Cloudinary. */
    publicIdRef: string;
    versionId: string;
    hashSha256: string;
    bytes: number;
    mime: string;
    creadoEn: Date;
  };
  firmadoTrabajador: boolean;
  firmadoRepresentante: boolean;
  camposFaltantes: ContratoVariable[];
  advertencias: string[];
}

export interface DescargaContrato {
  url: string;
  expiresInSeconds: number;
  versionId: string;
}

export interface ContratoEmpleadoVersionResumen {
  id: string;
  version: number;
  estado: EstadoVersionContrato;
  hashSha256: string | null;
  firmadoTrabajador: boolean;
  firmadoRepresentante: boolean;
  creadoEn: Date;
  documento: {
    publicIdRef: string;
    versionId: string;
    mime: string | null;
    bytes: number | null;
  } | null;
}

export interface ContratoEmpleadoResumen {
  id: string;
  empleadoId: string;
  plantillaId: string;
  plantillaNombre: string;
  plantillaVersion: number;
  estado: EstadoContrato;
  versionVigente: number | null;
  versiones: ContratoEmpleadoVersionResumen[];
  creadoEn: Date;
}
