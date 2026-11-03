import { Injectable } from '@nestjs/common';
import type {
  AreaResumen,
  CargoResumen,
  OrgCatalogPort,
} from '../../../domain/employees/org-catalog.port';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaOrgCatalogAdapter implements OrgCatalogPort {
  constructor(private readonly prisma: PrismaService) {}

  async findArea(id: string): Promise<AreaResumen | null> {
    return this.prisma.area.findUnique({
      where: { id },
      select: { id: true, jefeId: true, activa: true },
    });
  }

  async findCargo(id: string): Promise<CargoResumen | null> {
    return this.prisma.cargo.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
  }

  async findAreaIdsLedBy(empleadoId: string): Promise<string[]> {
    const rows = await this.prisma.area.findMany({
      where: { jefeId: empleadoId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
