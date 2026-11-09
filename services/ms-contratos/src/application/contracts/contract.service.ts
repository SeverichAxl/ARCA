import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditContext } from '@arca/audit';
import type { InternalPrincipal } from '@arca/internal-auth';
import {
  renderContratoTemplate,
  toContratoVariables,
} from '../../domain/contracts/contract-render';
import {
  CONTRATO_STORAGE_PORT,
  type ContratoArchivoTipo,
  type ContratoStoragePort,
} from '../../domain/contracts/contrato-storage.port';
import {
  detectarMimeFirma,
  firmaComoDataUrl,
  FirmaInvalidaError,
  validarFirma,
  type ArchivoFirmaEntrante,
  type FirmaMime,
} from '../../domain/contracts/firma-validation';
import type {
  ContratoCreado,
  ContratoDetalle,
  ContratoEmpleadoResumen,
  ContratoVersionDetalle,
  DescargaContrato,
  DocumentoGenerado,
  EstadoContrato,
  EstadoVersionContrato,
  PreviewContrato,
} from '../../domain/contracts/contract.models';
import {
  CONTRATO_REPOSITORY,
  type ContratoRepository,
} from '../../domain/contracts/contract.repository';
import {
  PDF_GENERATOR_PORT,
  type PdfGeneratorPort,
} from '../../domain/contracts/pdf-generator.port';
import {
  PERSONAL_DATA_PORT,
  type DatosEmpleadoContrato,
  type PersonalDataPort,
} from '../../domain/contracts/personal-data.port';
import type {
  PlantillaDetalle,
  PlantillaVersionDetalle,
} from '../../domain/templates/template.models';
import {
  PLANTILLA_REPOSITORY,
  type PlantillaRepository,
} from '../../domain/templates/template.repository';
import type { CreateContratoDto, PreviewContratoDto } from './contract.dto';

interface PlantillaVigente {
  plantilla: PlantillaDetalle;
  version: PlantillaVersionDetalle;
}

export interface FirmasEntrantes {
  firmaTrabajador?: ArchivoFirmaEntrante;
  firmaRepresentante?: ArchivoFirmaEntrante;
}

interface FirmaValidada {
  mimeType: FirmaMime;
  buffer: Buffer;
}

interface FirmaResuelta extends FirmaValidada {
  /** `null` cuando la firma se acaba de recibir y aún no se ha subido. */
  publicId: string | null;
  providerVersion: string | null;
  bytes: number;
  nueva: boolean;
}

interface FirmasResueltas {
  trabajador?: FirmaResuelta;
  representante?: FirmaResuelta;
}

interface OpcionesDocumento {
  incluirFirmasPrevias: boolean;
  requiereFirmaNueva: boolean;
}

const SIGNATURE_LABELS = {
  trabajador: 'Firma del trabajador',
  representante: 'Firma del representante',
} as const;

const ESTADO_VERSION_POR_FIRMAS: Record<'parcial' | 'completo', EstadoVersionContrato> = {
  parcial: 'GENERADO',
  completo: 'EMITIDO',
};

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @Inject(PLANTILLA_REPOSITORY)
    private readonly plantillas: PlantillaRepository,
    @Inject(CONTRATO_REPOSITORY)
    private readonly contratos: ContratoRepository,
    @Inject(PERSONAL_DATA_PORT)
    private readonly personal: PersonalDataPort,
    @Inject(PDF_GENERATOR_PORT)
    private readonly pdfGenerator: PdfGeneratorPort,
    @Inject(CONTRATO_STORAGE_PORT)
    private readonly storage: ContratoStoragePort,
    @Optional() private readonly auditContext?: AuditContext,
  ) {}

  /**
   * Vista previa efímera a partir de una plantilla y un empleado. No escribe en
   * db_contratos ni devuelve datos sensibles en auditoría.
   */
  async preview(
    dto: PreviewContratoDto,
    principal: InternalPrincipal,
  ): Promise<PreviewContrato> {
    const { plantilla, version } = await this.requirePlantillaActiva(dto.plantillaId);
    const datos = await this.personal.getDatosContrato(dto.empleadoId, principal);

    return this.buildPreview(null, plantilla.id, version, datos);
  }

  /**
   * Vista previa de un contrato ya persistido, usando la versión de plantilla
   * congelada en el contrato.
   */
  async previewById(id: string, principal: InternalPrincipal): Promise<PreviewContrato> {
    const contrato = await this.contratos.findById(id);
    if (!contrato) throw this.contratoNotFound();

    const datos = await this.personal.getDatosContrato(contrato.empleadoId, principal);

    return this.buildPreview(
      contrato.id,
      contrato.plantillaId,
      {
        id: contrato.plantillaVersion.id,
        version: contrato.plantillaVersion.version,
        contenidoHtml: contrato.plantillaVersion.contenidoHtml,
        variablesDetectadas: contrato.plantillaVersion.variablesDetectadas,
        creadoEn: contrato.creadoEn,
      },
      datos,
    );
  }

  /**
   * Ficha de contratos de un empleado (HU-09). `contrato:read` y `personal:read`
   * consultan a cualquiera; quien solo tiene `contrato:download_own` solo puede
   * consultar su propio empleado (coincidencia de identidad). Fuera del ámbito
   * se responde 404 para no revelar existencia de registros ajenos.
   */
  async listarPorEmpleado(
    empleadoId: string,
    principal: InternalPrincipal,
  ): Promise<{ data: ContratoEmpleadoResumen[]; meta: { total: number } }> {
    const canReadAll =
      principal.permisos.includes('contrato:read') ||
      principal.permisos.includes('personal:read');
    const canReadOwn = principal.permisos.includes('contrato:download_own');

    if (!canReadAll && !canReadOwn) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tiene permiso para consultar los contratos del empleado.',
      });
    }
    if (!canReadAll && principal.empleadoId !== empleadoId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No se encontraron contratos para el empleado.',
      });
    }

    const data = await this.contratos.findByEmpleadoId(empleadoId);
    if (data.length === 0) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No se encontraron contratos para el empleado.',
      });
    }

    this.auditContext?.captureAfter({
      empleadoId,
      total: data.length,
      contratos: data.map(({ id, estado, versionVigente }) => ({
        id,
        estado,
        versionVigente,
      })),
    });

    return { data, meta: { total: data.length } };
  }

  async create(
    dto: CreateContratoDto,
    principal: InternalPrincipal,
  ): Promise<ContratoCreado> {
    const { plantilla, version } = await this.requirePlantillaActiva(dto.plantillaId);
    const datos = await this.personal.getDatosContrato(dto.empleadoId, principal);

    const created = await this.contratos.create({
      empleadoId: dto.empleadoId,
      plantillaId: plantilla.id,
      plantillaVersionId: version.id,
      fechaInicio: this.parseFechaInicio(dto.fechaInicio),
      observacion: dto.observacion ?? null,
      empleadoSnapshot: {
        nombreEmpleado: datos.nombreEmpleado,
        cargo: datos.cargo,
        fechaIngreso: datos.fechaIngreso,
        duracionPrueba: datos.duracionPrueba,
        plantillaVersion: version.version,
      },
      creadoPor: principal.userId,
    });

    this.auditContext?.captureAfter({
      contratoId: created.id,
      empleadoId: created.empleadoId,
      plantillaId: created.plantillaId,
      plantillaVersion: created.plantillaVersion,
      estado: created.estado,
    });

    return created;
  }

  /**
   * Genera una nueva versión PDF del contrato (HU-19). Puede incorporar firmas
   * nuevas y, si `incluirFirmas`, hereda las ya registradas en la última
   * versión. Nunca sobreescribe el documento ni las firmas anteriores.
   */
  async generatePdf(
    id: string,
    dto: { incluirFirmas?: boolean },
    files: FirmasEntrantes,
    principal: InternalPrincipal,
  ): Promise<DocumentoGenerado> {
    this.requirePermission(principal, 'contrato:generate');
    return this.crearVersionDocumento(id, files, principal, {
      incluirFirmasPrevias: dto.incluirFirmas ?? true,
      requiereFirmaNueva: false,
    });
  }

  /**
   * Registra una o ambas firmas gráficas y crea una versión PDF que las
   * incorpora. Si ambas partes quedan firmadas, el contrato pasa a EMITIDO.
   */
  async firmar(
    id: string,
    files: FirmasEntrantes,
    principal: InternalPrincipal,
  ): Promise<DocumentoGenerado> {
    this.requirePermission(principal, 'contrato:generate');
    if (!files.firmaTrabajador && !files.firmaRepresentante) {
      throw new BadRequestException({
        code: 'CONTR_ARCHIVO_INVALIDO',
        message: 'Debe adjuntar al menos una firma (trabajador o representante).',
      });
    }

    return this.crearVersionDocumento(id, files, principal, {
      incluirFirmasPrevias: true,
      requiereFirmaNueva: true,
    });
  }

  /**
   * Descarga controlada: valida permiso y propiedad antes de firmar una URL
   * temporal de Cloudinary. Un actor con solo `contrato:download_own` recibe
   * 404 si el contrato pertenece a otro empleado (no se filtra existencia).
   */
  async getDescarga(
    id: string,
    versionId: string,
    principal: InternalPrincipal,
  ): Promise<DescargaContrato> {
    const contrato = await this.contratos.findById(id);
    if (!contrato) throw this.contratoNotFound();

    this.assertPuedeDescargar(contrato, principal);

    const version = await this.contratos.findVersion(id, versionId);
    if (!version || !version.documentoPublicId) {
      throw this.versionNotFound();
    }

    return this.crearUrlDescarga(version);
  }

  async getUltimaDescarga(
    id: string,
    principal: InternalPrincipal,
  ): Promise<DescargaContrato> {
    const contrato = await this.contratos.findById(id);
    if (!contrato) throw this.contratoNotFound();

    this.assertPuedeDescargar(contrato, principal);

    const version = await this.contratos.findLatestVersion(id);
    if (!version || !version.documentoPublicId) throw this.versionNotFound();

    return this.crearUrlDescarga(version);
  }

  private async crearUrlDescarga(
    version: ContratoVersionDetalle,
  ): Promise<DescargaContrato> {
    const signed = await this.storage.signedUrl(
      version.documentoPublicId!,
      'documento',
      'pdf',
    );
    this.auditContext?.captureAfter({
      contratoId: version.contratoId,
      versionId: version.id,
      version: version.version,
      expiresInSeconds: signed.expiresInSeconds,
    });
    return {
      url: signed.url,
      expiresInSeconds: signed.expiresInSeconds,
      versionId: version.id,
    };
  }

  private async crearVersionDocumento(
    id: string,
    files: FirmasEntrantes,
    principal: InternalPrincipal,
    options: OpcionesDocumento,
  ): Promise<DocumentoGenerado> {
    const contrato = await this.contratos.findById(id);
    if (!contrato) throw this.contratoNotFound();
    if (contrato.estado === 'ANULADO') {
      throw new BadRequestException({
        code: 'CONTR_CONTRATO_ANULADO',
        message: 'No se puede generar una nueva versión de un contrato anulado.',
      });
    }

    const datos = await this.personal.getDatosContrato(contrato.empleadoId, principal);
    const anterior = await this.contratos.findLatestVersion(id);

    const firmas = await this.resolverFirmas(
      files,
      anterior,
      options.incluirFirmasPrevias,
    );

    if (options.requiereFirmaNueva) {
      const hayNueva = firmas.trabajador?.nueva || firmas.representante?.nueva;
      if (!hayNueva) {
        throw new BadRequestException({
          code: 'CONTR_ARCHIVO_INVALIDO',
          message: 'Debe adjuntar al menos una firma nueva.',
        });
      }
    }

    const render = this.renderDocumento(contrato, datos, firmas);

    let pdf: Buffer;
    try {
      pdf = await this.pdfGenerator.generate(render.html);
    } catch {
      throw new InternalServerErrorException({
        code: 'CONTR_PDF_GENERACION',
        message: 'No se pudo generar el PDF del contrato.',
      });
    }
    if (!Buffer.isBuffer(pdf) || pdf.length === 0) {
      throw new InternalServerErrorException({
        code: 'CONTR_PDF_GENERACION',
        message: 'El generador de PDF devolvió un documento vacío.',
      });
    }

    const subidos: Array<{ publicId: string; kind: ContratoArchivoTipo }> = [];

    try {
      const documento = await this.storage.upload({
        buffer: pdf,
        mimeType: 'application/pdf',
        kind: 'documento',
        contratoId: contrato.id,
      });
      subidos.push({ publicId: documento.publicId, kind: 'documento' });

      await this.subirFirmasNuevas(firmas, contrato.id, subidos);

      const completo = Boolean(firmas.trabajador && firmas.representante);
      const estadoVersion = completo
        ? ESTADO_VERSION_POR_FIRMAS.completo
        : ESTADO_VERSION_POR_FIRMAS.parcial;
      const estadoContrato: Extract<EstadoContrato, 'GENERADO' | 'EMITIDO'> =
        completo || contrato.estado === 'EMITIDO' ? 'EMITIDO' : 'GENERADO';

      const version = await this.contratos.createVersion({
        contratoId: contrato.id,
        plantillaVersionId: contrato.plantillaVersionId,
        estado: estadoVersion,
        estadoContrato,
        documentoPublicId: documento.publicId,
        documentoVersion: documento.providerVersion,
        documentoMime: documento.mimeType,
        documentoBytes: documento.bytes,
        hashSha256: this.sha256(pdf),
        firmadoTrabajador: Boolean(firmas.trabajador),
        firmadoRepresentante: Boolean(firmas.representante),
        firmaTrabajadorRef: firmas.trabajador?.publicId ?? null,
        firmaTrabajadorVersion: firmas.trabajador?.providerVersion ?? null,
        firmaTrabajadorMime: firmas.trabajador?.mimeType ?? null,
        firmaTrabajadorBytes: firmas.trabajador?.bytes ?? null,
        firmaRepresentanteRef: firmas.representante?.publicId ?? null,
        firmaRepresentanteVersion: firmas.representante?.providerVersion ?? null,
        firmaRepresentanteMime: firmas.representante?.mimeType ?? null,
        firmaRepresentanteBytes: firmas.representante?.bytes ?? null,
        generadoPor: principal.userId,
      });

      this.auditContext?.captureAfter({
        contratoId: contrato.id,
        versionId: version.id,
        version: version.version,
        estado: estadoContrato,
        documento: {
          publicIdRef: this.publicIdRef(contrato.id, version.version),
          hashSha256: version.hashSha256,
          bytes: version.documentoBytes,
          mime: version.documentoMime,
        },
        firmadoTrabajador: version.firmadoTrabajador,
        firmadoRepresentante: version.firmadoRepresentante,
        camposFaltantes: render.camposFaltantes,
        advertencias: render.advertencias,
      });

      return this.toDocumentoGenerado(contrato, version, render.camposFaltantes, render.advertencias);
    } catch (error) {
      await this.rollbackSubidas(subidos);
      if (error instanceof BadRequestException) throw error;
      if (error instanceof FirmaInvalidaError) throw this.firmaInvalida(error);
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException({
        code: 'CONTR_PDF_GENERACION',
        message: 'No se pudo almacenar la nueva versión del contrato.',
      });
    }
  }

  private async resolverFirmas(
    files: FirmasEntrantes,
    anterior: ContratoVersionDetalle | null,
    incluirPrevias: boolean,
  ): Promise<FirmasResueltas> {
    const trabajador = await this.resolverFirma(
      files.firmaTrabajador,
      incluirPrevias && anterior?.firmaTrabajadorRef
        ? {
            publicId: anterior.firmaTrabajadorRef,
            mimeType: anterior.firmaTrabajadorMime,
            providerVersion: anterior.firmaTrabajadorVersion,
          }
        : null,
    );
    const representante = await this.resolverFirma(
      files.firmaRepresentante,
      incluirPrevias && anterior?.firmaRepresentanteRef
        ? {
            publicId: anterior.firmaRepresentanteRef,
            mimeType: anterior.firmaRepresentanteMime,
            providerVersion: anterior.firmaRepresentanteVersion,
          }
        : null,
    );

    return { trabajador, representante };
  }

  private async resolverFirma(
    archivo: ArchivoFirmaEntrante | undefined,
    firmaPrevia: {
      publicId: string;
      mimeType: string | null;
      providerVersion: string | null;
    } | null,
  ): Promise<FirmaResuelta | undefined> {
    if (archivo) {
      let mimeType: FirmaMime;
      try {
        mimeType = validarFirma(archivo);
      } catch (error) {
        if (error instanceof FirmaInvalidaError) throw this.firmaInvalida(error);
        throw error;
      }
      return {
        mimeType,
        buffer: archivo.buffer,
        publicId: null,
        providerVersion: null,
        bytes: archivo.buffer.length,
        nueva: true,
      };
    }

    if (!firmaPrevia) return undefined;

    let buffer: Buffer;
    try {
      buffer = await this.storage.download(
        firmaPrevia.publicId,
        'firma',
        firmaPrevia.mimeType === 'image/jpeg'
          ? 'jpg'
          : firmaPrevia.mimeType === 'image/png'
            ? 'png'
            : undefined,
      );
    } catch {
      throw new InternalServerErrorException({
        code: 'CONTR_PDF_GENERACION',
        message: 'No se pudo recuperar una firma registrada previamente.',
      });
    }

    const mimeType = detectarMimeFirma(buffer);
    if (!mimeType) {
      throw new InternalServerErrorException({
        code: 'CONTR_PDF_GENERACION',
        message: 'La firma registrada previamente no es una imagen válida.',
      });
    }

    return {
      mimeType,
      buffer,
      publicId: firmaPrevia.publicId,
      providerVersion: firmaPrevia.providerVersion,
      bytes: buffer.length,
      nueva: false,
    };
  }

  private async subirFirmasNuevas(
    firmas: FirmasResueltas,
    contratoId: string,
    subidos: Array<{ publicId: string; kind: ContratoArchivoTipo }>,
  ): Promise<void> {
    for (const firma of [firmas.trabajador, firmas.representante]) {
      if (!firma?.nueva) continue;
      const stored = await this.storage.upload({
        buffer: firma.buffer,
        mimeType: firma.mimeType,
        kind: 'firma',
        contratoId,
      });
      firma.publicId = stored.publicId;
      firma.providerVersion = stored.providerVersion;
      firma.bytes = stored.bytes;
      subidos.push({ publicId: stored.publicId, kind: 'firma' });
    }
  }

  private renderDocumento(
    _contrato: ContratoDetalle,
    datos: DatosEmpleadoContrato,
    firmas: FirmasResueltas,
  ) {
    // `_contrato` se conserva para futuras marcas de agua/versionado visual.
    const rendered = renderContratoTemplate(
      _contrato.plantillaVersion.contenidoHtml,
      toContratoVariables(datos),
    );

    return {
      html: this.htmlDocumento(rendered.html, firmas),
      camposFaltantes: rendered.camposFaltantes,
      advertencias: rendered.advertencias,
    };
  }

  private htmlDocumento(contenido: string, firmas: FirmasResueltas): string {
    const bloques: string[] = [];
    if (firmas.trabajador) {
      bloques.push(this.bloqueFirma(SIGNATURE_LABELS.trabajador, firmas.trabajador));
    }
    if (firmas.representante) {
      bloques.push(
        this.bloqueFirma(SIGNATURE_LABELS.representante, firmas.representante),
      );
    }

    const firmaHtml =
      bloques.length > 0
        ? `<section class="firmas-contrato"><table><tr>${bloques.join('')}</tr></table></section>`
        : '';

    return [
      '<!doctype html>',
      '<html lang="es"><head><meta charset="utf-8">',
      '<style>',
      '@page { size: A4; margin: 18mm 16mm; }',
      'body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.45; }',
      'h1, h2, h3 { margin: 0 0 8px; }',
      'p { margin: 0 0 8px; }',
      'table { border-collapse: collapse; }',
      '.firmas-contrato { margin-top: 28mm; page-break-inside: avoid; }',
      '.firmas-contrato td { width: 50%; padding: 0 10mm; text-align: center; vertical-align: bottom; }',
      '.firmas-contrato img { max-width: 55mm; max-height: 25mm; object-fit: contain; }',
      '.firma-linea { border-top: 1px solid #333; margin-top: 4mm; padding-top: 2mm; font-size: 9pt; }',
      '</style></head><body>',
      contenido,
      firmaHtml,
      '</body></html>',
    ].join('');
  }

  private bloqueFirma(label: string, firma: FirmaResuelta): string {
    const src = firmaComoDataUrl(firma.buffer, firma.mimeType);
    return `<td><img src="${src}" alt="${label}"><div class="firma-linea">${label}</div></td>`;
  }

  private toDocumentoGenerado(
    contrato: ContratoDetalle,
    version: ContratoVersionDetalle,
    camposFaltantes: DocumentoGenerado['camposFaltantes'],
    advertencias: string[],
  ): DocumentoGenerado {
    return {
      contratoId: contrato.id,
      version: version.version,
      versionId: version.id,
      estado: contrato.estado === 'EMITIDO' ? 'EMITIDO' : (version.estado as EstadoContrato),
      documento: {
        publicIdRef: this.publicIdRef(contrato.id, version.version),
        versionId: version.id,
        hashSha256: version.hashSha256 ?? '',
        bytes: version.documentoBytes ?? 0,
        mime: version.documentoMime ?? 'application/pdf',
        creadoEn: version.generadoEn,
      },
      firmadoTrabajador: version.firmadoTrabajador,
      firmadoRepresentante: version.firmadoRepresentante,
      camposFaltantes,
      advertencias,
    };
  }

  private async rollbackSubidas(
    subidos: Array<{ publicId: string; kind: ContratoArchivoTipo }>,
  ): Promise<void> {
    for (const item of subidos) {
      try {
        await this.storage.delete(item.publicId, item.kind);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'error desconocido';
        this.logger.warn(
          `No se pudo revertir el archivo ${item.kind} ${item.publicId}: ${detail}`,
        );
      }
    }
  }

  private assertPuedeDescargar(
    contrato: ContratoDetalle,
    principal: InternalPrincipal,
  ): void {
    const canReadAll = principal.permisos.includes('contrato:read');
    const canReadOwn =
      principal.empleadoId !== null &&
      principal.empleadoId === contrato.empleadoId &&
      principal.permisos.includes('contrato:download_own');

    if (!canReadAll && !canReadOwn) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Contrato no encontrado en el ámbito del usuario.',
      });
    }
  }

  private requirePermission(principal: InternalPrincipal, permission: string): void {
    if (!principal.permisos.includes(permission)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Permiso ${permission} requerido.`,
      });
    }
  }

  private firmaInvalida(error: FirmaInvalidaError): BadRequestException {
    return new BadRequestException({
      code: 'CONTR_ARCHIVO_INVALIDO',
      message: error.message,
    });
  }

  private sha256(value: Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private publicIdRef(contratoId: string, version: number): string {
    // Referencia lógica opaca: no expone el public_id real de Cloudinary.
    return `${contratoId}/v${version}`;
  }

  private buildPreview(
    contratoId: string | null,
    plantillaId: string,
    version: PlantillaVersionDetalle,
    datos: DatosEmpleadoContrato,
  ): PreviewContrato {
    const rendered = renderContratoTemplate(
      version.contenidoHtml,
      toContratoVariables(datos),
    );

    const preview: PreviewContrato = {
      contratoId,
      empleadoId: datos.empleadoId,
      plantillaId,
      plantillaVersion: version.version,
      htmlPreview: rendered.html,
      variablesResueltas: rendered.variablesResueltas,
      camposFaltantes: rendered.camposFaltantes,
      advertencias: rendered.advertencias,
    };

    // La auditoría guarda solo el resumen: nunca el HTML con CI o remuneración.
    this.auditContext?.captureAfter({
      contratoId: preview.contratoId,
      empleadoId: preview.empleadoId,
      plantillaId: preview.plantillaId,
      plantillaVersion: preview.plantillaVersion,
      variablesResueltas: preview.variablesResueltas,
      camposFaltantes: preview.camposFaltantes,
      advertencias: preview.advertencias,
    });

    return preview;
  }

  private async requirePlantillaActiva(plantillaId: string): Promise<PlantillaVigente> {
    const plantilla = await this.plantillas.findById(plantillaId);
    if (!plantilla) throw this.plantillaNotFound();
    if (!plantilla.activa) {
      throw new BadRequestException({
        code: 'CONTR_PLANTILLA_INACTIVA',
        message: 'La plantilla de contrato no está activa.',
      });
    }

    const version =
      plantilla.versiones.find((item) => item.version === plantilla.versionActual) ??
      plantilla.versiones[0];

    if (!version) {
      throw new BadRequestException({
        code: 'CONTR_TEMPLATE_INVALIDA',
        message: 'La plantilla no tiene una versión de contenido disponible.',
      });
    }

    return { plantilla, version };
  }

  private parseFechaInicio(value: string | undefined): Date | null {
    if (value === undefined) return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw this.invalidFechaInicio();

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw this.invalidFechaInicio();
    }

    return parsed;
  }

  private invalidFechaInicio(): BadRequestException {
    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      details: { fields: { fechaInicio: 'Debe ser una fecha válida con formato YYYY-MM-DD.' } },
    });
  }

  private plantillaNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Plantilla de contrato no encontrada.',
    });
  }

  private contratoNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Contrato no encontrado.',
    });
  }

  private versionNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Versión de contrato no encontrada.',
    });
  }
}
