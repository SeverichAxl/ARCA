import { Injectable } from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import type {
  AreaUpdatedEventPayload,
  CatalogRepository,
  CreateAreaData,
  CreateCargoData,
  UpdateAreaData,
  UpdateCargoData,
} from '../../../domain/catalogs/catalog.repository';
import type {
  AreaListQuery,
  AreaRecord,
  CargoListQuery,
} from '../../../domain/catalogs/catalog.models';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listAreas(query: AreaListQuery) {
    const where = {
      ...(query.activa === undefined ? {} : { activa: query.activa }),
      ...(query.padreId === undefined ? {} : { padreId: query.padreId }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.area.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.area.count({ where }),
    ]);
    return { data, total };
  }

  listAllAreas() {
    return this.prisma.area.findMany({ orderBy: { nombre: 'asc' } });
  }
  findAreaById(id: string) {
    return this.prisma.area.findUnique({ where: { id } });
  }
  createArea(data: CreateAreaData, emitEvent = false) {
    return this.prisma.$transaction(async (tx) => {
      const area = await tx.area.create({ data });
      if (emitEvent && area.jefeId) {
        await this.outbox.add(tx, 'AREA_ACTUALIZADA', this.areaPayload(area));
      }
      return area;
    });
  }
  updateArea(id: string, data: UpdateAreaData, emitEvent = false) {
    return this.prisma.$transaction(async (tx) => {
      const area = await tx.area.update({ where: { id }, data });
      if (emitEvent) {
        await this.outbox.add(tx, 'AREA_ACTUALIZADA', this.areaPayload(area));
      }
      return area;
    });
  }
  async deleteArea(id: string): Promise<void> {
    await this.prisma.area.delete({ where: { id } });
  }
  countAreaChildren(id: string) {
    return this.prisma.area.count({ where: { padreId: id } });
  }
  countAreaEmployees(id: string) {
    return this.prisma.empleado.count({ where: { areaId: id } });
  }
  employeeExists(id: string) {
    return this.prisma.empleado.findUnique({ where: { id }, select: { id: true } }).then(Boolean);
  }
  areaNameExists(nombre: string, padreId: string | null, excludeId?: string) {
    return this.prisma.area
      .findFirst({
        where: { nombre, padreId, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      })
      .then(Boolean);
  }

  async listCargos(query: CargoListQuery) {
    const where = query.activo === undefined ? {} : { activo: query.activo };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.cargo.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.cargo.count({ where }),
    ]);
    return { data, total };
  }

  findCargoById(id: string) {
    return this.prisma.cargo.findUnique({ where: { id } });
  }
  createCargo(data: CreateCargoData) {
    return this.prisma.cargo.create({ data });
  }
  updateCargo(id: string, data: UpdateCargoData) {
    return this.prisma.cargo.update({ where: { id }, data });
  }
  async deleteCargo(id: string): Promise<void> {
    await this.prisma.cargo.delete({ where: { id } });
  }
  countCargoEmployees(id: string) {
    return this.prisma.empleado.count({ where: { cargoId: id } });
  }
  cargoNameExists(nombre: string, excludeId?: string) {
    return this.prisma.cargo
      .findFirst({
        where: { nombre, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      })
      .then(Boolean);
  }

  private areaPayload(area: AreaRecord): AreaUpdatedEventPayload {
    return {
      areaId: area.id,
      nombre: area.nombre,
      padreId: area.padreId,
      jefeEmpleadoId: area.jefeId,
    };
  }
}
