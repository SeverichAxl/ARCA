import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AuditContext } from '@arca/audit';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/auth/auth.ports';
import { USER_REPOSITORY, type UserRepository } from '../../domain/users/user.ports';
import type {
  AssignRoleDto,
  CreateUserDto,
  ListUsersQueryDto,
  LinkEmployeeDto,
  ListPermissionsQueryDto,
  UpdateUserStatusDto,
} from './user.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Optional() private readonly auditContext?: AuditContext,
  ) {}

  async create(dto: CreateUserDto) {
    if (await this.repository.usernameExists(dto.username)) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'El nombre de usuario ya está registrado.',
      });
    }
    if (dto.email && (await this.repository.emailExists(dto.email))) {
      throw new ConflictException({ code: 'CONFLICT', message: 'El correo ya está registrado.' });
    }
    await this.requireRole(dto.rolId);
    const created = await this.repository.create({
      username: dto.username,
      email: dto.email ?? null,
      passwordHash: await this.passwordHasher.hash(dto.password),
      rolId: dto.rolId,
      empleadoId: null,
    });
    this.auditContext?.captureAfter(created);
    return created;
  }

  async list(query: ListUsersQueryDto) {
    const result = await this.repository.list(query);
    return {
      data: result.data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async get(id: string) {
    const user = await this.repository.findSafeById(id);
    if (!user)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Usuario no encontrado.' });
    return user;
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    const before = await this.get(id);
    this.auditContext?.captureBefore({ estado: before.estado });
    this.auditContext?.setAccion(
      dto.estado === 'ACTIVO'
        ? 'USUARIO_ACTIVAR'
        : dto.estado === 'INACTIVO'
          ? 'USUARIO_INACTIVAR'
          : 'USUARIO_BLOQUEAR',
    );
    const updated = await this.repository.updateStatus(id, dto.estado);
    this.auditContext?.captureAfter({ estado: updated.estado });
    return updated;
  }

  async unlock(id: string) {
    const user = await this.get(id);
    if (user.estado !== 'BLOQUEADO') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'El usuario no tiene un bloqueo manual.',
      });
    }
    this.auditContext?.captureBefore({ estado: user.estado });
    const unlocked = await this.repository.unlock(id);
    this.auditContext?.captureAfter({ estado: unlocked.estado });
    return unlocked;
  }

  async assignRole(id: string, dto: AssignRoleDto) {
    const before = await this.get(id);
    this.auditContext?.captureBefore({ rol: before.rol });
    await this.requireRole(dto.rolId);
    const updated = await this.repository.assignRole(id, dto.rolId);
    this.auditContext?.captureAfter({ rol: updated.rol });
    return updated;
  }

  listRoles() {
    return this.repository.listRoles().then((data) => ({ data }));
  }

  listPermissions(query: ListPermissionsQueryDto) {
    return this.repository.listPermissions(query.modulo).then((data) => ({ data }));
  }

  async linkEmployee(id: string, dto: LinkEmployeeDto) {
    const before = await this.get(id);
    this.auditContext?.captureBefore({ empleadoId: before.empleadoId });
    if (dto.empleadoId && (await this.repository.employeeLinked(dto.empleadoId, id))) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'El funcionario ya está vinculado a otro usuario.',
      });
    }
    const updated = await this.repository.linkEmployee(id, dto.empleadoId);
    this.auditContext?.captureAfter({ empleadoId: updated.empleadoId });
    return updated;
  }

  private async requireRole(id: string): Promise<void> {
    if (!(await this.repository.roleExists(id))) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Rol no encontrado.' });
    }
  }
}
