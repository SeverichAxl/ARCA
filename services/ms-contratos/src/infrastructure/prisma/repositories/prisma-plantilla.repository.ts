import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type PlantillaContrato,
  type PlantillaVersion,
} from '../../../../prisma/generated/client';
import type { PlantillaRepository } from '../../../domain/templates/template.repository';
import type {
  ContratoVariable,
  CreatePlantillaData,
  Page,
  PlantillaDetalle,
  PlantillaListado,
  PlantillaListQuery,
  UpdatePlantillaData,
} from '../../../domain/templates/template.models';
import { PrismaService } from '../prisma.service';

type PlantillaRow = PlantillaContrato & { versiones: PlantillaVersion[] };

function mapVariables(value: Prisma.JsonValue): ContratoVariable[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ContratoVariable => typeof item === 'string');
}

function mapListado(row: PlantillaContrato): PlantillaListado {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    activa: row.activa,
    versionActual: row.versionActual,
    actualizadoEn: row.actualizadoEn,
  };
}

function mapDetalle(row: PlantillaRow): PlantillaDetalle {
  const current =
    row.versiones.find((version) => version.version === row.versionActual) ?? row.versiones[0];

  return {
    ...mapListado(row),
    contenidoHtml: current?.contenidoHtml ?? '',
    variablesDetectadas: current ? mapVariables(current.variablesDetectadas) : [],
    versiones: row.versiones.map((version) => ({
      id: version.id,
      version: version.version,
      contenidoHtml: version.contenidoHtml,
      variablesDetectadas: mapVariables(version.variablesDetectadas),
      creadoEn: version.creadoEn,
    })),
    creadoEn: row.creadoEn,
  };
}

export function toJsonVariables(variables: ContratoVariable[]): Prisma.InputJsonValue {
  return variables as unknown as Prisma.InputJsonValue;
}

@Injectable()
export class PrismaPlantillaRepository implements PlantillaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PlantillaListQuery): Promise<Page<PlantillaListado>> {
    const where: Prisma.PlantillaContratoWhereInput = {};

    if (query.activa !== undefined) where.activa = query.activa;
    if (query.q) {
      where.nombre = { contains: query.q, mode: 'insensitive' };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.plantillaContrato.findMany({
        where,
        orderBy: { actualizadoEn: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.plantillaContrato.count({ where }),
    ]);

    return { data: rows.map(mapListado), total };
  }

  async findById(id: string): Promise<PlantillaDetalle | null> {
    const row = await this.prisma.plantillaContrato.findUnique({
      where: { id },
      include: { versiones: { orderBy: { version: 'desc' } } },
    });

    return row ? mapDetalle(row) : null;
  }

  async create(data: CreatePlantillaData): Promise<PlantillaDetalle> {
    const row = await this.prisma.plantillaContrato.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        activa: data.activa,
        versionActual: 1,
        creadoPor: data.creadoPor,
        versiones: {
          create: {
            version: 1,
            contenidoHtml: data.contenidoHtml,
            variablesDetectadas: toJsonVariables(data.variablesDetectadas),
            creadoPor: data.creadoPor,
          },
        },
      },
      include: { versiones: { orderBy: { version: 'desc' } } },
    });

    return mapDetalle(row);
  }

  async update(id: string, data: UpdatePlantillaData): Promise<PlantillaDetalle | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.plantillaContrato.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) return null;

      const metadata: Prisma.PlantillaContratoUpdateInput = {};
      if (data.nombre !== undefined) metadata.nombre = data.nombre;
      if (data.descripcion !== undefined) metadata.descripcion = data.descripcion;
      if (data.activa !== undefined) metadata.activa = data.activa;

      if (data.contenidoHtml !== undefined) {
        // El incremento es atómico para que dos actualizaciones concurrentes no
        // generen la misma versión. El contenido histórico nunca se muta.
        const updated = await tx.plantillaContrato.update({
          where: { id },
          data: { ...metadata, versionActual: { increment: 1 } },
          select: { versionActual: true },
        });

        await tx.plantillaVersion.create({
          data: {
            plantillaId: id,
            version: updated.versionActual,
            contenidoHtml: data.contenidoHtml,
            variablesDetectadas: toJsonVariables(data.variablesDetectadas ?? []),
            creadoPor: data.creadoPor,
          },
        });
      } else {
        await tx.plantillaContrato.update({
          where: { id },
          data: metadata,
        });
      }

      const row = await tx.plantillaContrato.findUnique({
        where: { id },
        include: { versiones: { orderBy: { version: 'desc' } } },
      });

      return row ? mapDetalle(row) : null;
    });
  }
}
