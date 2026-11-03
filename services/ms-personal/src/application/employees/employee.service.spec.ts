import { ConfigService } from '@nestjs/config';
import type { Clock } from '../../domain/common/clock';
import { addDays } from '../../domain/common/date-only';
import { estaInamovilidadActiva } from '../../domain/employees/inamovilidad';
import type {
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
} from '../../domain/employees/employee.models';
import {
  type EmployeeRepository,
  type EmployeeTransaction,
  type OutboxPayload,
} from '../../domain/employees/employee.repository';
import type { FileStoragePort } from '../../domain/employees/file-storage.port';
import type { OrgCatalogPort } from '../../domain/employees/org-catalog.port';
import { PersonalCryptoService } from '../../infrastructure/crypto/personal-crypto.service';
import type {
  BajaDatosDto,
  CreateEmployeeDatosDto,
  CreateInamovilidadDto,
  RatifyEmployeeDto,
  SimularBajaDto,
  UpdateEmployeeDto,
} from './employee.dto';
import { EmployeeService } from './employee.service';

const employeeId = 'c0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c';
const areaId = 'a0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c';
const cargoId = 'b0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c';

class FakeRepository implements EmployeeRepository {
  employee: EmpleadoRecord;
  inamovilidades: InamovilidadRecord[] = [];
  histories: CreateHistorialData[] = [];
  outbox: Array<{ eventName: string; payload: OutboxPayload }> = [];
  failOutbox = false;
  transactionCalls = 0;
  transaction: EmployeeTransaction;

  constructor(private readonly crypto: PersonalCryptoService) {
    this.employee = this.makeEmployee();
    this.transaction = {
      findEmpleadoById: jest.fn(async () => this.employee),
      createEmpleado: jest.fn(async (data: CreateEmpleadoData) => {
        this.employee = { ...this.employee, ...data };
        return this.employee;
      }),
      updateEmpleado: jest.fn(async (_id: string, data: UpdateEmpleadoData) => {
        this.employee = { ...this.employee, ...data };
        return this.employee;
      }),
      updateEstadoSiActivo: jest.fn(async (_id: string, data: UpdateEmpleadoData) => {
        if (this.employee.estado === 'INACTIVO') return false;
        this.employee = { ...this.employee, ...data };
        return true;
      }),
      createHistorial: jest.fn(async (data: CreateHistorialData) => {
        this.histories.push(data);
      }),
      createInamovilidad: jest.fn(async (data: CreateInamovilidadData) => {
        const record: InamovilidadRecord = {
          ...data,
          id: 'd0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
          creadoEn: new Date('2026-01-01T00:00:00Z'),
        };
        this.inamovilidades.push(record);
        return record;
      }),
      listInamovilidadesByEmpleado: jest.fn(async () => this.inamovilidades),
      findInamovilidadById: jest.fn(async (id: string) =>
        this.inamovilidades.find((item) => item.id === id) ?? null,
      ),
      cerrarInamovilidad: jest.fn(async (id: string, fechaFin: string) => {
        const item = this.inamovilidades.find((candidate) => candidate.id === id);
        if (!item || !item.estadoActivo) return false;
        item.estadoActivo = false;
        item.fechaFin = fechaFin;
        return true;
      }),
      createBaja: jest.fn(async (data: CreateBajaData) => ({
        ...data,
        id: 'e0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
        creadoEn: new Date('2026-01-01T00:00:00Z'),
      })),
      getConfig: jest.fn(async (key: string) =>
        key === 'DIAS_PRUEBA_DEFAULT' ? '90' : key === 'LIMITE_EXTRANJEROS_PCT' ? '15' : null,
      ),
      lockLimiteExtranjeros: jest.fn(async () => undefined),
      countEmpleadosActivos: jest.fn(async () => 0),
      countExtranjerosActivos: jest.fn(async () => 0),
      addOutbox: jest.fn(async (eventName: string, payload: OutboxPayload) => {
        if (this.failOutbox) throw new Error('simulated outbox failure');
        this.outbox.push({ eventName, payload });
      }),
    };
  }

  async withTransaction<T>(work: (tx: EmployeeTransaction) => Promise<T>): Promise<T> {
    this.transactionCalls += 1;
    const employeeBefore = this.employee;
    const historyCount = this.histories.length;
    const inamovilityCount = this.inamovilidades.length;
    const outboxCount = this.outbox.length;
    try {
      return await work(this.transaction);
    } catch (error) {
      this.employee = employeeBefore;
      this.histories.length = historyCount;
      this.inamovilidades.length = inamovilityCount;
      this.outbox.length = outboxCount;
      throw error;
    }
  }

  async findEmpleadoById(): Promise<EmpleadoRecord | null> {
    return this.employee;
  }

  async findInamovilidadesVigentes(
    empleadoIds: string[],
    fechaReferencia: string,
  ): Promise<InamovilidadRecord[]> {
    return this.inamovilidades.filter(
      (fuero) =>
        empleadoIds.includes(fuero.empleadoId) &&
        estaInamovilidadActiva(fuero, fechaReferencia),
    );
  }

  async listEmpleados(_query: EmployeeListQuery): Promise<Page<EmpleadoRecord>> {
    return { data: [this.employee], total: 1 };
  }

  async listHistorial(_query: HistorialListQuery): Promise<Page<HistorialRecord>> {
    return { data: [], total: 0 };
  }

  async listInamovilidades(_query: InamovilidadListQuery): Promise<Page<InamovilidadRecord>> {
    return { data: this.inamovilidades, total: this.inamovilidades.length };
  }

  private makeEmployee(): EmpleadoRecord {
    return {
      id: employeeId,
      nombres: 'Ana',
      apellidos: 'Rojas',
      ciCifrado: this.crypto.encrypt('12345678'),
      ciHash: this.crypto.hashCi('12345678'),
      ciExpedido: null,
      fechaNacimiento: null,
      esExtranjero: false,
      email: null,
      telefono: null,
      direccion: null,
      areaId,
      cargoId,
      remuneracionCifrada: this.crypto.encrypt('6000.00'),
      fechaIngreso: '2026-01-01',
      diasPrueba: 90,
      estado: 'EN_PRUEBA',
      fechaRatificacion: null,
      firmaPublicId: 'file-id',
      creadoPor: 'f0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
      creadoEn: new Date('2026-01-01T00:00:00Z'),
      actualizadoEn: new Date('2026-01-01T00:00:00Z'),
    };
  }
}

class FakeStorage implements FileStoragePort {
  readonly deleted: string[] = [];
  uploads = 0;

  async upload(): Promise<string> {
    this.uploads += 1;
    return 'uploaded-file-id';
  }

  async delete(publicId: string): Promise<void> {
    this.deleted.push(publicId);
  }

  async signedUrl(): Promise<string> {
    return 'https://files.invalid/signed';
  }
}

const operator = {
  userId: 'f0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
  empleadoId: null,
  rol: 'RRHH_OPERATIVO',
  permisos: ['personal:read_salary'],
};

function setup(today = '2026-04-01') {
  const config = new ConfigService({
    ENC_KEY_PERSONAL: Buffer.alloc(32, 7).toString('base64'),
    CI_HMAC_KEY: 'test-ci-hmac-key',
  });
  const crypto = new PersonalCryptoService(config);
  const repository = new FakeRepository(crypto);
  const storage = new FakeStorage();
  const catalogs: OrgCatalogPort = {
    findArea: jest.fn(async (id) => ({ id, jefeId: null, activa: true })),
    findCargo: jest.fn(async (id) => ({ id, activo: true })),
    findAreaIdsLedBy: jest.fn(async () => []),
  };
  const clock: Clock = { today: () => today };
  const service = new EmployeeService(repository, catalogs, storage, clock, crypto);
  return { service, repository, storage, crypto };
}

describe('EmployeeService', () => {
  it('rechaza el alta sin firma antes de abrir una transacción', async () => {
    const { service, repository } = setup();
    await expect(
      service.create(
        {
          nombres: 'Ana',
          apellidos: 'Rojas',
          ci: '12345678',
          areaId,
          cargoId,
          remuneracion: '6000.00',
          fechaIngreso: '2026-01-01',
        },
        undefined,
        operator,
      ),
    ).rejects.toMatchObject({ response: { code: 'PERS_FIRMA_REQUERIDA' } });
    expect(repository.transactionCalls).toBe(0);
  });

  it('crea al empleado, ALTA y Outbox en una sola transacción sin datos sensibles en el evento', async () => {
    const { service, repository } = setup();
    const dto: CreateEmployeeDatosDto = {
      nombres: 'Ana',
      apellidos: 'Rojas',
      ci: '12345678',
      areaId,
      cargoId,
      remuneracion: '6000.00',
      fechaIngreso: '2026-01-01',
    };
    const firma = {
      originalname: 'firma.jpeg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
    };
    const result = await service.create(dto, firma, operator);

    expect(result).toMatchObject({ ci: '***5678', remuneracion: '6000.00' });
    expect(repository.histories.map((item) => item.tipo)).toEqual(['ALTA']);
    expect(repository.outbox).toHaveLength(1);
    expect(repository.outbox[0]?.eventName).toBe('EMPLEADO_CREADO');
    const payload = JSON.stringify(repository.outbox[0]?.payload);
    expect(payload).not.toContain('12345678');
    expect(payload).not.toContain('6000.00');
    expect(repository.transactionCalls).toBe(1);
  });

  it('ratifica desde el día 90, con fallo el día 89 y también al día 91', async () => {
    const entry = '2026-01-01';
    const at89 = setup(addDays(entry, 89));
    const dto89: RatifyEmployeeDto = { fechaRatificacion: addDays(entry, 89) };
    await expect(at89.service.ratify(employeeId, dto89, operator)).rejects.toMatchObject({
      response: { code: 'PERS_RATIFICACION_ANTICIPADA' },
    });
    expect(at89.repository.transactionCalls).toBe(0);

    for (const days of [90, 91]) {
      const { service, repository } = setup(addDays(entry, days));
      const dto: RatifyEmployeeDto = { fechaRatificacion: addDays(entry, days) };
      await expect(service.ratify(employeeId, dto, operator)).resolves.toMatchObject({
        estado: 'RATIFICADO',
      });
      expect(repository.histories.map((item) => item.tipo)).toContain('RATIFICACION');
      expect(repository.outbox).toHaveLength(1);
    }
  });

  it('registra una historia por cada aspecto cambiado y no publica remuneración', async () => {
    const { service, repository } = setup();
    const dto: UpdateEmployeeDto = {
      areaId: 'a1d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
      cargoId: 'b1d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
      remuneracion: '7000.25',
      fechaEfectiva: '2026-03-01',
      motivo: 'Reorganización',
    };
    await service.update(employeeId, dto, operator);

    expect(repository.histories.map((item) => item.tipo)).toEqual([
      'CAMBIO_AREA',
      'CAMBIO_CARGO',
      'CAMBIO_REMUNERACION',
    ]);
    expect(repository.outbox[0]?.eventName).toBe('EMPLEADO_MODIFICADO');
    expect(JSON.stringify(repository.outbox[0]?.payload)).not.toContain('7000.25');
    expect(JSON.stringify(repository.outbox[0]?.payload)).not.toContain('6000.00');
  });

  it('no incluye remuneración en la simulación sin permiso y no abre transacción', async () => {
    const { service, repository } = setup();
    const viewer = { ...operator, permisos: ['personal:baja'] };
    const dto: SimularBajaDto = { fechaBaja: '2026-03-31', aplicaDesahucio: false };
    const result = await service.simulateBaja(employeeId, dto, viewer);

    expect(result).not.toHaveProperty('spi');
    expect(result).not.toHaveProperty('total');
    expect(repository.transactionCalls).toBe(0);
    expect(repository.outbox).toHaveLength(0);
  });

  it('informa si la baja simulada requiere autorización por inamovilidad vigente hoy o en la fecha efectiva', async () => {
    const { service, repository } = setup('2026-04-01');
    repository.inamovilidades.push({
      id: 'd0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
      empleadoId: employeeId,
      tipo: 'GESTACION',
      fechaInicio: '2026-03-01',
      fechaFin: null,
      estadoActivo: true,
      respaldoPublicId: null,
      observacion: null,
      registradoPor: operator.userId,
      creadoEn: new Date('2026-01-01T00:00:00Z'),
    });
    const viewer = { ...operator, permisos: ['personal:baja'] };
    const result = await service.simulateBaja(
      employeeId,
      { fechaBaja: '2026-02-28' },
      viewer,
    );

    expect(result).toMatchObject({
      bloqueadaPorInamovilidad: true,
      requiereAutorizacionMinisterio: true,
      inamovilidades: [{ tipo: 'GESTACION' }],
    });
    expect(repository.transactionCalls).toBe(0);
    expect(repository.outbox).toHaveLength(0);
  });

  it('bloquea baja con inamovilidad activa y conserva el estado del empleado', async () => {
    const { service, repository } = setup('2026-04-01');
    repository.inamovilidades.push({
      id: 'd0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
      empleadoId: employeeId,
      tipo: 'GESTACION',
      fechaInicio: '2026-03-01',
      fechaFin: null,
      estadoActivo: true,
      respaldoPublicId: null,
      observacion: null,
      registradoPor: operator.userId,
      creadoEn: new Date('2026-01-01T00:00:00Z'),
    });
    const dto: BajaDatosDto = { fechaBaja: '2026-02-28', motivo: 'Fin de contrato' };

    await expect(service.baja(employeeId, dto, undefined, operator)).rejects.toMatchObject({
      response: { code: 'PERS_INAMOVILIDAD_ACTIVA' },
    });
    expect(repository.employee.estado).toBe('EN_PRUEBA');
    expect(repository.outbox).toHaveLength(0);
    expect(repository.transaction.updateEstadoSiActivo).not.toHaveBeenCalled();
  });

  it('impide registrar inamovilidad sobre empleados inactivos o duplicar un tipo activo', async () => {
    const { service, repository, storage } = setup();
    const dto: CreateInamovilidadDto = {
      tipo: 'GESTACION',
      fechaInicio: '2026-03-01',
    };
    repository.inamovilidades.push({
      id: 'd0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
      empleadoId: employeeId,
      tipo: 'GESTACION',
      fechaInicio: '2026-01-01',
      fechaFin: null,
      estadoActivo: true,
      respaldoPublicId: null,
      observacion: null,
      registradoPor: operator.userId,
      creadoEn: new Date('2026-01-01T00:00:00Z'),
    });

    await expect(
      service.createInamovilidad(employeeId, dto, undefined, operator),
    ).rejects.toMatchObject({ response: { code: 'CONFLICT' } });
    expect(storage.uploads).toBe(0);

    repository.employee.estado = 'INACTIVO';
    const transactionCalls = repository.transactionCalls;
    await expect(
      service.createInamovilidad(employeeId, dto, undefined, operator),
    ).rejects.toMatchObject({ response: { code: 'CONFLICT' } });
    expect(repository.transactionCalls).toBe(transactionCalls);
  });

  it('registra baja autorizada, historial y evento de empleado sin datos salariales', async () => {
    const { service, repository } = setup();
    repository.inamovilidades.push({
      id: 'd0d0e7e1-4de3-4ad0-9cb6-d934b4f8888c',
      empleadoId: employeeId,
      tipo: 'GESTACION',
      fechaInicio: '2026-01-01',
      fechaFin: null,
      estadoActivo: true,
      respaldoPublicId: null,
      observacion: null,
      registradoPor: operator.userId,
      creadoEn: new Date('2026-01-01T00:00:00Z'),
    });
    const authorization = {
      originalname: 'autorizacion.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\n'),
    };
    const result = await service.baja(
      employeeId,
      { fechaBaja: '2026-03-31', motivo: 'Cese', diasVacacionesPendientes: 0 },
      authorization,
      operator,
    );

    expect(result).toMatchObject({ estado: 'INACTIVO', finiquitoRegistrado: true });
    expect(repository.employee.estado).toBe('INACTIVO');
    expect(repository.histories.map((item) => item.tipo)).toContain('BAJA');
    expect(repository.outbox.map((item) => item.eventName)).toContain('EMPLEADO_DADO_DE_BAJA');
    expect(JSON.stringify(repository.outbox)).not.toContain('6000.00');
  });

  it('revierte los cambios y limpia el archivo si falla la escritura de Outbox', async () => {
    const { service, repository, storage } = setup();
    repository.failOutbox = true;
    const dto: CreateEmployeeDatosDto = {
      nombres: 'Ana',
      apellidos: 'Rojas',
      ci: '12345678',
      areaId,
      cargoId,
      remuneracion: '6000.00',
      fechaIngreso: '2026-01-01',
    };
    const firma = {
      originalname: 'firma.jpeg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
    };

    await expect(service.create(dto, firma, operator)).rejects.toThrow('simulated outbox failure');
    expect(repository.histories).toHaveLength(0);
    expect(repository.outbox).toHaveLength(0);
    expect(storage.deleted).toEqual(['uploaded-file-id']);
  });
});
