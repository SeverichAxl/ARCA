import { HttpException } from '@nestjs/common';
import type { AuditRecorder } from '@arca/audit';
import type { AuthRepository, PasswordHasher, TokenService } from '../../domain/auth/auth.ports';
import type { AuthSettings, AuthUser } from '../../domain/auth/auth.models';
import { AuthService } from './auth.service';
import { LoginRateLimiter } from './login-rate-limiter';

const settings: AuthSettings = {
  maxFailedAttempts: 3,
  lockMinutes: 15,
  accessTtlMinutes: 15,
  refreshTtlHours: 8,
};

const user = (): AuthUser => ({
  id: '00000000-0000-4000-8000-000000000001',
  username: 'admin',
  email: null,
  passwordHash: 'argon-real',
  estado: 'ACTIVO',
  intentosFallidos: 0,
  bloqueadoHasta: null,
  empleadoId: null,
  rol: { id: 'role-id', codigo: 'ADMIN_GENERAL', nombre: 'Admin', permisos: [] },
});

function repositoryMock(): jest.Mocked<AuthRepository> {
  return {
    findUserByUsername: jest.fn(),
    findUserById: jest.fn(),
    getSettings: jest.fn().mockResolvedValue(settings),
    recordFailedAttempt: jest.fn(),
    recordSuccessfulLogin: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeRefreshFamily: jest.fn(),
    revokeUserSessions: jest.fn(),
  };
}

const tokenMock = (): jest.Mocked<TokenService> => ({
  signAccessToken: jest.fn().mockReturnValue('access.jwt'),
  generateRefreshToken: jest.fn().mockReturnValue({ token: 'refresh', hash: 'hash' }),
  hashRefreshToken: jest.fn().mockReturnValue('hash'),
});

describe('AuthService endurecimiento de login', () => {
  it('verifica contra el hash falso cuando el usuario no existe y responde igual que una contraseña incorrecta', async () => {
    const repository = repositoryMock();
    const hasher: PasswordHasher = {
      hash: jest.fn().mockResolvedValue('argon-dummy'),
      verify: jest.fn().mockResolvedValue(false),
    };
    const service = new AuthService(repository, hasher, tokenMock(), new LoginRateLimiter());

    repository.findUserByUsername.mockResolvedValueOnce(null);
    const inexistente = await service
      .login({ username: 'noexiste', password: 'Mala1!' })
      .catch((error: unknown) => error);

    expect(hasher.hash).toHaveBeenCalledTimes(1);
    expect(hasher.verify).toHaveBeenCalledWith('argon-dummy', 'Mala1!');

    repository.findUserByUsername.mockResolvedValueOnce(user());
    const existente = await service
      .login({ username: 'admin', password: 'Mala1!' })
      .catch((error: unknown) => error);

    expect(hasher.verify).toHaveBeenCalledWith('argon-real', 'Mala1!');
    expect((inexistente as HttpException).getStatus()).toBe(
      (existente as HttpException).getStatus(),
    );
    expect((inexistente as HttpException).getResponse()).toEqual(
      (existente as HttpException).getResponse(),
    );
  });

  it('el LOGIN_FALLIDO de un usuario inexistente no guarda el nombre intentado', async () => {
    const repository = repositoryMock();
    repository.findUserByUsername.mockResolvedValue(null);
    const recorder: jest.Mocked<AuditRecorder> = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      repository,
      {
        hash: jest.fn().mockResolvedValue('argon-dummy'),
        verify: jest.fn().mockResolvedValue(false),
      },
      tokenMock(),
      new LoginRateLimiter(),
      recorder,
    );

    await expect(
      service.login({ username: 'miPasswordSecreta1!', password: 'x' }),
    ).rejects.toMatchObject({ response: { code: 'AUTH_INVALID_CREDENTIALS' } });

    expect(recorder.record).toHaveBeenCalledTimes(1);
    const entry = recorder.record.mock.calls[0][0];
    expect(entry.accion).toBe('LOGIN_FALLIDO');
    expect(entry.usuarioId).toBeNull();
    expect(JSON.stringify(entry)).not.toContain('miPasswordSecreta1!');
  });

  it('limita por IP y por usuario normalizado, incluso si el usuario no existe', async () => {
    const limiter = new LoginRateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      limiter.consume(`10.0.0.${attempt}`, '  Usuario Inexistente  ');
    }
    expect(() => limiter.consume('10.0.0.99', 'usuarioinexistente')).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'RATE_LIMITED' }) }),
    );

    const ipLimiter = new LoginRateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      ipLimiter.consume('192.168.1.10', `usuario-${attempt}`);
    }
    expect(() => ipLimiter.consume('192.168.1.10', 'otro-usuario')).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'RATE_LIMITED' }) }),
    );
  });
});
