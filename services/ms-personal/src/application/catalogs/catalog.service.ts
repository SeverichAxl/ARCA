import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from '../../domain/catalogs/catalog.repository';
import type { AreaRecord, AreaTreeNode } from '../../domain/catalogs/catalog.models';
import type {
  AreaTreeQueryDto,
  CreateAreaDto,
  CreateCargoDto,
  ListAreasQueryDto,
  ListCargosQueryDto,
  UpdateAreaDto,
  UpdateCargoDto,
} from './catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repository: CatalogRepository,
  ) {}

  async listAreas(query: ListAreasQueryDto) {
    const result = await this.repository.listAreas(query);
    return this.paginated(result.data, result.total, query.page, query.pageSize);
  }

  async getArea(id: string) {
    return this.requireArea(id);
  }

  async createArea(dto: CreateAreaDto) {
    const padreId = dto.padreId ?? null;
    await this.validateAreaReferences(padreId, dto.jefeId ?? null);
    await this.ensureAreaNameAvailable(dto.nombre, padreId);
    return this.repository.createArea({
      nombre: dto.nombre,
      padreId,
      jefeId: dto.jefeId ?? null,
      activa: dto.activa ?? true,
    });
  }

  async updateArea(id: string, dto: UpdateAreaDto) {
    const current = await this.requireArea(id);
    const padreId = dto.padreId === undefined ? current.padreId : dto.padreId;
    const jefeId = dto.jefeId === undefined ? current.jefeId : dto.jefeId;

    if (padreId === id) {
      throw new ConflictException({
        code: 'PERS_CICLO_JERARQUIA',
        message: 'Un área no puede ser su propia área padre.',
      });
    }
    await this.validateAreaReferences(padreId, jefeId);
    if (padreId !== null) {
      await this.ensureNoAreaCycle(id, padreId);
    }
    await this.ensureAreaNameAvailable(dto.nombre ?? current.nombre, padreId, id);
    return this.repository.updateArea(id, dto);
  }

  async deleteArea(id: string): Promise<void> {
    await this.requireArea(id);
    if (await this.repository.countAreaEmployees(id)) {
      throw new ConflictException({
        code: 'PERS_AREA_CON_EMPLEADOS',
        message: 'No se puede eliminar un área con funcionarios asignados.',
      });
    }
    if (await this.repository.countAreaChildren(id)) {
      throw new ConflictException({
        code: 'PERS_AREA_CON_HIJAS',
        message: 'No se puede eliminar un área con subáreas.',
      });
    }
    await this.repository.deleteArea(id);
  }

  async getAreaTree(query: AreaTreeQueryDto) {
    const areas = await this.repository.listAllAreas();
    if (query.raizId) {
      await this.requireArea(query.raizId);
    }
    const nodes = new Map<string, AreaTreeNode>(
      areas.map((area) => [area.id, { ...area, hijos: [] }]),
    );
    const roots: AreaTreeNode[] = [];
    for (const node of nodes.values()) {
      if (node.padreId && nodes.has(node.padreId)) {
        nodes.get(node.padreId)?.hijos.push(node);
      } else {
        roots.push(node);
      }
    }
    const sort = (items: AreaTreeNode[]): AreaTreeNode[] =>
      items
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((item) => ({ ...item, hijos: sort(item.hijos) }));
    return { data: sort(query.raizId ? [nodes.get(query.raizId)!] : roots) };
  }

  async listCargos(query: ListCargosQueryDto) {
    const result = await this.repository.listCargos(query);
    return this.paginated(result.data, result.total, query.page, query.pageSize);
  }

  async getCargo(id: string) {
    return this.requireCargo(id);
  }

  async createCargo(dto: CreateCargoDto) {
    await this.ensureCargoNameAvailable(dto.nombre);
    return this.repository.createCargo({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      activo: dto.activo ?? true,
    });
  }

  async updateCargo(id: string, dto: UpdateCargoDto) {
    const current = await this.requireCargo(id);
    await this.ensureCargoNameAvailable(dto.nombre ?? current.nombre, id);
    return this.repository.updateCargo(id, dto);
  }

  async deleteCargo(id: string): Promise<void> {
    await this.requireCargo(id);
    if (await this.repository.countCargoEmployees(id)) {
      throw new ConflictException({
        code: 'PERS_CARGO_CON_EMPLEADOS',
        message: 'No se puede eliminar un cargo con funcionarios asignados.',
      });
    }
    await this.repository.deleteCargo(id);
  }

  private async requireArea(id: string): Promise<AreaRecord> {
    const area = await this.repository.findAreaById(id);
    if (!area) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Área no encontrada.' });
    return area;
  }

  private async requireCargo(id: string) {
    const cargo = await this.repository.findCargoById(id);
    if (!cargo) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cargo no encontrado.' });
    return cargo;
  }

  private async validateAreaReferences(
    padreId: string | null,
    jefeId: string | null,
  ): Promise<void> {
    if (padreId) await this.requireArea(padreId);
    if (jefeId && !(await this.repository.employeeExists(jefeId))) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'El funcionario indicado como jefe no existe.',
      });
    }
  }

  private async ensureNoAreaCycle(areaId: string, newParentId: string): Promise<void> {
    let cursor: string | null = newParentId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === areaId || visited.has(cursor)) {
        throw new ConflictException({
          code: 'PERS_CICLO_JERARQUIA',
          message: 'El área padre generaría un ciclo jerárquico.',
        });
      }
      visited.add(cursor);
      cursor = (await this.requireArea(cursor)).padreId;
    }
  }

  private async ensureAreaNameAvailable(
    nombre: string,
    padreId: string | null,
    excludeId?: string,
  ): Promise<void> {
    if (await this.repository.areaNameExists(nombre, padreId, excludeId)) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Ya existe un área con ese nombre bajo el mismo padre.',
      });
    }
  }

  private async ensureCargoNameAvailable(nombre: string, excludeId?: string): Promise<void> {
    if (await this.repository.cargoNameExists(nombre, excludeId)) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Ya existe un cargo con ese nombre.',
      });
    }
  }

  private paginated<T>(data: T[], total: number, page: number, pageSize: number) {
    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }
}
