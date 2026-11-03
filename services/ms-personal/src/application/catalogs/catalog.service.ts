import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AuditContext } from '@arca/audit';
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
    @Optional() private readonly auditContext?: AuditContext,
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
    const jefeId = dto.jefeId ?? null;
    await this.validateAreaReferences(padreId, jefeId);
    await this.ensureAreaNameAvailable(dto.nombre, padreId);
    const created = await this.repository.createArea(
      {
        nombre: dto.nombre,
        padreId,
        jefeId,
        activa: dto.activa ?? true,
      },
      jefeId !== null,
    );
    this.auditContext?.captureAfter(created);
    return created;
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
    const emitEvent =
      (dto.nombre !== undefined && dto.nombre !== current.nombre) ||
      (dto.padreId !== undefined && dto.padreId !== current.padreId) ||
      (dto.jefeId !== undefined && dto.jefeId !== current.jefeId) ||
      (dto.activa !== undefined && dto.activa !== current.activa);

    this.auditContext?.captureBefore(current);
    const updated = await this.repository.updateArea(id, dto, emitEvent);
    this.auditContext?.captureAfter(updated);
    return updated;
  }

  async deleteArea(id: string): Promise<void> {
    const current = await this.requireArea(id);
    this.auditContext?.captureBefore(current);
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
    this.auditContext?.captureAfter(null);
  }

  async getAreaTree(
    query: AreaTreeQueryDto,
    principal?: { rol: string; empleadoId: string | null },
  ) {
    const areas = await this.repository.listAllAreas();
    if (query.raizId) {
      await this.requireArea(query.raizId);
    }

    const visibleAreas =
      principal?.rol === 'JEFE_AREA'
        ? this.subtreesLedBy(areas, principal.empleadoId)
        : areas;

    const nodes = new Map<string, AreaTreeNode>(
      visibleAreas.map((area) => [area.id, { ...area, hijos: [] }]),
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

    if (query.raizId) {
      const root = nodes.get(query.raizId);
      return { data: root ? sort([root]) : [] };
    }
    return { data: sort(roots) };
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
    const created = await this.repository.createCargo({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      activo: dto.activo ?? true,
    });
    this.auditContext?.captureAfter(created);
    return created;
  }

  async updateCargo(id: string, dto: UpdateCargoDto) {
    const current = await this.requireCargo(id);
    await this.ensureCargoNameAvailable(dto.nombre ?? current.nombre, id);
    this.auditContext?.captureBefore(current);
    const updated = await this.repository.updateCargo(id, dto);
    this.auditContext?.captureAfter(updated);
    return updated;
  }

  async deleteCargo(id: string): Promise<void> {
    const current = await this.requireCargo(id);
    this.auditContext?.captureBefore(current);
    if (await this.repository.countCargoEmployees(id)) {
      throw new ConflictException({
        code: 'PERS_CARGO_CON_EMPLEADOS',
        message: 'No se puede eliminar un cargo con funcionarios asignados.',
      });
    }
    await this.repository.deleteCargo(id);
    this.auditContext?.captureAfter(null);
  }

  private subtreesLedBy(areas: AreaRecord[], empleadoId: string | null): AreaRecord[] {
    if (!empleadoId) return [];
    const allowed = new Set(
      areas.filter((area) => area.jefeId === empleadoId).map((area) => area.id),
    );
    let changed = true;
    while (changed) {
      changed = false;
      for (const area of areas) {
        if (area.padreId && allowed.has(area.padreId) && !allowed.has(area.id)) {
          allowed.add(area.id);
          changed = true;
        }
      }
    }
    return areas.filter((area) => allowed.has(area.id));
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
