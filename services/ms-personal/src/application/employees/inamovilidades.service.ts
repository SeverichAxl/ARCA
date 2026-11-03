import { Injectable } from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import type { JwtPayload } from 'common-dtos';
import { fechaCampo } from '../../common/validation/validacion';
import { Errores } from '../../domain/errors/domain.error';
import { formatFecha, hoyBolivia } from '../../domain/empleado/fechas';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  CerrarInamovilidadDto,
  InamovilidadDto,
  PaginacionQuery,
} from './dto/empleado.dto';
import { registrarAuditoria } from './empleado-eventos';

type Inamovilidad = {
  id: string;
  empleadoId: string;
  tipo: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  estadoActivo: boolean;
  observacion: string | null;
};

const map = (inamovilidad: Inamovilidad) => ({
  id: inamovilidad.id,
  empleadoId: inamovilidad.empleadoId,
  tipo: inamovilidad.tipo,
  fechaInicio: formatFecha(inamovilidad.fechaInicio),
  fechaFin: inamovilidad.fechaFin ? formatFecha(inamovilidad.fechaFin) : null,
  estadoActivo: inamovilidad.estadoActivo,
  observacion: inamovilidad.observacion,
});

@Injectable()
export class InamovilidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listar(empleadoId: string, query: PaginacionQuery) {
    const existe = await this.prisma.empleado.findUnique({
      where: { id: empleadoId },
      select: { id: true },
    });
    if (!existe) throw Errores.noEncontrado();

    const where = { empleadoId };
    const [total, filas] = await this.prisma.$transaction([
      this.prisma.inamovilidadLaboral.count({ where }),
      this.prisma.inamovilidadLaboral.findMany({
        where,
        orderBy: { fechaInicio: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      data: filas.map(map),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async crear(empleadoId: string, dto: InamovilidadDto, actor: JwtPayload) {
    const fechaInicio = fechaCampo('fechaInicio', dto.fechaInicio);
    const fechaFin = dto.fechaFin ? fechaCampo('fechaFin', dto.fechaFin) : null;
    if (fechaFin && fechaFin < fechaInicio) {
      throw Errores.validacion({ fechaFin: 'Debe ser igual o posterior a fechaInicio.' });
    }

    return this.prisma.$transaction(async (tx) => {
      const empleado = await tx.empleado.findUnique({
        where: { id: empleadoId },
        select: { estado: true },
      });
      if (!empleado) throw Errores.noEncontrado();
      if (empleado.estado === 'INACTIVO') {
        throw Errores.conflicto('El funcionario está dado de baja.');
      }

      const mismoTipoActivo = await tx.inamovilidadLaboral.findFirst({
        where: { empleadoId, tipo: dto.tipo, estadoActivo: true },
        select: { id: true },
      });
      if (mismoTipoActivo) throw Errores.conflicto('Ya existe una inamovilidad activa de ese tipo.');

      const creada = await tx.inamovilidadLaboral.create({
        data: {
          empleadoId,
          tipo: dto.tipo,
          fechaInicio,
          fechaFin,
          observacion: dto.observacion ?? null,
          estadoActivo: true,
          registradoPor: actor.sub,
        },
      });
      await registrarAuditoria(
        this.outbox,
        tx,
        actor,
        'INAMOVILIDAD_ALTA',
        'InamovilidadLaboral',
        creada.id,
        { empleadoId, despues: map(creada) },
      );
      return map(creada);
    });
  }

  async cerrar(
    empleadoId: string,
    inamovilidadId: string,
    dto: CerrarInamovilidadDto,
    actor: JwtPayload,
  ) {
    const fechaFin = fechaCampo('fechaFin', dto.fechaFin);
    if (fechaFin > hoyBolivia()) {
      throw Errores.validacion({ fechaFin: 'No se puede cerrar con una fecha futura.' });
    }

    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.inamovilidadLaboral.findFirst({
        where: { id: inamovilidadId, empleadoId },
      });
      if (!actual) throw Errores.noEncontrado();
      if (!actual.estadoActivo) throw Errores.conflicto('La inamovilidad ya está cerrada.');
      if (fechaFin < actual.fechaInicio) {
        throw Errores.validacion({ fechaFin: 'Debe ser igual o posterior a fechaInicio.' });
      }

      const cerrada = await tx.inamovilidadLaboral.update({
        where: { id: inamovilidadId },
        data: {
          estadoActivo: false,
          fechaFin,
          observacion: dto.observacion ?? actual.observacion,
        },
      });
      await registrarAuditoria(
        this.outbox,
        tx,
        actor,
        'INAMOVILIDAD_CERRAR',
        'InamovilidadLaboral',
        inamovilidadId,
        { empleadoId, antes: map(actual), despues: map(cerrada) },
      );
      return { id: cerrada.id, estadoActivo: false, fechaFin: dto.fechaFin };
    });
  }
}
