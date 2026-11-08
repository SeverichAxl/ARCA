import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Contrato,
  type ContratoVersion,
  type PlantillaVersion,
} from '../../../../prisma/generated/client';
import type { ContratoRepository } from '../../../domain/contracts/contract.repository';
import type {
  ContratoCreado,
  ContratoDetalle,
  ContratoEmpleadoResumen,
  ContratoVersionDetalle,
  CreateContratoData,
  CreateContratoVersionData,
  EstadoContrato,
  EstadoVersionContrato,
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

function mapVersion(row: ContratoVersion): ContratoVersionDetalle {
  return {
    id: row.id,
    contratoId: row.contratoId,
    plantillaVersionId: row.plantillaVersionId,
    version: row.version,
    estado: row.estado as EstadoVersionContrato,
    documentoPublicId: row.documentoPublicId,
    documentoVersion: row.documentoVersion,
    documentoMime: row.documentoMime,
    documentoBytes: row.documentoBytes,
    hashSha256: row.hashSha256,
    firmadoTrabajador: row.firmadoTrabajador,
    firmadoRepresentante: row.firmadoRepresentante,
    firmaTrabajadorRef: row.firmaTrabajadorRef,
    firmaTrabajadorVersion: row.firmaTrabajadorVersion,
    firmaTrabajadorMime: row.firmaTrabajadorMime,
    firmaTrabajadorBytes: row.firmaTrabajadorBytes,
    firmaRepresentanteRef: row.firmaRepresentanteRef,
    firmaRepresentanteVersion: row.firmaRepresentanteVersion,
    firmaRepresentanteMime: row.firmaRepresentanteMime,
    firmaRepresentanteBytes: row.firmaRepresentanteBytes,
    generadoPor: row.generadoPor,
    generadoEn: row.generadoEn,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
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

  async findByEmpleadoId(empleadoId: string): Promise<ContratoEmpleadoResumen[]> {
    const rows = await this.prisma.contrato.findMany({
      where: { empleadoId },
      include: {
        plantilla: { select: { nombre: true } },
        plantillaVersion: { select: { version: true } },
        versiones: { orderBy: { version: 'desc' } },
      },
      orderBy: { creadoEn: 'desc' },
    });

    return rows.map((row) => {
      const versiones = row.versiones.map((version) => ({
        id: version.id,
        version: version.version,
        estado: version.estado as EstadoVersionContrato,
        hashSha256: version.hashSha256,
        firmadoTrabajador: version.firmadoTrabajador,
        firmadoRepresentante: version.firmadoRepresentante,
        creadoEn: version.generadoEn,
        documento: version.documentoPublicId
          ? {
              publicIdRef: `${row.id}/v${version.version}`,
              versionId: version.id,
              mime: version.documentoMime,
              bytes: version.documentoBytes,
            }
          : null,
      }));
      const versionVigente = versiones[0]?.version ?? null;

      return {
        id: row.id,
        empleadoId: row.empleadoId,
        plantillaId: row.plantillaId,
        plantillaNombre: row.plantilla.nombre,
        plantillaVersion: row.plantillaVersion.version,
        estado: row.estado as EstadoContrato,
        versionVigente,
        versiones,
        creadoEn: row.creadoEn,
      };
    });
  }

  async findLatestVersion(contratoId: string): Promise<ContratoVersionDetalle | null> {
    const row = await this.prisma.contratoVersion.findFirst({
      where: { contratoId },
      orderBy: { version: 'desc' },
    });

    return row ? mapVersion(row) : null;
  }

  async findVersion(
    contratoId: string,
    versionId: string,
  ): Promise<ContratoVersionDetalle | null> {
    const row = await this.prisma.contratoVersion.findFirst({
      where: { id: versionId, contratoId },
    });

    return row ? mapVersion(row) : null;
  }

  async createVersion(
    data: CreateContratoVersionData,
  ): Promise<ContratoVersionDetalle> {
    // La restricción @@unique([contratoId, version]) protege la inmutabilidad
    // ante dos peticiones concurrentes. Reintentamos recalculando MAX(version).
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const latest = await tx.contratoVersion.aggregate({
            where: { contratoId: data.contratoId },
            _max: { version: true },
          });
          const nextVersion = (latest._max.version ?? 0) + 1;

          const row = await tx.contratoVersion.create({
            data: {
              contratoId: data.contratoId,
              plantillaVersionId: data.plantillaVersionId,
              version: nextVersion,
              estado: data.estado,
              documentoPublicId: data.documentoPublicId,
              documentoVersion: data.documentoVersion,
              documentoMime: data.documentoMime,
              documentoBytes: data.documentoBytes,
              hashSha256: data.hashSha256,
              firmadoTrabajador: data.firmadoTrabajador,
              firmadoRepresentante: data.firmadoRepresentante,
              firmaTrabajadorRef: data.firmaTrabajadorRef,
              firmaTrabajadorVersion: data.firmaTrabajadorVersion,
              firmaTrabajadorMime: data.firmaTrabajadorMime,
              firmaTrabajadorBytes: data.firmaTrabajadorBytes,
              firmaRepresentanteRef: data.firmaRepresentanteRef,
              firmaRepresentanteVersion: data.firmaRepresentanteVersion,
              firmaRepresentanteMime: data.firmaRepresentanteMime,
              firmaRepresentanteBytes: data.firmaRepresentanteBytes,
              generadoPor: data.generadoPor,
            },
          });

          await tx.contrato.update({
            where: { id: data.contratoId },
            data: { estado: data.estadoContrato },
          });

          return mapVersion(row);
        });
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 2) continue;
        throw error;
      }
    }

    throw new Error('No se pudo crear la versión del contrato.');
  }
}
