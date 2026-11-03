import type { JwtPayload } from 'common-dtos';
import { BajasService } from '../../src/application/employees/bajas.service';
import { EmployeesService } from '../../src/application/employees/employees.service';
import { formatFecha, hoyBolivia, parseFecha, sumarDias } from '../../src/domain/empleado/fechas';
import { FakeStorageAdapter } from '../../src/infrastructure/storage/fake-storage.adapter';

const d = (valor: string) => parseFecha(valor) as Date;
const actor = {
  sub: 'usuario-rrhh',
  permisos: ['personal:baja', 'personal:read_salary', 'personal:ratify'],
} as JwtPayload;
const cryptoMock = {
  descifrarMonto: () => 6000,
  cifrarMonto: (monto: number) => `enc(${monto})`,
  cifrar: (texto: string) => `enc(${texto})`,
};

const empleadoBase = {
  id: 'e1',
  nombres: 'Ana',
  apellidos: 'Rojas',
  areaId: 'a1',
  cargoId: 'c1',
  estado: 'RATIFICADO',
  fechaIngreso: d('2023-03-01'),
  diasPrueba: 90,
  remuneracionCifrada: 'enc',
  remuneracion: undefined,
  area: { jefeId: 'j1' },
  baja: null,
  inamovilidades: [] as {
    tipo: string;
    estadoActivo: boolean;
    fechaInicio: Date;
    fechaFin: Date | null;
  }[],
};

describe('BajasService', () => {
  it('bloquea la baja por inamovilidad sin autorización y no inicia transacción', async () => {
    const empleado = {
      ...empleadoBase,
      inamovilidades: [
        {
          tipo: 'GESTACION',
          estadoActivo: true,
          fechaInicio: d('2026-06-01'),
          fechaFin: null,
        },
      ],
    };
    const prisma = {
      empleado: { findUnique: jest.fn().mockResolvedValue(empleado) },
      $transaction: jest.fn(),
    };
    const outbox = { add: jest.fn() };
    const service = new BajasService(
      prisma as never,
      outbox as never,
      cryptoMock as never,
      new FakeStorageAdapter(),
    );

    await expect(
      service.registrar(
        'e1',
        { fechaBaja: '2026-10-30', motivo: 'Renuncia', aplicaDesahucio: false },
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ code: 'PERS_INAMOVILIDAD_ACTIVA', status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.add).not.toHaveBeenCalled();
  });

  it('previsualiza el finiquito usando el haber básico como SPI', async () => {
    const prisma = {
      empleado: { findUnique: jest.fn().mockResolvedValue(empleadoBase) },
    };
    const service = new BajasService(
      prisma as never,
      { add: jest.fn() } as never,
      cryptoMock as never,
      new FakeStorageAdapter(),
    );

    const resultado = await service.previsualizar(
      'e1',
      {
        fechaBaja: '2026-10-30',
        motivo: 'Despido',
        aplicaDesahucio: true,
        diasVacacionPendientes: 10,
      },
      actor,
    );

    expect(resultado.bloqueadaPorInamovilidad).toBe(false);
    expect(resultado.finiquito?.total).toBe(47000);
  });
});

describe('EmployeesService.ratificar', () => {
  it('rechaza la ratificación anticipada sin modificar el estado', async () => {
    const hoy = hoyBolivia();
    const tx = {
      empleado: {
        findUnique: jest.fn().mockResolvedValue({
          ...empleadoBase,
          estado: 'EN_PRUEBA',
          fechaIngreso: sumarDias(hoy, -30),
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) };
    const outbox = { add: jest.fn() };
    const service = new EmployeesService(
      prisma as never,
      outbox as never,
      cryptoMock as never,
      new FakeStorageAdapter(),
    );

    await expect(
      service.ratificar('e1', { fechaRatificacion: formatFecha(hoy) }, actor),
    ).rejects.toMatchObject({ code: 'PERS_RATIFICACION_ANTICIPADA' });
    expect(tx.empleado.updateMany).not.toHaveBeenCalled();
    expect(outbox.add).not.toHaveBeenCalled();
  });
});
