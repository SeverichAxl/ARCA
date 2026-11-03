import { validate } from 'class-validator';
import type { PasswordHasher } from '../../domain/auth/auth.ports';
import type { UserRepository } from '../../domain/users/user.ports';
import { CreateUserDto } from './user.dto';
import { UserService } from './user.service';

function repositoryMock(): jest.Mocked<UserRepository> {
  return {
    create: jest.fn(),
    list: jest.fn(),
    findSafeById: jest.fn(),
    findAuthById: jest.fn(),
    usernameExists: jest.fn(),
    emailExists: jest.fn(),
    employeeLinked: jest.fn(),
    roleExists: jest.fn(),
    updateStatus: jest.fn(),
    unlock: jest.fn(),
    assignRole: jest.fn(),
    listRoles: jest.fn(),
    listPermissions: jest.fn(),
    linkEmployee: jest.fn(),
  };
}

describe('UserService', () => {
  it('rechaza una contraseña débil mediante el DTO', async () => {
    const dto = Object.assign(new CreateUserDto(), {
      username: 'nuevo.usuario',
      password: 'debil123',
      rolId: '00000000-0000-4000-8000-000000000001',
    });
    expect((await validate(dto)).some((error) => error.property === 'password')).toBe(true);
  });

  it('almacena la contraseña hasheada y nunca el texto plano', async () => {
    const repository = repositoryMock();
    repository.roleExists.mockResolvedValue(true);
    repository.create.mockResolvedValue({} as never);
    const hasher: PasswordHasher = {
      hash: jest.fn().mockResolvedValue('argon2id-hash'),
      verify: jest.fn(),
    };
    const service = new UserService(repository, hasher);
    await service.create({ username: 'nuevo.usuario', password: 'Valid1!', rolId: 'role-id' });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'argon2id-hash' }),
    );
    expect(repository.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'Valid1!' }),
    );
  });

  it('rechaza usuario duplicado', async () => {
    const repository = repositoryMock();
    repository.usernameExists.mockResolvedValue(true);
    const service = new UserService(repository, { hash: jest.fn(), verify: jest.fn() });
    await expect(
      service.create({ username: 'admin', password: 'Valid1!', rolId: 'role-id' }),
    ).rejects.toMatchObject({ response: { code: 'CONFLICT' } });
  });

  it('rechaza un rol inexistente', async () => {
    const repository = repositoryMock();
    repository.roleExists.mockResolvedValue(false);
    const service = new UserService(repository, { hash: jest.fn(), verify: jest.fn() });
    await expect(
      service.create({ username: 'nuevo', password: 'Valid1!', rolId: 'missing' }),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });

  it('impide vincular un funcionario asociado a otro usuario', async () => {
    const repository = repositoryMock();
    repository.findSafeById.mockResolvedValue({ id: 'user-id' } as never);
    repository.employeeLinked.mockResolvedValue(true);
    const service = new UserService(repository, { hash: jest.fn(), verify: jest.fn() });

    await expect(
      service.linkEmployee('user-id', {
        empleadoId: '00000000-0000-4000-8000-000000000002',
      }),
    ).rejects.toMatchObject({ response: { code: 'CONFLICT' } });
    expect(repository.linkEmployee).not.toHaveBeenCalled();
  });

  it('permite desvincular un funcionario', async () => {
    const repository = repositoryMock();
    repository.findSafeById.mockResolvedValue({ id: 'user-id' } as never);
    repository.linkEmployee.mockResolvedValue({ empleadoId: null } as never);
    const service = new UserService(repository, { hash: jest.fn(), verify: jest.fn() });

    await service.linkEmployee('user-id', { empleadoId: null });
    expect(repository.linkEmployee).toHaveBeenCalledWith('user-id', null);
  });
});
