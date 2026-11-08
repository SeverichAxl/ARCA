import 'reflect-metadata';
import { AuditContext } from '@arca/audit';
import type { InternalPrincipal } from '@arca/internal-auth';
import type {
  ContratoCreado,
  ContratoDetalle,
} from '../../domain/contracts/contract.models';
import type { ContratoRepository } from '../../domain/contracts/contract.repository';
import type {
  DatosEmpleadoContrato,
  PersonalDataPort,
} from '../../domain/contracts/personal-data.port';
import type { PlantillaDetalle } from '../../domain/templates/template.models';
import type { PlantillaRepository } from '../../domain/templates/template.repository';
import { ContractService } from './contract.service';

const plantillaId = '11111111-1111-4111-8111-111111111111';
const empleadoId = '22222222-2222-4222-8222-222222222222';
const contratoId = '33333333-3333-4333-8333-333333333333';
const versionId = '44444444-4444-4444-8444-444444444444';

const principal: InternalPrincipal = {
  userId: '55555555-5555-4555-8555-555555555555',
  empleadoId: null,
  rol: 'RRHH_OPERATIVO',
  permisos: ['contrato:generate', 'personal:read_salary'],
};

const datos: DatosEmpleadoContrato = {
  empleadoId,
  nombreEmpleado: 'Ana Rojas',
  ci: '12345678',
  cargo: 'Analista',
  remuneracion: '6000.00',
  fechaIngreso: '2026-01-01',
  duracionPrueba: '90 días',
};

function plantilla(overrides: Partial<PlantillaDetalle> = {}): PlantillaDetalle {
  return {
    id: plantillaId,
    nombre: 'Contrato indefinido',
    descripcion: null,
    activa: true,
    versionActual: 2,
    contenidoHtml:
      '<p>{{nombre_empleado}}|{{ci}}|{{cargo}}|{{remuneracion}}|{{fecha_ingreso}}|{{duracion_prueba}}</p>',
    variablesDetectadas: [
      'nombre_empleado',
      'ci',
      'cargo',
      'remuneracion',
      'fecha_ingreso',
      'duracion_prueba',
    ],
    versiones: [
      {
        id: versionId,
        version: 2,
        contenidoHtml:
          '<p>{{nombre_empleado}}|{{ci}}|{{cargo}}|{{remuneracion}}|{{fecha_ingreso}}|{{duracion_prueba}}</p>',
        variablesDetectadas: [
          'nombre_empleado',
          'ci',
          'cargo',
          'remuneracion',
          'fecha_ingreso',
          'duracion_prueba',
        ],
        creadoEn: new Date('2026-10-01T10:00:00.000Z'),
      },
    ],
    creadoEn: new Date('2026-10-01T10:00:00.000Z'),
    actualizadoEn: new Date('2026-10-01T10:00:00.000Z'),
    ...overrides,
  };
}

function contratoDetalle(): ContratoDetalle {
  const current = plantilla();
  return {
    id: contratoId,
    empleadoId,
    plantillaId,
    plantillaVersionId: versionId,
    plantillaVersion: current.versiones[0]!,
    estado: 'BORRADOR',
    fechaInicio: null,
    observacion: null,
    creadoEn: new Date('2026-11-01T10:00:00.000Z'),
  };
}

describe('ContractService', () => {
  let plantillas: { findById: jest.Mock };
  let contratos: { create: jest.Mock; findById: jest.Mock };
  let personal: { getDatosContrato: jest.Mock };
  let auditContext: AuditContext;
  let service: ContractService;

  beforeEach(() => {
    plantillas = { findById: jest.fn() };
    contratos = { create: jest.fn(), findById: jest.fn() };
    personal = { getDatosContrato: jest.fn() };
    auditContext = new AuditContext();
    service = new ContractService(
      plantillas as unknown as PlantillaRepository,
      contratos as unknown as ContratoRepository,
      personal as unknown as PersonalDataPort,
      auditContext,
    );
  });

  it('genera una vista previa efímera sustituyendo los placeholders sin persistir', async () => {
    plantillas.findById.mockResolvedValue(plantilla());
    personal.getDatosContrato.mockResolvedValue(datos);

    const result = await service.preview({ plantillaId, empleadoId }, principal);

    expect(result).toMatchObject({
      contratoId: null,
      empleadoId,
      plantillaId,
      plantillaVersion: 2,
      variablesResueltas: [
        'nombre_empleado',
        'ci',
        'cargo',
        'remuneracion',
        'fecha_ingreso',
        'duracion_prueba',
      ],
      camposFaltantes: [],
      advertencias: [],
    });
    expect(result.htmlPreview).toBe(
      '<p>Ana Rojas|12345678|Analista|6000.00|2026-01-01|90 días</p>',
    );
    expect(personal.getDatosContrato).toHaveBeenCalledWith(empleadoId, principal);
    expect(contratos.create).not.toHaveBeenCalled();

    const auditSnapshot = auditContext.snapshot();
    expect(auditSnapshot.hasAfter).toBe(true);
    expect(auditSnapshot.after).not.toHaveProperty('htmlPreview');
  });

  it('deja la remuneración como campo faltante cuando el actor no puede verla', async () => {
    const sinSalario: DatosEmpleadoContrato = { ...datos };
    delete sinSalario.remuneracion;
    plantillas.findById.mockResolvedValue(plantilla());
    personal.getDatosContrato.mockResolvedValue(sinSalario);

    const result = await service.preview({ plantillaId, empleadoId }, principal);

    expect(result.htmlPreview).toContain('{{remuneracion}}');
    expect(result.camposFaltantes).toEqual(['remuneracion']);
    expect(result.advertencias[0]).toContain('personal:read_salary');
  });

  it('persiste el contrato con la versión vigente y un snapshot sin datos sensibles', async () => {
    const created: ContratoCreado = {
      id: contratoId,
      empleadoId,
      plantillaId,
      plantillaVersion: 2,
      estado: 'BORRADOR',
      creadoEn: new Date('2026-11-01T10:00:00.000Z'),
    };
    plantillas.findById.mockResolvedValue(plantilla());
    personal.getDatosContrato.mockResolvedValue(datos);
    contratos.create.mockResolvedValue(created);

    const result = await service.create(
      {
        plantillaId,
        empleadoId,
        fechaInicio: '2026-02-01',
        observacion: 'Alta de personal',
      },
      principal,
    );

    expect(result).toBe(created);
    expect(contratos.create).toHaveBeenCalledTimes(1);
    const data = contratos.create.mock.calls[0]?.[0];
    expect(data).toMatchObject({
      empleadoId,
      plantillaId,
      plantillaVersionId: versionId,
      fechaInicio: new Date('2026-02-01T00:00:00.000Z'),
      observacion: 'Alta de personal',
      creadoPor: principal.userId,
    });
    expect(data.empleadoSnapshot).toEqual({
      nombreEmpleado: 'Ana Rojas',
      cargo: 'Analista',
      fechaIngreso: '2026-01-01',
      duracionPrueba: '90 días',
      plantillaVersion: 2,
    });
    expect(data.empleadoSnapshot).not.toHaveProperty('ci');
    expect(data.empleadoSnapshot).not.toHaveProperty('remuneracion');
  });

  it('rechaza una plantilla inexistente o inactiva', async () => {
    plantillas.findById.mockResolvedValueOnce(null);
    await expect(
      service.preview({ plantillaId, empleadoId }, principal),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });

    plantillas.findById.mockResolvedValueOnce(plantilla({ activa: false }));
    await expect(
      service.preview({ plantillaId, empleadoId }, principal),
    ).rejects.toMatchObject({ response: { code: 'CONTR_PLANTILLA_INACTIVA' } });
  });

  it('rechaza una fecha de inicio imposible', async () => {
    plantillas.findById.mockResolvedValue(plantilla());
    personal.getDatosContrato.mockResolvedValue(datos);

    await expect(
      service.create(
        { plantillaId, empleadoId, fechaInicio: '2026-02-31' },
        principal,
      ),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    expect(contratos.create).not.toHaveBeenCalled();
  });

  it('previsualiza un contrato persistido con la versión congelada', async () => {
    contratos.findById.mockResolvedValue(contratoDetalle());
    personal.getDatosContrato.mockResolvedValue(datos);

    const result = await service.previewById(contratoId, principal);

    expect(result).toMatchObject({
      contratoId,
      empleadoId,
      plantillaId,
      plantillaVersion: 2,
    });
    expect(result.htmlPreview).toContain('Ana Rojas');
    expect(contratos.findById).toHaveBeenCalledWith(contratoId);
  });

  it('responde 404 cuando el contrato a previsualizar no existe', async () => {
    contratos.findById.mockResolvedValue(null);

    await expect(service.previewById(contratoId, principal)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });
});
