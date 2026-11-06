import { Injectable } from '@nestjs/common';
import type {
  UserRepository,
  UserListQuery,
  SafeUser,
  RoleView,
  PermissionView,
} from '../../../domain/users/user.ports';
import type { AuthUser, UserStatus } from '../../../domain/auth/auth.models';
import { PrismaService } from '../prisma.service';

const safeInclude = { rol: true } as const;
const authInclude = { rol: { include: { permisos: { include: { permiso: true } } } } } as const;

function mapSafe(user: any): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    estado: user.estado,
    empleadoId: user.empleadoId,
    rol: { id: user.rol.id, codigo: user.rol.codigo, nombre: user.rol.nombre },
    creadoEn: user.creadoEn,
    actualizadoEn: user.actualizadoEn,
  };
}

function mapAuth(user: any): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    passwordHash: user.passwordHash,
    estado: user.estado,
    intentosFallidos: user.intentosFallidos,
    bloqueadoHasta: user.bloqueadoHasta,
    empleadoId: user.empleadoId,
    rol: {
      id: user.rol.id,
      codigo: user.rol.codigo,
      nombre: user.rol.nombre,
      permisos: user.rol.permisos.map((item: any) => item.permiso.codigo),
    },
  };
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    username: string;
    email: string | null;
    passwordHash: string;
    rolId: string;
    empleadoId: string | null;
  }): Promise<SafeUser> {
    return mapSafe(await this.prisma.usuario.create({ data, include: safeInclude }));
  }

  async list(query: UserListQuery): Promise<{ data: SafeUser[]; total: number }> {
    const where = {
      ...(query.q
        ? {
            OR: [
              { username: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.rol ? { rol: { codigo: query.rol } } : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        where,
        include: safeInclude,
        orderBy: { username: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.usuario.count({ where }),
    ]);
    return { data: users.map(mapSafe), total };
  }

  async findSafeById(id: string): Promise<SafeUser | null> {
    const user = await this.prisma.usuario.findUnique({ where: { id }, include: safeInclude });
    return user ? mapSafe(user) : null;
  }

  async findAuthById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.usuario.findUnique({ where: { id }, include: authInclude });
    return user ? mapAuth(user) : null;
  }

  usernameExists(username: string): Promise<boolean> {
    return this.prisma.usuario
      .findUnique({ where: { username }, select: { id: true } })
      .then(Boolean);
  }
  emailExists(email: string): Promise<boolean> {
    return this.prisma.usuario.findUnique({ where: { email }, select: { id: true } }).then(Boolean);
  }
  employeeLinked(empleadoId: string, excludeUserId?: string): Promise<boolean> {
    return this.prisma.usuario
      .findFirst({
        where: { empleadoId, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
        select: { id: true },
      })
      .then(Boolean);
  }
  roleExists(id: string): Promise<boolean> {
    return this.prisma.rol.findUnique({ where: { id }, select: { id: true } }).then(Boolean);
  }

  async updateStatus(id: string, estado: UserStatus): Promise<SafeUser> {
    return mapSafe(
      await this.prisma.usuario.update({
        where: { id },
        data: {
          estado,
          ...(estado === 'ACTIVO' ? { bloqueadoHasta: null, intentosFallidos: 0 } : {}),
        },
        include: safeInclude,
      }),
    );
  }

  async unlock(id: string): Promise<SafeUser> {
    return this.updateStatus(id, 'ACTIVO');
  }

  async assignRole(id: string, rolId: string): Promise<SafeUser> {
    return mapSafe(
      await this.prisma.usuario.update({ where: { id }, data: { rolId }, include: safeInclude }),
    );
  }

  async listRoles(): Promise<RoleView[]> {
    const roles = await this.prisma.rol.findMany({
      include: { permisos: { include: { permiso: true } } },
      orderBy: { codigo: 'asc' },
    });
    return roles.map((role) => ({
      id: role.id,
      codigo: role.codigo,
      nombre: role.nombre,
      descripcion: role.descripcion,
      permisos: role.permisos.map((item) => item.permiso.codigo).sort(),
    }));
  }

  async listPermissions(modulo?: string): Promise<PermissionView[]> {
    return this.prisma.permiso.findMany({
      where: modulo ? { modulo } : undefined,
      orderBy: { codigo: 'asc' },
    });
  }

  async linkEmployee(id: string, empleadoId: string | null): Promise<SafeUser> {
    return mapSafe(
      await this.prisma.usuario.update({
        where: { id },
        data: { empleadoId },
        include: safeInclude,
      }),
    );
  }
}
