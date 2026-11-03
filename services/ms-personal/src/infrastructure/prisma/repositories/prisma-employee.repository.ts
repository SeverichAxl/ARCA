import { Injectable } from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import type { Prisma } from '../../../../prisma/generated/client';
import {
  CiDuplicadaError,
  EmpleadoInactivoError,
  type EmployeeRepository,
  type EmployeeTransaction,
} from '../../../domain/employees/employee.repository';
import { toUtcDate } from '../../../domain/common/date-only';
import type {
  BajaRecord,
  CreateBajaData,
  CreateEmpleadoData,
  CreateHistorialData,
  CreateInamovilidadData,
  EmpleadoRecord,
  EmployeeListQuery,
  HistorialListQuery,
  HistorialRecord,
  InamovilidadListQuery,
  InamovilidadRecord,
  Page,
  UpdateEmpleadoData,
} from '../../../domain/employees/employee.models';
import { PrismaService } from '../prisma.service';
import { fromUtcDate } from '../../../domain/common/date-only';

const FOREIGN_LIMIT_LOCK_KEY = 731042;

function fecha(value: Date | null): string | null {
  return value ? fromUtcDate(value) : null;
}

function fechaRequerida(value: Date): string {
  return fromUtcDate(value);
}

function mapEmpleado(row: {
  id: string;
  nombres: string;
  apellidos: string;
  ciCifrado: string;
  ciHash: string;
  ciExpedido: string | null;
  fechaNacimiento: Date | null;
  esExtranjero: boolean;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  areaId: string;
  cargoId: string;
  remuneracionCifrada: string;
  fechaIngreso: Date;
  diasPrueba: number;
  estado: string;
  fechaRatificacion: Date | null;
  firmaPublicId: string;
  creadoPor: string;
  creadoEn: Date;
  actualizadoEn: Date;
}): EmpleadoRecord {
  return {
    ...row,
    fechaNacimiento: fecha(row.fechaNacimiento),
    fechaIngreso: fechaRequerida(row.fechaIngreso),
    fechaRatificacion: fecha(row.fechaRatificacion),
    estado: row.estado as EmpleadoRecord['estado'],
  };
}

function mapInamovilidad(row: {
  id: string;
  empleadoId: string;
  tipo: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  estadoActivo: boolean;
  respaldoPublicId: string | null;
  observacion: string | null;
  registradoPor: string;
  creadoEn: Date;
}): InamovilidadRecord {
  return {
    ...row,
    tipo: row.tipo as InamovilidadRecord['tipo'],
    fechaInicio: fechaRequerida(row.fechaInicio),
    fechaFin: fecha(row.fechaFin),
  };
}

function mapHistorial(row: {
  id: string;
  empleadoId: string;
  tipo: string;
  fechaEfectiva: Date;
  motivo: string | null;
  areaAnteriorId: string | null;
  areaNuevaId: string | null;
  cargoAnteriorId: string | null;
  cargoNuevoId: string | null;
  remuneracionAnteriorCifrada: string | null;
  remuneracionNuevaCifrada: string | null;
  registradoPor: string;
  creadoEn: Date;
}): HistorialRecord {
  return {
    ...row,
    tipo: row.tipo as HistorialRecord['tipo'],
    fechaEfectiva: fechaRequerida(row.fechaEfectiva),
  };
}

function mapBaja(row: {
  id: string;
  empleadoId: string;
  fechaBaja: Date;
  motivo: string;
  aplicaDesahucio: boolean;
  autorizacionMtPublicId: string | null;
  sueldoPromedioCifrado: string;
  finiquitoTotalCifrado: string;
  finiquitoDetalleCifrado: string;
  registradoPor: string;
  creadoEn: Date;
}): BajaRecord {
  return { ...row, fechaBaja: fechaRequerida(row.fechaBaja) };
}

@Injectable()
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  withTransaction<T>(work: (tx: EmployeeTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(this.transaction(tx)));
  }

  async findEmpleadoById(id: string): Promise<EmpleadoRecord | null> {
    const row = await this.prisma.empleado.findUnique({ where: { id } });
    return row ? mapEmpleado(row) : null;
  }

  async findInamovilidadesVigentes(
    empleadoIds: string[],
    fechaReferencia: string,
  ): Promise<InamovilidadRecord[]> {
    if (empleadoIds.length === 0) return [];
    const rows = await this.prisma.inamovilidadLaboral.findMany({
      where: {
        empleadoId: { in: empleadoIds },
        estadoActivo: true,
        fechaInicio: { lte: toUtcDate(fechaReferencia) },
        OR: [
          { fechaFin: null },
          { fechaFin: { gte: toUtcDate(fechaReferencia) } },
        ],
      },
      orderBy: [{ fechaInicio: 'desc' }, { creadoEn: 'desc' }],
    });
    return rows.map(mapInamovilidad);
  }

  async listEmpleados(query: EmployeeListQuery): Promise<Page<EmpleadoRecord>> {
    const where = this.buildWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.empleado.findMany({
        where,
        orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.empleado.count({ where }),
    ]);

    return { data: rows.map(mapEmpleado), total };
  }

  async listHistorial(query: HistorialListQuery): Promise<Page<HistorialRecord>> {
    const where = { empleadoId: query.empleadoId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.historialLaboral.findMany({
        where,
        orderBy: [{ fechaEfectiva: 'desc' }, { creadoEn: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.historialLaboral.count({ where }),
    ]);
    return { data: rows.map(mapHistorial), total };
  }

  async listInamovilidades(query: InamovilidadListQuery): Promise<Page<InamovilidadRecord>> {
    const where = { empleadoId: query.empleadoId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inamovilidadLaboral.findMany({
        where,
        orderBy: [{ fechaInicio: 'desc' }, { creadoEn: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inamovilidadLaboral.count({ where }),
    ]);
    return { data: rows.map(mapInamovilidad), total };
  }

  private buildWhere(query: EmployeeListQuery): Prisma.EmpleadoWhereInput {
    const where: Prisma.EmpleadoWhereInput = {};

    if (query.empleadoId) where.id = query.empleadoId;
    if (query.ciHash) where.ciHash = query.ciHash;
    if (query.cargoId) where.cargoId = query.cargoId;
    if (query.estado) where.estado = query.estado;

    if (query.areaIdsRestringidos) {
      if (query.areaId) {
        where.areaId = query.areaIdsRestringidos.includes(query.areaId)
          ? query.areaId
          : '00000000-0000-0000-0000-000000000000';
      } else {
        where.areaId = { in: query.areaIdsRestringidos };
      }
    } else if (query.areaId) {
      where.areaId = query.areaId;
    }

    if (query.nombre) {
      const tokens = query.nombre
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0)
        .slice(0, 10);
      if (tokens.length > 0) {
        where.AND = tokens.map((token) => ({
          OR: [
            { nombres: { contains: token, mode: 'insensitive' } },
            { apellidos: { contains: token, mode: 'insensitive' } },
          ],
        }));
      }
    }

    if (query.inamovilidad !== undefined) {
      const activa = {
        estadoActivo: true,
        fechaInicio: { lte: toUtcDate(query.fechaReferenciaInamovilidad) },
        OR: [
          { fechaFin: null },
          { fechaFin: { gte: toUtcDate(query.fechaReferenciaInamovilidad) } },
        ],
      };
      where.inamovilidades = query.inamovilidad ? { some: activa } : { none: activa };
    }

    return where;
  }

  private transaction(tx: Prisma.TransactionClient): EmployeeTransaction {
    return {
      findEmpleadoById: async (id, options) => {
        if (options?.forUpdate) {
          await tx.$queryRaw`SELECT id FROM empleado WHERE id = ${id}::uuid FOR UPDATE`;
        }
        const row = await tx.empleado.findUnique({ where: { id } });
        return row ? mapEmpleado(row) : null;
      },

      createEmpleado: async (data: CreateEmpleadoData) => {
        try {
          const row = await tx.empleado.create({
            data: {
              ...data,
              fechaNacimiento: data.fechaNacimiento ? toUtcDate(data.fechaNacimiento) : null,
              fechaIngreso: toUtcDate(data.fechaIngreso),
            },
          });
          return mapEmpleado(row);
        } catch (error) {
          if (this.isUniqueViolation(error)) throw new CiDuplicadaError();
          throw error;
        }
      },

      updateEmpleado: async (id: string, data: UpdateEmpleadoData) => {
        const row = await tx.empleado.update({
          where: { id },
          data: {
            ...(data.areaId === undefined ? {} : { areaId: data.areaId }),
            ...(data.cargoId === undefined ? {} : { cargoId: data.cargoId }),
            ...(data.remuneracionCifrada === undefined
              ? {}
              : { remuneracionCifrada: data.remuneracionCifrada }),
            ...(data.estado === undefined ? {} : { estado: data.estado }),
            ...(data.fechaRatificacion === undefined
              ? {}
              : {
                  fechaRatificacion: data.fechaRatificacion
                    ? toUtcDate(data.fechaRatificacion)
                    : null,
                }),
          },
        });
        return mapEmpleado(row);
      },

      updateEstadoSiActivo: async (id, data) => {
        const result = await tx.empleado.updateMany({
          where: { id, estado: { not: 'INACTIVO' } },
          data: {
            ...(data.estado === undefined ? {} : { estado: data.estado }),
            ...(data.fechaRatificacion === undefined
              ? {}
              : {
                  fechaRatificacion: data.fechaRatificacion
                    ? toUtcDate(data.fechaRatificacion)
                    : null,
                }),
            ...(data.areaId === undefined ? {} : { areaId: data.areaId }),
            ...(data.cargoId === undefined ? {} : { cargoId: data.cargoId }),
            ...(data.remuneracionCifrada === undefined
              ? {}
              : { remuneracionCifrada: data.remuneracionCifrada }),
          },
        });
        return result.count === 1;
      },

      createHistorial: async (data: CreateHistorialData) => {
        await tx.historialLaboral.create({
          data: { ...data, fechaEfectiva: toUtcDate(data.fechaEfectiva) },
        });
      },

      createInamovilidad: async (data: CreateInamovilidadData) => {
        const row = await tx.inamovilidadLaboral.create({
          data: {
            ...data,
            fechaInicio: toUtcDate(data.fechaInicio),
            fechaFin: data.fechaFin ? toUtcDate(data.fechaFin) : null,
          },
        });
        return mapInamovilidad(row);
      },

      listInamovilidadesByEmpleado: async (empleadoId) => {
        const rows = await tx.inamovilidadLaboral.findMany({
          where: { empleadoId },
          orderBy: [{ fechaInicio: 'desc' }, { creadoEn: 'desc' }],
        });
        return rows.map(mapInamovilidad);
      },

      findInamovilidadById: async (id) => {
        const row = await tx.inamovilidadLaboral.findUnique({ where: { id } });
        return row ? mapInamovilidad(row) : null;
      },

      cerrarInamovilidad: async (id, fechaFin, observacion) => {
        const result = await tx.inamovilidadLaboral.updateMany({
          where: { id, estadoActivo: true },
          data: { estadoActivo: false, fechaFin: toUtcDate(fechaFin), observacion },
        });
        return result.count === 1;
      },

      createBaja: async (data: CreateBajaData) => {
        try {
          const row = await tx.baja.create({
            data: { ...data, fechaBaja: toUtcDate(data.fechaBaja) },
          });
          return mapBaja(row);
        } catch (error) {
          if (this.isUniqueViolation(error)) throw new EmpleadoInactivoError();
          throw error;
        }
      },

      getConfig: async (clave) => {
        const row = await tx.configuracionPersonal.findUnique({ where: { clave } });
        return row?.valor ?? null;
      },

      lockLimiteExtranjeros: async () => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${FOREIGN_LIMIT_LOCK_KEY})`;
      },

      countEmpleadosActivos: () =>
        tx.empleado.count({ where: { estado: { not: 'INACTIVO' } } }),

      countExtranjerosActivos: () =>
        tx.empleado.count({
          where: { estado: { not: 'INACTIVO' }, esExtranjero: true },
        }),

      addOutbox: async (eventName, payload) => {
        await this.outbox.add(tx, eventName, payload);
      },
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
