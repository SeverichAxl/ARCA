import { Inject, Injectable } from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import type { JwtPayload } from 'common-dtos';
import { Prisma } from '../../../prisma/generated/client';
import { type ArchivoSubido, validarPdf } from '../../common/files/archivo.validator';
import { fechaCampo } from '../../common/validation/validacion';
import { Errores } from '../../domain/errors/domain.error';
import { formatFecha, hoyBolivia } from '../../domain/empleado/fechas';
import { calcularFiniquito, type DetalleFiniquito } from '../../domain/empleado/finiquito';
import { inamovilidadVigente } from '../../domain/empleado/inamovilidad';
import { DOCUMENT_STORAGE, type DocumentStoragePort } from '../../domain/ports/document-storage.port';
import { PersonalCryptoService } from '../../infrastructure/crypto/personal-crypto.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BajaDto } from './dto/empleado.dto';
import { payloadEmpleado, registrarAuditoria } from './empleado-eventos';
import { puedeVerSueldo } from './empleado.mapper';

type EmpleadoBaja = Prisma.EmpleadoGetPayload<{
  include: {
    area: { select: { jefeId: true } };
    inamovilidades: true;
    baja: { select: { id: true } };
  };
}>;

@Injectable()
export class BajasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly crypto: PersonalCryptoService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStoragePort,
  ) {}

  /** Previsualiza el finiquito y las protecciones laborales sin persistir cambios. */
  async previsualizar(id: string, dto: BajaDto, actor: JwtPayload) {
    const empleado = await this.cargarEmpleado(id);
    const fechaBaja = this.validarFechaBaja(empleado, dto);
    const vigentes = this.inamovilidadesVigentes(empleado, fechaBaja);
    const finiquito = this.calcular(empleado, dto, fechaBaja);

    return {
      empleadoId: id,
      fechaBaja: dto.fechaBaja,
      bloqueadaPorInamovilidad: vigentes.length > 0,
      requiereAutorizacionMinisterio: vigentes.length > 0,
      inamovilidades: vigentes.map((inamovilidad) => ({
        tipo: inamovilidad.tipo,
        fechaInicio: formatFecha(inamovilidad.fechaInicio),
        fechaFin: inamovilidad.fechaFin ? formatFecha(inamovilidad.fechaFin) : null,
      })),
      ...(puedeVerSueldo(actor.permisos) ? { finiquito } : {}),
    };
  }

  async registrar(
    id: string,
    dto: BajaDto,
    autorizacion: ArchivoSubido | undefined,
    actor: JwtPayload,
  ) {
    if (autorizacion) validarPdf(autorizacion);

    const empleado = await this.cargarEmpleado(id);
    const fechaBaja = this.validarFechaBaja(empleado, dto);
    const vigentes = this.inamovilidadesVigentes(empleado, fechaBaja);

    if (vigentes.length > 0 && !autorizacion) {
      throw Errores.inamovilidadActiva({
        inamovilidades: vigentes.map((inamovilidad) => ({
          tipo: inamovilidad.tipo,
          fechaInicio: formatFecha(inamovilidad.fechaInicio),
        })),
        requiere: 'autorizacionMinisterio (PDF)',
      });
    }

    const finiquito = this.calcular(empleado, dto, fechaBaja);
    const autorizacionId =
      vigentes.length > 0 && autorizacion
        ? (
            await this.storage.subir({
              buffer: autorizacion.buffer,
              tipo: 'raw',
              carpeta: 'autorizaciones-mt',
            })
          ).publicId
        : null;

    try {
      const baja = await this.prisma.$transaction(async (tx) => {
        const inamovilidadesTx = await tx.inamovilidadLaboral.findMany({
          where: { empleadoId: id, estadoActivo: true },
        });
        const hoy = hoyBolivia();
        const bloqueaTx = inamovilidadesTx.some(
          (inamovilidad) =>
            inamovilidadVigente(inamovilidad, fechaBaja) || inamovilidadVigente(inamovilidad, hoy),
        );
        if (bloqueaTx && !autorizacionId) {
          throw Errores.inamovilidadActiva({ requiere: 'autorizacionMinisterio (PDF)' });
        }

        const { count } = await tx.empleado.updateMany({
          where: { id, estado: { not: 'INACTIVO' } },
          data: { estado: 'INACTIVO' },
        });
        if (count === 0) throw Errores.conflicto('El funcionario ya fue dado de baja.');

        const creada = await tx.baja.create({
          data: {
            empleadoId: id,
            fechaBaja,
            motivo: dto.motivo.trim(),
            aplicaDesahucio: dto.aplicaDesahucio,
            autorizacionMtPublicId: autorizacionId,
            sueldoPromedioCifrado: this.crypto.cifrarMonto(finiquito.sueldoPromedioIndemnizable),
            finiquitoTotalCifrado: this.crypto.cifrarMonto(finiquito.total),
            finiquitoDetalleCifrado: this.crypto.cifrar(JSON.stringify(finiquito)),
            registradoPor: actor.sub,
          },
        });

        await tx.historialLaboral.create({
          data: {
            empleadoId: id,
            tipo: 'BAJA',
            fechaEfectiva: fechaBaja,
            motivo: dto.motivo.trim(),
            areaAnteriorId: empleado.areaId,
            cargoAnteriorId: empleado.cargoId,
            remuneracionAnteriorCifrada: empleado.remuneracionCifrada,
            registradoPor: actor.sub,
          },
        });

        await this.outbox.add(
          tx,
          'EMPLEADO_DADO_DE_BAJA',
          payloadEmpleado({ ...empleado, estado: 'INACTIVO' }, empleado.area.jefeId, fechaBaja),
        );
        await registrarAuditoria(this.outbox, tx, actor, 'EMPLEADO_DAR_DE_BAJA', 'Empleado', id, {
          antes: { estado: empleado.estado },
          despues: { estado: 'INACTIVO', fechaBaja: dto.fechaBaja, motivo: dto.motivo },
          aplicaDesahucio: dto.aplicaDesahucio,
          conAutorizacionMinisterio: Boolean(autorizacionId),
          finiquitoTotal: finiquito.total,
        });
        return creada;
      });

      return {
        id: baja.id,
        empleadoId: id,
        fechaBaja: dto.fechaBaja,
        estado: 'INACTIVO',
        finiquitoRegistrado: true,
        ...(puedeVerSueldo(actor.permisos) ? { finiquito } : {}),
      };
    } catch (error) {
      if (autorizacionId) {
        try {
          await this.storage.eliminar(autorizacionId, 'raw');
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            'Falló el registro de la baja y la limpieza de la autorización ministerial.',
          );
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw Errores.conflicto('El funcionario ya fue dado de baja.');
      }
      throw error;
    }
  }

  private async cargarEmpleado(id: string): Promise<EmpleadoBaja> {
    const empleado = await this.prisma.empleado.findUnique({
      where: { id },
      include: {
        area: { select: { jefeId: true } },
        inamovilidades: true,
        baja: { select: { id: true } },
      },
    });
    if (!empleado) throw Errores.noEncontrado();
    if (empleado.estado === 'INACTIVO' || empleado.baja) {
      throw Errores.conflicto('El funcionario ya fue dado de baja.');
    }
    return empleado;
  }

  private validarFechaBaja(empleado: EmpleadoBaja, dto: BajaDto): Date {
    const fechaBaja = fechaCampo('fechaBaja', dto.fechaBaja);
    if (fechaBaja < empleado.fechaIngreso) {
      throw Errores.validacion({ fechaBaja: 'No puede ser anterior a la fecha de ingreso.' });
    }
    return fechaBaja;
  }

  /** Una protección vigente hoy o en la fecha efectiva impide la baja sin autorización. */
  private inamovilidadesVigentes(empleado: EmpleadoBaja, fechaBaja: Date) {
    const hoy = hoyBolivia();
    return empleado.inamovilidades.filter(
      (inamovilidad) =>
        inamovilidadVigente(inamovilidad, fechaBaja) || inamovilidadVigente(inamovilidad, hoy),
    );
  }

  private calcular(empleado: EmpleadoBaja, dto: BajaDto, fechaBaja: Date): DetalleFiniquito {
    const sueldos = dto.sueldosUltimosMeses?.length
      ? dto.sueldosUltimosMeses
      : [this.crypto.descifrarMonto(empleado.remuneracionCifrada)];
    return calcularFiniquito({
      fechaIngreso: empleado.fechaIngreso,
      fechaBaja,
      sueldos,
      aplicaDesahucio: dto.aplicaDesahucio,
      diasVacacionPendientes: dto.diasVacacionPendientes ?? 0,
    });
  }
}
