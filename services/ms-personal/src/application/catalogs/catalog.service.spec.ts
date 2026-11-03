import { ConflictException } from '@nestjs/common';
import type { CatalogRepository } from '../../domain/catalogs/catalog.repository';
import type { AreaRecord, CargoRecord } from '../../domain/catalogs/catalog.models';
import { CatalogService } from './catalog.service';

const area = (id: string, padreId: string | null = null): AreaRecord => ({
  id,
  nombre: `Área ${id}`,
  padreId,
  jefeId: null,
  activa: true,
  creadoEn: new Date('2026-01-01T00:00:00.000Z'),
});
const cargo = (id: string): CargoRecord => ({
  id,
  nombre: `Cargo ${id}`,
  descripcion: null,
  activo: true,
});

function repositoryMock(): jest.Mocked<CatalogRepository> {
  return {
    listAreas: jest.fn(),
    listAllAreas: jest.fn(),
    findAreaById: jest.fn(),
    createArea: jest.fn(),
    updateArea: jest.fn(),
    deleteArea: jest.fn(),
    countAreaChildren: jest.fn(),
    countAreaEmployees: jest.fn(),
    areaNameExists: jest.fn(),
    employeeExists: jest.fn(),
    listCargos: jest.fn(),
    findCargoById: jest.fn(),
    createCargo: jest.fn(),
    updateCargo: jest.fn(),
    deleteCargo: jest.fn(),
    countCargoEmployees: jest.fn(),
    cargoNameExists: jest.fn(),
  };
}

describe('CatalogService', () => {
  it('rechaza mover un área debajo de uno de sus descendientes', async () => {
    const repository = repositoryMock();
    repository.findAreaById.mockImplementation(async (id) => {
      if (id === 'area-a') return area('area-a');
      if (id === 'area-b') return area('area-b', 'area-a');
      return null;
    });
    repository.areaNameExists.mockResolvedValue(false);
    const service = new CatalogService(repository);

    await expect(service.updateArea('area-a', { padreId: 'area-b' })).rejects.toMatchObject({
      response: { code: 'PERS_CICLO_JERARQUIA' },
    });
    expect(repository.updateArea).not.toHaveBeenCalled();
  });

  it('impide eliminar un área con funcionarios asignados', async () => {
    const repository = repositoryMock();
    repository.findAreaById.mockResolvedValue(area('area-a'));
    repository.countAreaEmployees.mockResolvedValue(1);
    const service = new CatalogService(repository);

    await expect(service.deleteArea('area-a')).rejects.toBeInstanceOf(ConflictException);
    expect(repository.deleteArea).not.toHaveBeenCalled();
  });

  it('impide eliminar un área con subáreas', async () => {
    const repository = repositoryMock();
    repository.findAreaById.mockResolvedValue(area('area-a'));
    repository.countAreaEmployees.mockResolvedValue(0);
    repository.countAreaChildren.mockResolvedValue(1);
    const service = new CatalogService(repository);

    await expect(service.deleteArea('area-a')).rejects.toMatchObject({
      response: { code: 'PERS_AREA_CON_HIJAS' },
    });
    expect(repository.deleteArea).not.toHaveBeenCalled();
  });

  it('impide eliminar un cargo con funcionarios asignados', async () => {
    const repository = repositoryMock();
    repository.findCargoById.mockResolvedValue(cargo('cargo-a'));
    repository.countCargoEmployees.mockResolvedValue(2);
    const service = new CatalogService(repository);

    await expect(service.deleteCargo('cargo-a')).rejects.toMatchObject({
      response: { code: 'PERS_CARGO_CON_EMPLEADOS' },
    });
    expect(repository.deleteCargo).not.toHaveBeenCalled();
  });
});
