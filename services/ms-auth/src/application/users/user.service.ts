import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
    return this.repository.create({
      username: dto.username,
      email: dto.email ?? null,
      passwordHash: await this.passwordHasher.hash(dto.password),
      rolId: dto.rolId,
      empleadoId: null,
    });
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
    await this.get(id);
    return this.repository.updateStatus(id, dto.estado);
  }

  async unlock(id: string) {
    const user = await this.get(id);
    if (user.estado !== 'BLOQUEADO') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'El usuario no tiene un bloqueo manual.',
      });
    }
    return this.repository.unlock(id);
  }

  async assignRole(id: string, dto: AssignRoleDto) {
    await this.get(id);
    await this.requireRole(dto.rolId);
    return this.repository.assignRole(id, dto.rolId);
  }

  listRoles() {
    return this.repository.listRoles().then((data) => ({ data }));
  }

  listPermissions(query: ListPermissionsQueryDto) {
    return this.repository.listPermissions(query.modulo).then((data) => ({ data }));
  }

  async linkEmployee(id: string, dto: LinkEmployeeDto) {
    await this.get(id);
    if (dto.empleadoId && (await this.repository.employeeLinked(dto.empleadoId, id))) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'El funcionario ya está vinculado a otro usuario.',
      });
    }
    return this.repository.linkEmployee(id, dto.empleadoId);
  }

  private async requireRole(id: string): Promise<void> {
    if (!(await this.repository.roleExists(id))) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Rol no encontrado.' });
    }
  }
}
