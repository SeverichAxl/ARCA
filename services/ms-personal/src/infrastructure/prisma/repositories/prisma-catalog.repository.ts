import { Injectable } from '@nestjs/common';
import type {
  CatalogRepository,
  CreateAreaData,
  CreateCargoData,
  UpdateAreaData,
  UpdateCargoData,
} from '../../../domain/catalogs/catalog.repository';
import type { AreaListQuery, CargoListQuery } from '../../../domain/catalogs/catalog.models';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

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
  createArea(data: CreateAreaData) {
    return this.prisma.area.create({ data });
  }
  updateArea(id: string, data: UpdateAreaData) {
    return this.prisma.area.update({ where: { id }, data });
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
}
