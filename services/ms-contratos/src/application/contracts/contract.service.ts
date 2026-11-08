import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AuditContext } from '@arca/audit';
import type { InternalPrincipal } from '@arca/internal-auth';
import {
  renderContratoTemplate,
  toContratoVariables,
} from '../../domain/contracts/contract-render';
import type {
  ContratoCreado,
  PreviewContrato,
} from '../../domain/contracts/contract.models';
import {
  CONTRATO_REPOSITORY,
  type ContratoRepository,
} from '../../domain/contracts/contract.repository';
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

@Injectable()
export class ContractService {
  constructor(
    @Inject(PLANTILLA_REPOSITORY)
    private readonly plantillas: PlantillaRepository,
    @Inject(CONTRATO_REPOSITORY)
    private readonly contratos: ContratoRepository,
    @Inject(PERSONAL_DATA_PORT)
    private readonly personal: PersonalDataPort,
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
}
