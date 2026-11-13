import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { InternalPrincipal } from '@arca/internal-auth';
import {
  addDays,
  compareDateOnly,
  isDateOnly,
} from '../../domain/common/date-only';
import type { Clock } from '../../domain/common/clock';
import { CLOCK } from '../../domain/common/clock';
import { normalizeMoney, parseMoneyToCents } from '../../domain/common/money';
import { calcularFiniquito, validarFechasFiniquito } from '../../domain/employees/finiquito';
import { CiInvalidaError, normalizarCi, maskCi } from '../../domain/employees/ci';
import {
  algunaInamovilidadActiva,
  type TipoInamovilidad,
} from '../../domain/employees/inamovilidad';
import {
  excedeLimiteExtranjeros,
} from '../../domain/employees/foreign-limit';
import {
  validarAutorizacionMinisterio,
  validarFirma,
  validarRespaldo,
  ArchivoInvalidoError,
  type ArchivoEntrante,
} from '../../domain/employees/file-validation';
import {
  CiDuplicadaError,
  EmpleadoInactivoError,
  EMPLOYEE_REPOSITORY,
  type EmployeeRepository,
} from '../../domain/employees/employee.repository';
import type {
  CreateHistorialData,
  EmpleadoRecord,
  EmployeeListQuery,
} from '../../domain/employees/employee.models';
import type { OutboxPayload } from '../../domain/employees/employee.repository';
import {
  FILE_STORAGE_PORT,
  type ArchivoLogico,
  type FileStoragePort,
} from '../../domain/employees/file-storage.port';
import {
  ORG_CATALOG_PORT,
  type OrgCatalogPort,
} from '../../domain/employees/org-catalog.port';
import { PersonalCryptoService } from '../../infrastructure/crypto/personal-crypto.service';
import type {
  BajaDatosDto,
  CerrarInamovilidadDto,
  CreateEmployeeDatosDto,
  CreateInamovilidadDto,
  ListEmployeesQueryDto,
  RatifyEmployeeDto,
  SimularBajaDto,
  UpdateEmployeeDto,
} from './employee.dto';

const DATE_ERROR = {
  code: 'VALIDATION_ERROR',
  message: 'Uno o más campos no son válidos.',
};

interface StoredFile {
  publicId: string;
  kind: ArchivoLogico;
}

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    private readonly repository: EmployeeRepository,
    @Inject(ORG_CATALOG_PORT)
    private readonly catalogs: OrgCatalogPort,
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
    @Inject(CLOCK)
    private readonly clock: Clock,
    private readonly crypto: PersonalCryptoService,
  ) {}

  async create(
    dto: CreateEmployeeDatosDto,
    firma: ArchivoEntrante | undefined,
    principal: InternalPrincipal,
  ) {
    if (!firma) {
      throw new BadRequestException({
        code: 'PERS_FIRMA_REQUERIDA',
        message: 'La firma digitalizada es obligatoria.',
      });
    }
    this.validateFile(firma, validarFirma);
    this.validateDate(dto.fechaIngreso, 'fechaIngreso');
    this.validateMoney(dto.remuneracion);
    const ci = this.normalizeCi(dto.ci);
    await this.requireActiveCatalogs(dto.areaId, dto.cargoId);
    if (dto.fechaNacimiento) this.validateDate(dto.fechaNacimiento, 'fechaNacimiento');
    if (dto.inamovilidad) this.validateInamovilidadDates(dto.inamovilidad);

    const stored: StoredFile[] = [];
    try {
      const firmaPublicId = await this.storage.upload({
        buffer: firma.buffer,
        originalName: firma.originalname,
        mimetype: firma.mimetype ?? 'application/octet-stream',
        kind: 'firma',
      });
      stored.push({ publicId: firmaPublicId, kind: 'firma' });

      const created = await this.repository.withTransaction(async (tx) => {
        await tx.lockLimiteExtranjeros();
        const [limite, diasDefault, activos, extranjeros] = await Promise.all([
          tx.getConfig('LIMITE_EXTRANJEROS_PCT'),
          tx.getConfig('DIAS_PRUEBA_DEFAULT'),
          tx.countEmpleadosActivos(),
          tx.countExtranjerosActivos(),
        ]);
        if (limite === null || diasDefault === null) {
          throw new InternalServerErrorException({
            code: 'INTERNAL_ERROR',
            message: 'Falta la configuración requerida de personal.',
          });
        }
        const diasPrueba = dto.diasPrueba ?? Number(diasDefault);
        if (!Number.isInteger(diasPrueba) || diasPrueba < 0 || diasPrueba > 90) {
          throw new InternalServerErrorException({
            code: 'INTERNAL_ERROR',
            message: 'La configuración de días de prueba no es válida.',
          });
        }
        if (
          excedeLimiteExtranjeros({
            activos,
            extranjerosActivos: extranjeros,
            limitePct: limite,
            nuevoEsExtranjero: dto.esExtranjero ?? false,
          })
        ) {
          throw new ConflictException({
            code: 'PERS_LIMITE_EXTRANJEROS',
            message: 'La operación superaría el límite de funcionarios extranjeros.',
          });
        }

        const employee = await tx.createEmpleado({
          nombres: dto.nombres,
          apellidos: dto.apellidos,
          ciCifrado: this.crypto.encrypt(ci),
          ciHash: this.crypto.hashCi(ci),
          ciExpedido: dto.ciExpedido ?? null,
          fechaNacimiento: dto.fechaNacimiento ?? null,
          esExtranjero: dto.esExtranjero ?? false,
          email: dto.email ?? null,
          telefono: dto.telefono ?? null,
          direccion: dto.direccion ?? null,
          areaId: dto.areaId,
          cargoId: dto.cargoId,
          remuneracionCifrada: this.crypto.encrypt(normalizeMoney(dto.remuneracion)),
          fechaIngreso: dto.fechaIngreso,
          diasPrueba,
          estado: 'EN_PRUEBA',
          firmaPublicId,
          creadoPor: principal.userId,
        });

        const alta: CreateHistorialData = {
          empleadoId: employee.id,
          tipo: 'ALTA',
          fechaEfectiva: employee.fechaIngreso,
          motivo: 'Alta de funcionario',
          areaAnteriorId: null,
          areaNuevaId: employee.areaId,
          cargoAnteriorId: null,
          cargoNuevoId: employee.cargoId,
          remuneracionAnteriorCifrada: null,
          remuneracionNuevaCifrada: employee.remuneracionCifrada,
          registradoPor: principal.userId,
        };
        await tx.createHistorial(alta);

        if (dto.inamovilidad) {
          await tx.createInamovilidad({
            empleadoId: employee.id,
            tipo: dto.inamovilidad.tipo as TipoInamovilidad,
            fechaInicio: dto.inamovilidad.fechaInicio,
            fechaFin: dto.inamovilidad.fechaFin ?? null,
            estadoActivo: true,
            respaldoPublicId: null,
            observacion: dto.inamovilidad.observacion ?? null,
            registradoPor: principal.userId,
          });
        }

        await tx.addOutbox('EMPLEADO_CREADO', await this.eventPayload(employee));
        return employee;
      });
      return this.presentEmployee(created, principal);
    } catch (error) {
      await this.deleteStoredFiles(stored);
      if (error instanceof CiDuplicadaError) {
        throw new ConflictException({
          code: 'PERS_CI_DUPLICADA',
          message: 'Ya existe un funcionario con ese CI.',
        });
      }
      throw error;
    }
  }

  async list(query: ListEmployeesQueryDto, principal: InternalPrincipal) {
    if (principal.rol === 'FUNCIONARIO' && !principal.empleadoId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tiene permiso para realizar esta operación.',
      });
    }
    const ciHash = query.ci === undefined
      ? undefined
      : this.crypto.hashCi(this.normalizeCi(query.ci));
    const areaIdsRestringidos =
      principal.rol === 'JEFE_AREA'
        ? await this.catalogs.findAreaIdsLedBy(principal.empleadoId ?? '')
        : undefined;
    const employeeId = principal.rol === 'FUNCIONARIO' ? principal.empleadoId ?? undefined : undefined;
    const input: EmployeeListQuery = {
      ...(employeeId ? { empleadoId: employeeId } : {}),
      ...(query.nombre ? { nombre: query.nombre } : {}),
      ...(ciHash ? { ciHash } : {}),
      ...(query.areaId ? { areaId: query.areaId } : {}),
      ...(areaIdsRestringidos ? { areaIdsRestringidos } : {}),
      ...(query.cargoId ? { cargoId: query.cargoId } : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.inamovilidad === undefined ? {} : { inamovilidad: query.inamovilidad }),
      fechaReferenciaInamovilidad: this.clock.today(),
      page: query.page,
      pageSize: query.pageSize,
    };
    const result = await this.repository.listEmpleados(input);
    return {
      data: await Promise.all(
        result.data.map((employee) =>
          this.presentEmployee(employee, principal),
        ),
      ),
      meta: this.pageMeta(result.total, query.page, query.pageSize),
    };
  }

  async get(id: string, principal: InternalPrincipal) {
    const employee = await this.requireEmployee(id);
    await this.assertVisible(employee, principal);
    const fueros = await this.repository.findInamovilidadesVigentes(
      [id],
      this.clock.today(),
    );
    return this.presentEmployee(employee, principal, fueros.length > 0);
  }

  async getFirmaUrl(id: string, principal: InternalPrincipal) {
    const employee = await this.requireEmployee(id);
    await this.assertVisible(employee, principal);
    return {
      url: await this.storage.signedUrl(employee.firmaPublicId, 'firma'),
      expiresInSeconds: 300,
    };
  }

  /**
   * Interfaz interna autorizada para ms-contratos (HU-18). Devuelve solo los
   * campos que resuelven las variables de la plantilla. La remuneración se
   * omite si el actor no tiene `personal:read_salary`.
   */
  async getContractData(id: string, principal: InternalPrincipal) {
    const employee = await this.requireEmployee(id);
    await this.assertVisible(employee, principal);

    const cargo = await this.catalogs.findCargo(employee.cargoId);
    if (!cargo) throw this.notFound();

    return {
      empleadoId: employee.id,
      nombre_empleado: `${employee.nombres} ${employee.apellidos}`.trim(),
      ci: this.crypto.decrypt(employee.ciCifrado),
      cargo: cargo.nombre,
      fecha_ingreso: employee.fechaIngreso,
      duracion_prueba: `${employee.diasPrueba} días`,
      ...(this.canReadSalary(principal)
        ? { remuneracion: this.crypto.decrypt(employee.remuneracionCifrada) }
        : {}),
    };
  }

  async listHistory(id: string, page: number, pageSize: number, principal: InternalPrincipal) {
    const employee = await this.requireEmployee(id);
    await this.assertVisible(employee, principal);
    const result = await this.repository.listHistorial({ empleadoId: id, page, pageSize });
    const canReadSalary = this.canReadSalary(principal);
    return {
      data: result.data.map((item) => ({
        id: item.id,
        tipo: item.tipo,
        fechaEfectiva: item.fechaEfectiva,
        motivo: item.motivo,
        areaAnteriorId: item.areaAnteriorId,
        areaNuevaId: item.areaNuevaId,
        cargoAnteriorId: item.cargoAnteriorId,
        cargoNuevoId: item.cargoNuevoId,
        ...(canReadSalary
          ? {
              remuneracionAnterior: item.remuneracionAnteriorCifrada
                ? this.crypto.decrypt(item.remuneracionAnteriorCifrada)
                : null,
              remuneracionNueva: item.remuneracionNuevaCifrada
                ? this.crypto.decrypt(item.remuneracionNuevaCifrada)
                : null,
            }
          : {}),
      })),
      meta: this.pageMeta(result.total, page, pageSize),
    };
  }

  async update(id: string, dto: UpdateEmployeeDto, principal: InternalPrincipal) {
    const current = await this.requireEmployee(id);
    await this.assertVisible(current, principal);
    if (principal.rol === 'FUNCIONARIO' && principal.empleadoId === id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tiene permiso para realizar esta operación.',
      });
    }
    this.validateDate(dto.fechaEfectiva, 'fechaEfectiva');
    if (
      compareDateOnly(dto.fechaEfectiva, current.fechaIngreso) < 0 ||
      compareDateOnly(dto.fechaEfectiva, this.clock.today()) > 0
    ) {
      throw this.validationError('fechaEfectiva', 'Debe estar entre la fecha de ingreso y hoy.');
    }
    if (dto.remuneracion !== undefined) this.validateMoney(dto.remuneracion);
    if (dto.areaId !== undefined || dto.cargoId !== undefined) {
      await this.requireActiveCatalogs(dto.areaId ?? current.areaId, dto.cargoId ?? current.cargoId);
    }

    return this.repository.withTransaction(async (tx) => {
      const locked = await tx.findEmpleadoById(id, { forUpdate: true });
      if (!locked) throw this.notFound();
      if (locked.estado === 'INACTIVO') throw this.inactiveConflict();

      const previousSalary = this.crypto.decrypt(locked.remuneracionCifrada);
      const nextSalary = dto.remuneracion === undefined
        ? undefined
        : normalizeMoney(dto.remuneracion);
      const changes = {
        area: dto.areaId !== undefined && dto.areaId !== locked.areaId,
        cargo: dto.cargoId !== undefined && dto.cargoId !== locked.cargoId,
        salary: nextSalary !== undefined && nextSalary !== previousSalary,
      };
      if (!changes.area && !changes.cargo && !changes.salary) {
        throw this.validationError('body', 'Debe indicar al menos un cambio efectivo.');
      }

      const nextEncryptedSalary = changes.salary && nextSalary
        ? this.crypto.encrypt(nextSalary)
        : undefined;
      const update = {
        ...(changes.area ? { areaId: dto.areaId } : {}),
        ...(changes.cargo ? { cargoId: dto.cargoId } : {}),
        ...(changes.salary && nextEncryptedSalary
          ? { remuneracionCifrada: nextEncryptedSalary }
          : {}),
      };
      const updated = await tx.updateEmpleado(id, update);
      const historyBase = {
        empleadoId: id,
        fechaEfectiva: dto.fechaEfectiva,
        motivo: dto.motivo,
        registradoPor: principal.userId,
      };
      if (changes.area) {
        await tx.createHistorial({
          ...historyBase,
          tipo: 'CAMBIO_AREA',
          areaAnteriorId: locked.areaId,
          areaNuevaId: dto.areaId ?? locked.areaId,
          cargoAnteriorId: null,
          cargoNuevoId: null,
          remuneracionAnteriorCifrada: null,
          remuneracionNuevaCifrada: null,
        });
      }
      if (changes.cargo) {
        await tx.createHistorial({
          ...historyBase,
          tipo: 'CAMBIO_CARGO',
          areaAnteriorId: null,
          areaNuevaId: null,
          cargoAnteriorId: locked.cargoId,
          cargoNuevoId: dto.cargoId ?? locked.cargoId,
          remuneracionAnteriorCifrada: null,
          remuneracionNuevaCifrada: null,
        });
      }
      if (changes.salary && nextEncryptedSalary) {
        await tx.createHistorial({
          ...historyBase,
          tipo: 'CAMBIO_REMUNERACION',
          areaAnteriorId: null,
          areaNuevaId: null,
          cargoAnteriorId: null,
          cargoNuevoId: null,
          remuneracionAnteriorCifrada: locked.remuneracionCifrada,
          remuneracionNuevaCifrada: nextEncryptedSalary,
        });
      }
      await tx.addOutbox('EMPLEADO_MODIFICADO', {
        ...(await this.eventPayload(updated)),
        camposModificados: [
          ...(changes.area ? ['areaId'] : []),
          ...(changes.cargo ? ['cargoId'] : []),
          ...(changes.salary ? ['remuneracion'] : []),
        ],
      });
      return this.presentEmployee(updated, principal);
    });
  }

  async ratify(id: string, dto: RatifyEmployeeDto, principal: InternalPrincipal) {
    this.validateDate(dto.fechaRatificacion, 'fechaRatificacion');
    const today = this.clock.today();
    if (compareDateOnly(dto.fechaRatificacion, today) > 0) {
      throw this.validationError('fechaRatificacion', 'No puede ser posterior a hoy.');
    }
    const current = await this.requireEmployee(id);
    await this.assertVisible(current, principal);
    const earliest = addDays(current.fechaIngreso, current.diasPrueba);
    if (compareDateOnly(today, earliest) < 0 || compareDateOnly(dto.fechaRatificacion, earliest) < 0) {
      throw new ConflictException({
        code: 'PERS_RATIFICACION_ANTICIPADA',
        message: 'No se puede ratificar antes de completar el periodo de prueba.',
      });
    }
    if (current.estado !== 'EN_PRUEBA') throw this.inactiveConflict();

    return this.repository.withTransaction(async (tx) => {
      const locked = await tx.findEmpleadoById(id, { forUpdate: true });
      if (!locked) throw this.notFound();
      if (locked.estado !== 'EN_PRUEBA') throw this.inactiveConflict();
      const updated = await tx.updateEmpleado(id, {
        estado: 'RATIFICADO',
        fechaRatificacion: dto.fechaRatificacion,
      });
      await tx.createHistorial({
        empleadoId: id,
        tipo: 'RATIFICACION',
        fechaEfectiva: dto.fechaRatificacion,
        motivo: dto.motivo ?? null,
        areaAnteriorId: null,
        areaNuevaId: null,
        cargoAnteriorId: null,
        cargoNuevoId: null,
        remuneracionAnteriorCifrada: null,
        remuneracionNuevaCifrada: null,
        registradoPor: principal.userId,
      });
      await tx.addOutbox('EMPLEADO_MODIFICADO', {
        ...(await this.eventPayload(updated)),
        camposModificados: ['estado'],
      });
      return {
        id: updated.id,
        estado: updated.estado,
        fechaRatificacion: updated.fechaRatificacion,
      };
    });
  }

  async simulateBaja(id: string, dto: SimularBajaDto, principal: InternalPrincipal) {
    this.validateDate(dto.fechaBaja, 'fechaBaja');
    const employee = await this.requireEmployee(id);
    await this.assertVisible(employee, principal);
    if (employee.estado === 'INACTIVO') throw this.inactiveConflict();
    this.validateBajaDate(employee.fechaIngreso, dto.fechaBaja);
    const hoy = this.clock.today();
    const [fuerosHoy, fuerosFechaBaja] = await Promise.all([
      this.repository.findInamovilidadesVigentes([id], hoy),
      this.repository.findInamovilidadesVigentes([id], dto.fechaBaja),
    ]);
    const inamovilidades = new Map(
      [...fuerosHoy, ...fuerosFechaBaja].map((fuero) => [fuero.id, fuero]),
    );
    const requiereAutorizacionMinisterio = inamovilidades.size > 0;
    const result = calcularFiniquito({
      spi: this.crypto.decrypt(employee.remuneracionCifrada),
      fechaIngreso: employee.fechaIngreso,
      fechaBaja: dto.fechaBaja,
      aplicaDesahucio: dto.aplicaDesahucio ?? false,
      diasVacacionesPendientes: dto.diasVacacionesPendientes ?? 0,
      diasPrueba: employee.diasPrueba,
    });
    return {
      id: employee.id,
      fechaBaja: dto.fechaBaja,
      bloqueadaPorInamovilidad: requiereAutorizacionMinisterio,
      requiereAutorizacionMinisterio,
      inamovilidades: [...inamovilidades.values()].map((fuero) => ({
        id: fuero.id,
        tipo: fuero.tipo,
        fechaInicio: fuero.fechaInicio,
        fechaFin: fuero.fechaFin,
      })),
      ...(this.canReadSalary(principal) ? result : this.withoutAmounts(result)),
    };
  }

  async baja(
    id: string,
    dto: BajaDatosDto,
    autorizacion: ArchivoEntrante | undefined,
    principal: InternalPrincipal,
  ) {
    this.validateDate(dto.fechaBaja, 'fechaBaja');
    if (autorizacion) this.validateFile(autorizacion, validarAutorizacionMinisterio);
    const current = await this.requireEmployee(id);
    await this.assertVisible(current, principal);
    if (current.estado === 'INACTIVO') throw this.inactiveConflict();
    validarFechasFiniquito(current.fechaIngreso, dto.fechaBaja);

    const stored: StoredFile[] = [];
    try {
      let autorizacionPublicId: string | null = null;
      if (autorizacion) {
        autorizacionPublicId = await this.storage.upload({
          buffer: autorizacion.buffer,
          originalName: autorizacion.originalname,
          mimetype: autorizacion.mimetype ?? 'application/octet-stream',
          kind: 'autorizacion',
        });
        stored.push({ publicId: autorizacionPublicId, kind: 'autorizacion' });
      }

      const result = await this.repository.withTransaction(async (tx) => {
        const employee = await tx.findEmpleadoById(id, { forUpdate: true });
        if (!employee) throw this.notFound();
        if (employee.estado === 'INACTIVO') throw this.inactiveConflict();
        this.validateBajaDate(employee.fechaIngreso, dto.fechaBaja);
        const fueros = await tx.listInamovilidadesByEmpleado(id);
        const hoy = this.clock.today();
        const hayInamovilidadActiva =
          algunaInamovilidadActiva(fueros, hoy) ||
          algunaInamovilidadActiva(fueros, dto.fechaBaja);
        if (hayInamovilidadActiva && !autorizacionPublicId) {
          throw new ConflictException({
            code: 'PERS_INAMOVILIDAD_ACTIVA',
            message: 'La baja está bloqueada por inamovilidad laboral.',
          });
        }

        const resultado = calcularFiniquito({
          spi: this.crypto.decrypt(employee.remuneracionCifrada),
          fechaIngreso: employee.fechaIngreso,
          fechaBaja: dto.fechaBaja,
          aplicaDesahucio: dto.aplicaDesahucio ?? false,
          diasVacacionesPendientes: dto.diasVacacionesPendientes ?? 0,
          diasPrueba: employee.diasPrueba,
        });
        const changed = await tx.updateEstadoSiActivo(id, { estado: 'INACTIVO' });
        if (!changed) throw this.inactiveConflict();

        const baja = await tx.createBaja({
          empleadoId: id,
          fechaBaja: dto.fechaBaja,
          motivo: dto.motivo,
          aplicaDesahucio: dto.aplicaDesahucio ?? false,
          autorizacionMtPublicId: autorizacionPublicId,
          sueldoPromedioCifrado: employee.remuneracionCifrada,
          finiquitoTotalCifrado: this.crypto.encrypt(resultado.total),
          finiquitoDetalleCifrado: this.crypto.encrypt(
            JSON.stringify({
              ...resultado,
              diasVacacionesPendientes: dto.diasVacacionesPendientes ?? 0,
            }),
          ),
          registradoPor: principal.userId,
        });
        await tx.createHistorial({
          empleadoId: id,
          tipo: 'BAJA',
          fechaEfectiva: dto.fechaBaja,
          motivo: dto.motivo,
          areaAnteriorId: null,
          areaNuevaId: null,
          cargoAnteriorId: null,
          cargoNuevoId: null,
          remuneracionAnteriorCifrada: null,
          remuneracionNuevaCifrada: null,
          registradoPor: principal.userId,
        });
        const inactive = { ...employee, estado: 'INACTIVO' as const };
        await tx.addOutbox('EMPLEADO_DADO_DE_BAJA', {
          ...(await this.eventPayload(inactive, dto.fechaBaja)),
        });
        return { baja, resultado, employee: inactive };
      });
      return {
        id: result.baja.id,
        empleadoId: id,
        fechaBaja: result.baja.fechaBaja,
        estado: 'INACTIVO',
        finiquitoRegistrado: true,
        ...(this.canReadSalary(principal)
          ? {
              sueldoPromedio: this.crypto.decrypt(result.baja.sueldoPromedioCifrado),
              ...result.resultado,
            }
          : {}),
      };
    } catch (error) {
      await this.deleteStoredFiles(stored);
      if (error instanceof CiDuplicadaError || error instanceof EmpleadoInactivoError) {
        throw this.inactiveConflict();
      }
      throw error;
    }
  }

  async listInamovilidades(
    id: string,
    page: number,
    pageSize: number,
    principal: InternalPrincipal,
  ) {
    const employee = await this.requireEmployee(id);
    await this.assertVisible(employee, principal);
    const result = await this.repository.listInamovilidades({ empleadoId: id, page, pageSize });
    return {
      data: result.data.map((item) => ({
        id: item.id,
        empleadoId: item.empleadoId,
        tipo: item.tipo,
        fechaInicio: item.fechaInicio,
        fechaFin: item.fechaFin,
        estadoActivo: item.estadoActivo,
        observacion: item.observacion,
        respaldoDisponible: item.respaldoPublicId !== null,
      })),
      meta: this.pageMeta(result.total, page, pageSize),
    };
  }

  async createInamovilidad(
    id: string,
    dto: CreateInamovilidadDto,
    respaldo: ArchivoEntrante | undefined,
    principal: InternalPrincipal,
  ) {
    this.validateInamovilidadDates(dto);
    if (respaldo) this.validateFile(respaldo, validarRespaldo);
    const employee = await this.requireEmployee(id);
    await this.assertVisible(employee, principal);
    if (employee.estado === 'INACTIVO') throw this.inactiveConflict();

    const stored: StoredFile[] = [];
    try {
      let respaldoPublicId: string | null = null;
      if (respaldo) {
        respaldoPublicId = await this.storage.upload({
          buffer: respaldo.buffer,
          originalName: respaldo.originalname,
          mimetype: respaldo.mimetype ?? 'application/octet-stream',
          kind: 'respaldo',
        });
        stored.push({ publicId: respaldoPublicId, kind: 'respaldo' });
      }
      const created = await this.repository.withTransaction(async (tx) => {
        const locked = await tx.findEmpleadoById(id, { forUpdate: true });
        if (!locked) throw this.notFound();
        if (locked.estado === 'INACTIVO') throw this.inactiveConflict();
        const fueros = await tx.listInamovilidadesByEmpleado(id);
        if (fueros.some((fuero) => fuero.estadoActivo && fuero.tipo === dto.tipo)) {
          throw new ConflictException({
            code: 'CONFLICT',
            message: 'Ya existe una inamovilidad activa de ese tipo.',
          });
        }
        return tx.createInamovilidad({
          empleadoId: id,
          tipo: dto.tipo,
          fechaInicio: dto.fechaInicio,
          fechaFin: dto.fechaFin ?? null,
          estadoActivo: true,
          respaldoPublicId,
          observacion: dto.observacion ?? null,
          registradoPor: principal.userId,
        });
      });
      return {
        id: created.id,
        empleadoId: created.empleadoId,
        tipo: created.tipo,
        fechaInicio: created.fechaInicio,
        fechaFin: created.fechaFin,
        estadoActivo: created.estadoActivo,
      };
    } catch (error) {
      await this.deleteStoredFiles(stored);
      throw error;
    }
  }

  async closeInamovilidad(
    id: string,
    inamovilidadId: string,
    dto: CerrarInamovilidadDto,
    principal: InternalPrincipal,
  ) {
    this.validateDate(dto.fechaFin, 'fechaFin');
    const employee = await this.requireEmployee(id);
    await this.assertVisible(employee, principal);
    return this.repository.withTransaction(async (tx) => {
      const fuero = await tx.findInamovilidadById(inamovilidadId);
      if (!fuero || fuero.empleadoId !== id) throw this.notFound();
      if (!fuero.estadoActivo) throw this.inactiveConflict();
      if (compareDateOnly(dto.fechaFin, fuero.fechaInicio) < 0) {
        throw this.validationError('fechaFin', 'No puede ser anterior a fechaInicio.');
      }
      const closed = await tx.cerrarInamovilidad(
        inamovilidadId,
        dto.fechaFin,
        dto.observacion ?? null,
      );
      if (!closed) throw this.inactiveConflict();
      return { id: inamovilidadId, estadoActivo: false, fechaFin: dto.fechaFin };
    });
  }

  private async presentEmployee(
    employee: EmpleadoRecord,
    principal: InternalPrincipal,
    inamovilidadActiva?: boolean,
  ) {
    return {
      id: employee.id,
      nombres: employee.nombres,
      apellidos: employee.apellidos,
      ci: maskCi(this.crypto.decrypt(employee.ciCifrado)),
      ciExpedido: employee.ciExpedido,
      fechaNacimiento: employee.fechaNacimiento,
      esExtranjero: employee.esExtranjero,
      email: employee.email,
      telefono: employee.telefono,
      direccion: employee.direccion,
      areaId: employee.areaId,
      cargoId: employee.cargoId,
      fechaIngreso: employee.fechaIngreso,
      diasPrueba: employee.diasPrueba,
      estado: employee.estado,
      fechaRatificacion: employee.fechaRatificacion,
      firmaDisponible: Boolean(employee.firmaPublicId),
      ...(inamovilidadActiva === undefined ? {} : { inamovilidadActiva }),
      ...(this.canReadSalary(principal)
        ? { remuneracion: this.crypto.decrypt(employee.remuneracionCifrada) }
        : {}),
    };
  }

  private async eventPayload(
    employee: EmpleadoRecord,
    fechaBaja: string | null = null,
  ): Promise<Record<string, OutboxPayload>> {
    const area = await this.catalogs.findArea(employee.areaId);
    if (!area) throw this.notFound();
    return {
      empleadoId: employee.id,
      nombreCompleto: `${employee.nombres} ${employee.apellidos}`,
      areaId: employee.areaId,
      jefeEmpleadoId: area.jefeId,
      estado: employee.estado,
      fechaIngreso: employee.fechaIngreso,
      fechaBaja,
    };
  }

  private withoutAmounts<T extends {
    moneda: string;
    spiOrigen: string;
    periodo: { years: number; months: number; days: number; texto: string };
    antiguedadDias: number;
    spi: string;
    indemnizacion: string;
    desahucio: string;
    aguinaldo: string;
    vacaciones: string;
    total: string;
    conceptos: Array<{ codigo: string; descripcion: string; importe: string }>;
    supuestos: string[];
    advertencias: string[];
  }>(result: T) {
    return {
      moneda: result.moneda,
      spiOrigen: result.spiOrigen,
      periodo: result.periodo,
      antiguedadDias: result.antiguedadDias,
      conceptos: result.conceptos.map(({ codigo, descripcion }) => ({ codigo, descripcion })),
      supuestos: result.supuestos,
      advertencias: result.advertencias,
    };
  }

  private async requireEmployee(id: string): Promise<EmpleadoRecord> {
    const employee = await this.repository.findEmpleadoById(id);
    if (!employee) throw this.notFound();
    return employee;
  }

  private async assertVisible(employee: EmpleadoRecord, principal: InternalPrincipal): Promise<void> {
    if (principal.rol === 'FUNCIONARIO' && principal.empleadoId !== employee.id) {
      throw this.notFound();
    }
    if (principal.rol === 'JEFE_AREA') {
      const areas = await this.catalogs.findAreaIdsLedBy(principal.empleadoId ?? '');
      if (!areas.includes(employee.areaId)) throw this.notFound();
    }
  }

  private async requireActiveCatalogs(areaId: string, cargoId: string): Promise<void> {
    const [area, cargo] = await Promise.all([
      this.catalogs.findArea(areaId),
      this.catalogs.findCargo(cargoId),
    ]);
    if (!area || !cargo) throw this.notFound();
    if (!area.activa || !cargo.activo) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'El área y el cargo deben estar activos.',
      });
    }
  }

  private validateInamovilidadDates(dto: {
    fechaInicio: string;
    fechaFin?: string;
  }): void {
    this.validateDate(dto.fechaInicio, 'inamovilidad.fechaInicio');
    if (dto.fechaFin) {
      this.validateDate(dto.fechaFin, 'inamovilidad.fechaFin');
      if (compareDateOnly(dto.fechaFin, dto.fechaInicio) < 0) {
        throw this.validationError('inamovilidad.fechaFin', 'No puede ser anterior a fechaInicio.');
      }
    }
  }

  private validateMoney(value: string): void {
    try {
      parseMoneyToCents(value);
    } catch {
      throw this.validationError('remuneracion', 'Debe ser un importe decimal no negativo.');
    }
  }

  private normalizeCi(value: string): string {
    try {
      return normalizarCi(value);
    } catch (error) {
      if (error instanceof CiInvalidaError) {
        throw this.validationError('ci', 'Debe tener entre 5 y 15 caracteres alfanuméricos.');
      }
      throw error;
    }
  }

  private validateFile<T>(
    file: ArchivoEntrante,
    validation: (file: ArchivoEntrante) => T,
  ): T {
    try {
      return validation(file);
    } catch (error) {
      if (error instanceof ArchivoInvalidoError) {
        throw new BadRequestException({
          code: 'PERS_ARCHIVO_INVALIDO',
          message: 'El archivo no es válido o supera el tamaño permitido.',
        });
      }
      throw error;
    }
  }

  private validateDate(value: string, field: string): void {
    if (!isDateOnly(value)) {
      throw this.validationError(field, 'Debe ser una fecha válida con formato YYYY-MM-DD.');
    }
  }

  private validateBajaDate(fechaIngreso: string, fechaBaja: string): void {
    try {
      validarFechasFiniquito(fechaIngreso, fechaBaja);
    } catch {
      throw this.validationError('fechaBaja', 'No puede ser anterior a fechaIngreso.');
    }
  }

  private canReadSalary(principal: InternalPrincipal): boolean {
    return principal.permisos.includes('personal:read_salary');
  }

  private pageMeta(total: number, page: number, pageSize: number) {
    return {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private validationError(field: string, message: string): BadRequestException {
    return new BadRequestException({
      ...DATE_ERROR,
      details: { fields: { [field]: message } },
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'NOT_FOUND',
      message: 'El recurso solicitado no existe.',
    });
  }

  private inactiveConflict(): ConflictException {
    return new ConflictException({
      code: 'CONFLICT',
      message: 'La operación entra en conflicto con el estado actual.',
    });
  }

  private async deleteStoredFiles(files: StoredFile[]): Promise<void> {
    for (const file of files) {
      try {
        await this.storage.delete(file.publicId, file.kind);
      } catch {
        this.logger.warn('No se pudo borrar un archivo tras fallar la transacción.');
      }
    }
  }
}
