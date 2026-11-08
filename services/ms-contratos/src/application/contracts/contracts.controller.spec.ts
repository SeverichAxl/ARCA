import 'reflect-metadata';
import { ANY_PERMISSIONS_KEY } from '../../common/decorators/require-any-permission.decorator';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permission.decorator';
import type { InternalPrincipal } from '@arca/internal-auth';
import type { CreateContratoDto, PreviewContratoDto } from './contract.dto';
import { ContractService } from './contract.service';
import { ContractsController } from './contracts.controller';

const principal: InternalPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  empleadoId: null,
  rol: 'RRHH_OPERATIVO',
  permisos: ['contrato:generate', 'contrato:read'],
};

const plantillaId = '22222222-2222-4222-8222-222222222222';
const empleadoId = '33333333-3333-4333-8333-333333333333';
const contratoId = '44444444-4444-4444-8444-444444444444';

const created = {
  id: contratoId,
  empleadoId,
  plantillaId,
  plantillaVersion: 1,
  estado: 'BORRADOR',
  creadoEn: new Date('2026-11-01T10:00:00.000Z'),
};

const preview = {
  contratoId: null,
  empleadoId,
  plantillaId,
  plantillaVersion: 1,
  htmlPreview: '<p>Ana Rojas</p>',
  variablesResueltas: ['nombre_empleado'],
  camposFaltantes: [],
  advertencias: [],
};

describe('ContractsController', () => {
  let service: {
    create: jest.Mock;
    preview: jest.Mock;
    previewById: jest.Mock;
  };
  let controller: ContractsController;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      preview: jest.fn(),
      previewById: jest.fn(),
    };
    controller = new ContractsController(service as unknown as ContractService);
  });

  it('delega la creación con el actor autenticado', async () => {
    const dto: CreateContratoDto = { plantillaId, empleadoId };
    service.create.mockResolvedValue(created);

    await expect(controller.create(dto, principal)).resolves.toBe(created);
    expect(service.create).toHaveBeenCalledWith(dto, principal);
  });

  it('delega la vista previa efímera', async () => {
    const dto: PreviewContratoDto = { plantillaId, empleadoId };
    service.preview.mockResolvedValue(preview);

    await expect(controller.preview(dto, principal)).resolves.toBe(preview);
    expect(service.preview).toHaveBeenCalledWith(dto, principal);
  });

  it('delega la vista previa de un contrato persistido', async () => {
    const expected = { ...preview, contratoId };
    service.previewById.mockResolvedValue(expected);

    await expect(controller.previewById(contratoId, principal)).resolves.toBe(expected);
    expect(service.previewById).toHaveBeenCalledWith(contratoId, principal);
  });

  it('declara los permisos RBAC de contratos', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.create)).toEqual([
      'contrato:generate',
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.preview)).toEqual([
      'contrato:generate',
    ]);
    expect(
      Reflect.getMetadata(ANY_PERMISSIONS_KEY, ContractsController.prototype.previewById),
    ).toEqual(['contrato:generate', 'contrato:read']);
  });
});
