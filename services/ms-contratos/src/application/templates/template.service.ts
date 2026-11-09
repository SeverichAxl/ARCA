import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  prepareTemplateContent,
  PlantillaContentError,
  type PreparedTemplateContent,
} from '../../domain/templates/template-content';
import type {
  CreatePlantillaData,
  PlantillaDetalle,
  PlantillaListQuery,
  UpdatePlantillaData,
} from '../../domain/templates/template.models';
import {
  PLANTILLA_REPOSITORY,
  type PlantillaRepository,
} from '../../domain/templates/template.repository';
import type {
  CreatePlantillaDto,
  ListPlantillasQueryDto,
  UpdatePlantillaDto,
} from './template.dto';

export interface PlantillaCreada {
  id: string;
  nombre: string;
  descripcion: string | null;
  variablesDetectadas: PlantillaDetalle['variablesDetectadas'];
  activa: boolean;
  versionActual: number;
  creadoEn: Date;
}

@Injectable()
export class PlantillaService {
  constructor(
    @Inject(PLANTILLA_REPOSITORY)
    private readonly repository: PlantillaRepository,
  ) {}

  async create(dto: CreatePlantillaDto, actorId: string): Promise<PlantillaCreada> {
    const content = this.prepareContent(dto.contenidoHtml);
    const data: CreatePlantillaData = {
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      activa: dto.activa ?? true,
      contenidoHtml: content.contenidoHtml,
      variablesDetectadas: content.variablesDetectadas,
      creadoPor: actorId,
    };

    const created = await this.repository.create(data);

    return {
      id: created.id,
      nombre: created.nombre,
      descripcion: created.descripcion,
      variablesDetectadas: created.variablesDetectadas,
      activa: created.activa,
      versionActual: created.versionActual,
      creadoEn: created.creadoEn,
    };
  }

  async list(query: ListPlantillasQueryDto) {
    const listQuery: PlantillaListQuery = {
      page: query.page,
      pageSize: query.pageSize,
      activa: query.activa,
      q: query.q,
    };
    const result = await this.repository.list(listQuery);

    return {
      data: result.data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async get(id: string): Promise<PlantillaDetalle> {
    const plantilla = await this.repository.findById(id);
    if (!plantilla) throw this.notFound();
    return plantilla;
  }

  async update(id: string, dto: UpdatePlantillaDto, actorId: string): Promise<PlantillaDetalle> {
    const current = await this.repository.findById(id);
    if (!current) throw this.notFound();

    let content: PreparedTemplateContent | undefined;
    if (dto.contenidoHtml !== undefined) {
      content = this.prepareContent(dto.contenidoHtml);
    }

    const newVersion =
      content !== undefined && content.contenidoHtml !== current.contenidoHtml
        ? {
            contenidoHtml: content.contenidoHtml,
            variablesDetectadas: content.variablesDetectadas,
          }
        : {};

    const data: UpdatePlantillaData = {
      ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
      ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
      ...(dto.activa !== undefined ? { activa: dto.activa } : {}),
      ...newVersion,
      creadoPor: actorId,
    };

    const updated = await this.repository.update(id, data);
    if (!updated) throw this.notFound();
    return updated;
  }

  private prepareContent(rawHtml: string): PreparedTemplateContent {
    try {
      return prepareTemplateContent(rawHtml);
    } catch (error) {
      if (error instanceof PlantillaContentError) {
        throw new BadRequestException({
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        });
      }
      throw error;
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Plantilla de contrato no encontrada.',
    });
  }
}
