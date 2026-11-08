import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Contrato,
  type PlantillaVersion,
} from '../../../../prisma/generated/client';
import type { ContratoRepository } from '../../../domain/contracts/contract.repository';
import type {
  ContratoCreado,
  ContratoDetalle,
  CreateContratoData,
  EstadoContrato,
} from '../../../domain/contracts/contract.models';
import type { ContratoVariable } from '../../../domain/templates/template.models';
import { PrismaService } from '../prisma.service';

type ContratoRow = Contrato & { plantillaVersion: PlantillaVersion };

function mapVariables(value: Prisma.JsonValue): ContratoVariable[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ContratoVariable => typeof item === 'string');
}

function mapCreado(row: ContratoRow): ContratoCreado {
  return {
    id: row.id,
    empleadoId: row.empleadoId,
    plantillaId: row.plantillaId,
    plantillaVersion: row.plantillaVersion.version,
    estado: row.estado as EstadoContrato,
    creadoEn: row.creadoEn,
  };
}

function mapDetalle(row: ContratoRow): ContratoDetalle {
  return {
    id: row.id,
    empleadoId: row.empleadoId,
    plantillaId: row.plantillaId,
    plantillaVersionId: row.plantillaVersionId,
    plantillaVersion: {
      id: row.plantillaVersion.id,
      version: row.plantillaVersion.version,
      contenidoHtml: row.plantillaVersion.contenidoHtml,
      variablesDetectadas: mapVariables(row.plantillaVersion.variablesDetectadas),
    },
    estado: row.estado as EstadoContrato,
    fechaInicio: row.fechaInicio,
    observacion: row.observacion,
    creadoEn: row.creadoEn,
  };
}

@Injectable()
export class PrismaContratoRepository implements ContratoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateContratoData): Promise<ContratoCreado> {
    const row = await this.prisma.contrato.create({
      data: {
        empleadoId: data.empleadoId,
        plantillaId: data.plantillaId,
        plantillaVersionId: data.plantillaVersionId,
        estado: 'BORRADOR',
        fechaInicio: data.fechaInicio,
        observacion: data.observacion,
        empleadoSnapshot: data.empleadoSnapshot as Prisma.InputJsonValue,
        creadoPor: data.creadoPor,
      },
      include: { plantillaVersion: true },
    });

    return mapCreado(row);
  }

  async findById(id: string): Promise<ContratoDetalle | null> {
    const row = await this.prisma.contrato.findUnique({
      where: { id },
      include: { plantillaVersion: true },
    });

    return row ? mapDetalle(row) : null;
  }
}
