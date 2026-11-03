import { Inject, Injectable } from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import type { JwtPayload } from 'common-dtos';
import { Prisma } from '../../../prisma/generated/client';
import { type ArchivoSubido, validarImagenFirma } from '../../common/files/archivo.validator';
import { fechaCampo } from '../../common/validation/validacion';
import { Errores } from '../../domain/errors/domain.error';
import { formatFecha, hoyBolivia } from '../../domain/empleado/fechas';
import { superaLimiteExtranjeros } from '../../domain/empleado/limite-extranjeros';
import { evaluarRatificacion } from '../../domain/empleado/periodo-prueba';
import { DOCUMENT_STORAGE, type DocumentStoragePort } from '../../domain/ports/document-storage.port';
import { PersonalCryptoService } from '../../infrastructure/crypto/personal-crypto.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  CreateEmpleadoDto,
  ListEmpleadosQuery,
  PaginacionQuery,
  RatificarDto,
  UpdateEmpleadoDto,
} from './dto/empleado.dto';
import { payloadEmpleado, registrarAuditoria } from './empleado-eventos';
import { INCLUDE_EMPLEADO, mapEmpleado, puedeVerSueldo } from './empleado.mapper';

const LOCK_ALTA_EXTRANJEROS = 311_001;
const TTL_URL_FIRMA_SEG = 300;

function esUnicoDuplicado(error: unknown, campo: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta?.target ?? '').includes(campo)
  );
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly crypto: PersonalCryptoService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStoragePort,
  ) {}

  async crear(dto: CreateEmpleadoDto, firma: ArchivoSubido | undefined, actor: JwtPayload) {
    if (!firma) throw Errores.firmaRequerida();
    validarImagenFirma(firma);

    const fechaIngreso = fechaCampo('fechaIngreso', dto.fechaIngreso);
    const fechaNacimiento = dto.fechaNacimiento ? fechaCampo('fechaNacimiento', dto.fechaNacimiento) : null;
    const inamovilidad = dto.inamovilidad
      ? {
          tipo: dto.inamovilidad.tipo,
          fechaInicio: fechaCampo('inamovilidad.fechaInicio', dto.inamovilidad.fechaInicio),
          fechaFin: dto.inamovilidad.fechaFin
            ? fechaCampo('inamovilidad.fechaFin', dto.inamovilidad.fechaFin)
            : null,
          observacion: dto.inamovilidad.observacion ?? null,
        }
      : null;
    if (inamovilidad?.fechaFin && inamovilidad.fechaFin < inamovilidad.fechaInicio) {
      throw Errores.validacion({ 'inamovilidad.fechaFin': 'Debe ser igual o posterior a fechaInicio.' });
    }
    if (fechaNacimiento && fechaNacimiento >= fechaIngreso) {
      throw Errores.validacion({ fechaNacimiento: 'Debe ser anterior a la fecha de ingreso.' });
    }

    const ciHash = this.crypto.hashCi(dto.ci);
    const [area, cargo, duplicado] = await Promise.all([
      this.prisma.area.findUnique({ where: { id: dto.areaId } }),
      this.prisma.cargo.findUnique({ where: { id: dto.cargoId } }),
      this.prisma.empleado.findUnique({ where: { ciHash }, select: { id: true } }),
    ]);
    if (!area || !area.activa) {
      throw Errores.noEncontrado({ fields: { areaId: 'El área no existe o está inactiva.' } });
    }
    if (!cargo || !cargo.activo) {
      throw Errores.noEncontrado({ fields: { cargoId: 'El cargo no existe o está inactivo.' } });
    }
    if (duplicado) throw Errores.ciDuplicada();

    const diasPrueba = dto.diasPrueba ?? (await this.diasPruebaPorDefecto());
    const { publicId } = await this.storage.subir({
      buffer: firma.buffer,
      tipo: 'image',
      carpeta: 'firmas',
    });

    try {
      const empleado = await this.prisma.$transaction(async (tx) => {
        if (dto.esExtranjero) await this.verificarLimiteExtranjeros(tx);

        const remuneracionCifrada = this.crypto.cifrarMonto(dto.remuneracion);
        const creado = await tx.empleado.create({
          data: {
            nombres: dto.nombres.trim(),
            apellidos: dto.apellidos.trim(),
            ciCifrado: this.crypto.cifrar(this.crypto.normalizarCi(dto.ci)),
            ciHash,
            ciExpedido: dto.ciExpedido ?? null,
            fechaNacimiento,
            esExtranjero: dto.esExtranjero ?? false,
            email: dto.email ?? null,
            telefono: dto.telefono ?? null,
            direccion: dto.direccion ?? null,
            areaId: dto.areaId,
            cargoId: dto.cargoId,
            remuneracionCifrada,
            fechaIngreso,
            diasPrueba,
            estado: 'EN_PRUEBA',
            firmaPublicId: publicId,
            creadoPor: actor.sub,
          },
        });

        await tx.historialLaboral.create({
          data: {
            empleadoId: creado.id,
            tipo: 'ALTA',
            fechaEfectiva: fechaIngreso,
            motivo: 'Alta de funcionario',
            areaNuevaId: dto.areaId,
            cargoNuevoId: dto.cargoId,
            remuneracionNuevaCifrada: remuneracionCifrada,
            registradoPor: actor.sub,
          },
        });

        if (inamovilidad) {
          await tx.inamovilidadLaboral.create({
            data: {
              ...inamovilidad,
              empleadoId: creado.id,
              estadoActivo: true,
              registradoPor: actor.sub,
            },
          });
        }

        await this.outbox.add(tx, 'EMPLEADO_CREADO', payloadEmpleado(creado, area.jefeId, null));
        await registrarAuditoria(this.outbox, tx, actor, 'EMPLEADO_CREAR', 'Empleado', creado.id, {
          despues: { ...dto, firma: 'adjunta' },
        });

        return tx.empleado.findUniqueOrThrow({ where: { id: creado.id }, include: INCLUDE_EMPLEADO });
      });

      return mapEmpleado(empleado, this.opcionesVista(actor, false), this.crypto);
    } catch (error) {
      try {
        await this.storage.eliminar(publicId, 'image');
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Falló la creación del empleado y la limpieza de su firma.');
      }
      if (esUnicoDuplicado(error, 'ci_hash')) throw Errores.ciDuplicada();
      throw error;
    }
  }

  async listar(query: ListEmpleadosQuery, actor: JwtPayload) {
    const hoy = hoyBolivia();
    const and: Prisma.EmpleadoWhereInput[] = [];

    if (query.nombre?.trim()) {
      for (const palabra of query.nombre.trim().split(/\s+/).slice(0, 5)) {
        and.push({
          OR: [
            { nombres: { contains: palabra, mode: 'insensitive' } },
            { apellidos: { contains: palabra, mode: 'insensitive' } },
          ],
        });
      }
    }
    if (query.ci?.trim()) and.push({ ciHash: this.crypto.hashCi(query.ci) });
    if (query.areaId) and.push({ areaId: query.areaId });
    if (query.cargoId) and.push({ cargoId: query.cargoId });
    if (query.estado) and.push({ estado: query.estado });
    if (query.inamovilidad !== undefined) {
      const vigente: Prisma.EmpleadoWhereInput = {
        inamovilidades: {
          some: {
            estadoActivo: true,
            fechaInicio: { lte: hoy },
            OR: [{ fechaFin: null }, { fechaFin: { gte: hoy } }],
          },
        },
      };
      and.push(query.inamovilidad ? vigente : { NOT: vigente });
    }

    const where: Prisma.EmpleadoWhereInput = and.length ? { AND: and } : {};
    const [total, filas] = await this.prisma.$transaction([
      this.prisma.empleado.count({ where }),
      this.prisma.empleado.findMany({
        where,
        include: INCLUDE_EMPLEADO,
        orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    await this.auditarLectura(actor, 'EMPLEADOS_LISTAR', 'Empleado', '*', {
      filtros: { ...query, ci: query.ci ? query.ci : undefined },
    });

    return {
      data: filas.map((empleado) => mapEmpleado(empleado, this.opcionesVista(actor, false), this.crypto)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async detalle(id: string, actor: JwtPayload) {
    const empleado = await this.prisma.empleado.findUnique({ where: { id }, include: INCLUDE_EMPLEADO });
    if (!empleado) throw Errores.noEncontrado();
    await this.auditarLectura(actor, 'EMPLEADO_CONSULTAR', 'Empleado', id);
    return mapEmpleado(empleado, this.opcionesVista(actor, true), this.crypto);
  }

  async historial(id: string, query: PaginacionQuery, actor: JwtPayload) {
    await this.asegurarExiste(id);
    const verSueldo = puedeVerSueldo(actor.permisos);
    const where = { empleadoId: id };
    const [total, filas] = await this.prisma.$transaction([
      this.prisma.historialLaboral.count({ where }),
      this.prisma.historialLaboral.findMany({
        where,
        orderBy: [{ fechaEfectiva: 'desc' }, { creadoEn: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    await this.auditarLectura(actor, 'EMPLEADO_HISTORIAL_CONSULTAR', 'Empleado', id);
    const monto = (cifrado: string | null) => (cifrado ? this.crypto.descifrarMonto(cifrado) : null);
    return {
      data: filas.map((fila) => ({
        id: fila.id,
        tipo: fila.tipo,
        fechaEfectiva: formatFecha(fila.fechaEfectiva),
        motivo: fila.motivo,
        areaAnteriorId: fila.areaAnteriorId,
        areaNuevaId: fila.areaNuevaId,
        cargoAnteriorId: fila.cargoAnteriorId,
        cargoNuevoId: fila.cargoNuevoId,
        registradoPor: fila.registradoPor,
        creadoEn: fila.creadoEn.toISOString(),
        ...(verSueldo
          ? {
              remuneracionAnterior: monto(fila.remuneracionAnteriorCifrada),
              remuneracionNueva: monto(fila.remuneracionNuevaCifrada),
            }
          : {}),
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async urlFirma(id: string, actor: JwtPayload) {
    const empleado = await this.prisma.empleado.findUnique({
      where: { id },
      select: { firmaPublicId: true },
    });
    if (!empleado) throw Errores.noEncontrado();
    await this.auditarLectura(actor, 'EMPLEADO_FIRMA_CONSULTAR', 'Empleado', id);
    const { url, expiraEn } = this.storage.urlFirmada(empleado.firmaPublicId, 'image', TTL_URL_FIRMA_SEG);
    return { url, expiraEn: expiraEn.toISOString() };
  }

  async modificar(id: string, dto: UpdateEmpleadoDto, actor: JwtPayload) {
    if (dto.areaId === undefined && dto.cargoId === undefined && dto.remuneracion === undefined) {
      throw Errores.validacion({ cambios: 'Envíe al menos uno de areaId, cargoId o remuneracion.' });
    }
    const fechaEfectiva = fechaCampo('fechaEfectiva', dto.fechaEfectiva);

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const actual = await tx.empleado.findUnique({ where: { id }, include: INCLUDE_EMPLEADO });
      if (!actual) throw Errores.noEncontrado();
      if (actual.estado === 'INACTIVO') throw Errores.conflicto('El funcionario está dado de baja.');
      if (fechaEfectiva < actual.fechaIngreso) {
        throw Errores.validacion({ fechaEfectiva: 'No puede ser anterior a la fecha de ingreso.' });
      }

      const data: Prisma.EmpleadoUncheckedUpdateInput = {};
      const movimientos: Omit<
        Prisma.HistorialLaboralCreateManyInput,
        'empleadoId' | 'fechaEfectiva' | 'motivo' | 'registradoPor'
      >[] = [];
      const camposRef: string[] = [];
      let jefeEmpleadoId = actual.area.jefeId;
      const antes: Record<string, unknown> = {};
      const despues: Record<string, unknown> = {};

      if (dto.areaId !== undefined && dto.areaId !== actual.areaId) {
        const area = await tx.area.findUnique({ where: { id: dto.areaId } });
        if (!area || !area.activa) {
          throw Errores.noEncontrado({ fields: { areaId: 'El área no existe o está inactiva.' } });
        }
        data.areaId = area.id;
        jefeEmpleadoId = area.jefeId;
        movimientos.push({ tipo: 'CAMBIO_AREA', areaAnteriorId: actual.areaId, areaNuevaId: area.id });
        camposRef.push('areaId', 'jefeEmpleadoId');
        antes.areaId = actual.areaId;
        despues.areaId = area.id;
      }

      if (dto.cargoId !== undefined && dto.cargoId !== actual.cargoId) {
        const cargo = await tx.cargo.findUnique({ where: { id: dto.cargoId } });
        if (!cargo || !cargo.activo) {
          throw Errores.noEncontrado({ fields: { cargoId: 'El cargo no existe o está inactivo.' } });
        }
        data.cargoId = cargo.id;
        movimientos.push({ tipo: 'CAMBIO_CARGO', cargoAnteriorId: actual.cargoId, cargoNuevoId: cargo.id });
        antes.cargoId = actual.cargoId;
        despues.cargoId = cargo.id;
      }

      if (dto.remuneracion !== undefined) {
        const anterior = this.crypto.descifrarMonto(actual.remuneracionCifrada);
        if (anterior !== Number(dto.remuneracion.toFixed(2))) {
          const nueva = this.crypto.cifrarMonto(dto.remuneracion);
          data.remuneracionCifrada = nueva;
          movimientos.push({
            tipo: 'CAMBIO_REMUNERACION',
            remuneracionAnteriorCifrada: actual.remuneracionCifrada,
            remuneracionNuevaCifrada: nueva,
          });
          antes.remuneracion = anterior;
          despues.remuneracion = dto.remuneracion;
        }
      }

      if (movimientos.length === 0) throw Errores.conflicto('No hay cambios respecto a los datos actuales.');

      const nuevo = await tx.empleado.update({ where: { id }, data, include: INCLUDE_EMPLEADO });
      await tx.historialLaboral.createMany({
        data: movimientos.map((movimiento) => ({
          ...movimiento,
          empleadoId: id,
          fechaEfectiva,
          motivo: dto.motivo,
          registradoPor: actor.sub,
        })),
      });

      if (camposRef.length) {
        await this.outbox.add(tx, 'EMPLEADO_MODIFICADO', {
          ...payloadEmpleado(nuevo, jefeEmpleadoId, null),
          camposModificados: camposRef,
        });
      }
      await registrarAuditoria(this.outbox, tx, actor, 'EMPLEADO_MODIFICAR', 'Empleado', id, {
        antes,
        despues,
        fechaEfectiva: dto.fechaEfectiva,
        motivo: dto.motivo,
      });
      return nuevo;
    });

    return mapEmpleado(actualizado, this.opcionesVista(actor, true), this.crypto);
  }

  async ratificar(id: string, dto: RatificarDto, actor: JwtPayload) {
    const fechaRatificacion = fechaCampo('fechaRatificacion', dto.fechaRatificacion);

    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.empleado.findUnique({
        where: { id },
        include: { area: { select: { jefeId: true } } },
      });
      if (!actual) throw Errores.noEncontrado();
      if (actual.estado !== 'EN_PRUEBA') {
        throw Errores.conflicto(`El funcionario está en estado ${actual.estado}.`);
      }

      const evaluacion = evaluarRatificacion({
        fechaIngreso: actual.fechaIngreso,
        diasPrueba: actual.diasPrueba,
        fechaRatificacion,
        hoy: hoyBolivia(),
      });
      if (!evaluacion.ok && evaluacion.motivo === 'FECHA_FUTURA') {
        throw Errores.validacion({ fechaRatificacion: 'No puede ser posterior a la fecha actual.' });
      }
      if (!evaluacion.ok) {
        throw Errores.ratificacionAnticipada({ ratificableDesde: evaluacion.ratificableDesde });
      }

      const { count } = await tx.empleado.updateMany({
        where: { id, estado: 'EN_PRUEBA' },
        data: { estado: 'RATIFICADO', fechaRatificacion },
      });
      if (count === 0) throw Errores.conflicto('El funcionario ya fue ratificado.');

      await tx.historialLaboral.create({
        data: {
          empleadoId: id,
          tipo: 'RATIFICACION',
          fechaEfectiva: fechaRatificacion,
          motivo: dto.motivo ?? 'Ratificación tras periodo de prueba',
          registradoPor: actor.sub,
        },
      });
      await this.outbox.add(tx, 'EMPLEADO_MODIFICADO', {
        ...payloadEmpleado({ ...actual, estado: 'RATIFICADO' }, actual.area.jefeId, null),
        camposModificados: ['estado'],
      });
      await registrarAuditoria(this.outbox, tx, actor, 'EMPLEADO_RATIFICAR', 'Empleado', id, {
        antes: { estado: 'EN_PRUEBA' },
        despues: { estado: 'RATIFICADO', fechaRatificacion: dto.fechaRatificacion },
      });

      return { id, estado: 'RATIFICADO', fechaRatificacion: dto.fechaRatificacion };
    });
  }

  private opcionesVista(actor: JwtPayload, ciCompleta: boolean) {
    return { verSueldo: puedeVerSueldo(actor.permisos), ciCompleta, hoy: hoyBolivia() };
  }

  private async asegurarExiste(id: string): Promise<void> {
    const existe = await this.prisma.empleado.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw Errores.noEncontrado();
  }

  private async diasPruebaPorDefecto(): Promise<number> {
    const config = await this.prisma.configuracionPersonal.findUnique({
      where: { clave: 'DIAS_PRUEBA_DEFAULT' },
    });
    return Number(config?.valor ?? 90);
  }

  /** Bloqueo transaccional para que altas simultáneas no superen el límite configurado. */
  private async verificarLimiteExtranjeros(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(${LOCK_ALTA_EXTRANJEROS}::bigint)`;
    const vigentes = { estado: { not: 'INACTIVO' as const } };
    const [total, extranjeros, config] = await Promise.all([
      tx.empleado.count({ where: vigentes }),
      tx.empleado.count({ where: { ...vigentes, esExtranjero: true } }),
      tx.configuracionPersonal.findUnique({ where: { clave: 'LIMITE_EXTRANJEROS_PCT' } }),
    ]);
    const limitePct = Number(config?.valor ?? 15);
    if (superaLimiteExtranjeros(total, extranjeros, limitePct)) {
      throw Errores.limiteExtranjeros({
        limitePct,
        totalVigentes: total,
        extranjerosVigentes: extranjeros,
      });
    }
  }

  private async auditarLectura(
    actor: JwtPayload,
    accion: string,
    entidad: string,
    entidadId: string,
    datos?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.$transaction((tx) =>
      registrarAuditoria(this.outbox, tx, actor, accion, entidad, entidadId, datos),
    );
  }
}
