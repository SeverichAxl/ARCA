import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { ANY_PERMISSIONS_KEY } from '../../common/decorators/require-any-permission.decorator';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permission.decorator';
import type { InternalPrincipal } from '@arca/internal-auth';
import type { CreatePlantillaDto, ListPlantillasQueryDto } from './template.dto';
import { PlantillaService } from './template.service';
import { PlantillasController } from './templates.controller';

const principal: InternalPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  empleadoId: '22222222-2222-4222-8222-222222222222',
  rol: 'RRHH_OPERATIVO',
  permisos: ['contrato:template_manage', 'contrato:generate'],
};

const plantillaId = '00000000-0000-4000-8000-000000000001';

function createDto(): CreatePlantillaDto {
  return {
    nombre: 'Contrato indefinido estándar',
    descripcion: 'Modelo Ministerio de Trabajo',
    contenidoHtml: '<h1>Contrato</h1><p>Yo {{nombre_empleado}}.</p>',
    activa: true,
  };
}

describe('PlantillasController', () => {
  let service: {
    create: jest.Mock;
    list: jest.Mock;
    get: jest.Mock;
    update: jest.Mock;
  };
  let controller: PlantillasController;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      list: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    };
    controller = new PlantillasController(service as unknown as PlantillaService);
  });

  it('delega la creación al servicio con el actor autenticado', async () => {
    const dto = createDto();
    const expected = {
      id: plantillaId,
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      variablesDetectadas: ['nombre_empleado'],
      activa: true,
      versionActual: 1,
      creadoEn: new Date('2026-11-01T10:00:00.000Z'),
    };
    service.create.mockResolvedValue(expected);

    await expect(controller.create(dto, principal)).resolves.toEqual(expected);
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(service.create).toHaveBeenCalledWith(dto, principal.userId);
  });

  it('delega el listado paginado al servicio', async () => {
    const query: ListPlantillasQueryDto = { page: 1, pageSize: 20, activa: true };
    const expected = {
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    };
    service.list.mockResolvedValue(expected);

    await expect(controller.list(query)).resolves.toEqual(expected);
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('delega la consulta por ID al servicio', async () => {
    const expected = {
      id: plantillaId,
      nombre: 'Contrato',
      descripcion: null,
      activa: true,
      versionActual: 1,
      contenidoHtml: '<p>{{ci}}</p>',
      variablesDetectadas: ['ci'],
      versiones: [],
      creadoEn: new Date('2026-11-01T10:00:00.000Z'),
      actualizadoEn: new Date('2026-11-01T10:00:00.000Z'),
    };
    service.get.mockResolvedValue(expected);

    await expect(controller.get(plantillaId)).resolves.toEqual(expected);
    expect(service.get).toHaveBeenCalledWith(plantillaId);
  });

  it('delega la actualización con el actor autenticado', async () => {
    const dto = { activa: false };
    service.update.mockResolvedValue({ id: plantillaId, activa: false });

    await expect(controller.update(plantillaId, dto, principal)).resolves.toEqual({
      id: plantillaId,
      activa: false,
    });
    expect(service.update).toHaveBeenCalledWith(plantillaId, dto, principal.userId);
  });

  it('propaga el 400 por variables no permitidas', async () => {
    const error = new BadRequestException({
      code: 'CONTR_VARIABLE_NO_PERMITIDA',
      message: 'Variable no permitida.',
    });
    service.create.mockRejectedValue(error);

    await expect(controller.create(createDto(), principal)).rejects.toBe(error);
  });

  it('declara los permisos RBAC del contrato de plantillas', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, PlantillasController.prototype.create)).toEqual([
      'contrato:template_manage',
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, PlantillasController.prototype.update)).toEqual([
      'contrato:template_manage',
    ]);
    expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, PlantillasController.prototype.list)).toEqual([
      'contrato:template_manage',
      'contrato:generate',
    ]);
    expect(Reflect.getMetadata(ANY_PERMISSIONS_KEY, PlantillasController.prototype.get)).toEqual([
      'contrato:template_manage',
      'contrato:generate',
    ]);
  });
});
