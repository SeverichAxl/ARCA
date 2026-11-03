import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type { AuthRepository, PasswordHasher, TokenService } from '../../domain/auth/auth.ports';
import type { AuthSettings, AuthUser, RefreshSession } from '../../domain/auth/auth.models';
import { Rs256TokenService } from '../../infrastructure/security/rs256-token.service';
import { AuthService } from './auth.service';

const settings: AuthSettings = {
  maxFailedAttempts: 3,
  lockMinutes: 15,
  accessTtlMinutes: 15,
  refreshTtlHours: 8,
};

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: '00000000-0000-4000-8000-000000000001',
  username: 'admin',
  email: null,
  passwordHash: 'argon-hash',
  estado: 'ACTIVO',
  intentosFallidos: 0,
  bloqueadoHasta: null,
  empleadoId: '00000000-0000-4000-8000-000000000002',
  rol: { id: 'role-id', codigo: 'ADMIN_GENERAL', nombre: 'Admin', permisos: ['usuario:read'] },
  ...overrides,
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

function tokenMock(): jest.Mocked<TokenService> {
  return {
    signAccessToken: jest.fn().mockReturnValue('access.jwt'),
    generateRefreshToken: jest
      .fn()
      .mockReturnValue({ token: 'refresh-plain', hash: 'refresh-sha256' }),
    hashRefreshToken: jest.fn().mockReturnValue('refresh-sha256'),
  };
}

describe('AuthService', () => {
  it('inicia sesión con contraseña válida y guarda solo el hash del refresh', async () => {
    const repository = repositoryMock();
    repository.findUserByUsername.mockResolvedValue(user());
    const hasher: PasswordHasher = { hash: jest.fn(), verify: jest.fn().mockResolvedValue(true) };
    const tokens = tokenMock();
    const service = new AuthService(repository, hasher, tokens);

    await expect(service.login({ username: 'admin', password: 'Valid1!' })).resolves.toMatchObject({
      accessToken: 'access.jwt',
      refreshToken: 'refresh-plain',
      expiresIn: 900,
    });
    expect(repository.createRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: 'refresh-sha256' }),
    );
    expect(repository.createRefreshToken).not.toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: 'refresh-plain' }),
    );
    expect(repository.recordSuccessfulLogin).toHaveBeenCalled();
  });

  it('usa error genérico para contraseña inválida y registra el tercer fallo', async () => {
    const repository = repositoryMock();
    const thirdAttempt = user({ intentosFallidos: 2 });
    repository.findUserByUsername.mockResolvedValue(thirdAttempt);
    const hasher: PasswordHasher = { hash: jest.fn(), verify: jest.fn().mockResolvedValue(false) };
    const service = new AuthService(repository, hasher, tokenMock());

    await expect(service.login({ username: 'admin', password: 'bad' })).rejects.toMatchObject({
      response: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' },
    });
    expect(repository.recordFailedAttempt).toHaveBeenCalledWith(
      thirdAttempt,
      settings,
      expect.any(Date),
    );
  });

  it.each([user({ bloqueadoHasta: new Date(Date.now() + 60_000) }), user({ estado: 'BLOQUEADO' })])(
    'rechaza usuarios bloqueados temporal o manualmente',
    async (blockedUser) => {
      const repository = repositoryMock();
      repository.findUserByUsername.mockResolvedValue(blockedUser);
      const hasher: PasswordHasher = { hash: jest.fn(), verify: jest.fn() };
      const service = new AuthService(repository, hasher, tokenMock());
      await expect(service.login({ username: 'admin', password: 'Valid1!' })).rejects.toMatchObject(
        {
          response: { code: 'AUTH_ACCOUNT_LOCKED' },
        },
      );
      expect(hasher.verify).not.toHaveBeenCalled();
    },
  );

  it('rota un refresh válido', async () => {
    const repository = repositoryMock();
    const session: RefreshSession = {
      id: 'old',
      familyId: 'family',
      usuarioId: user().id,
      tokenHash: 'old-hash',
      reemplazadoPor: null,
      expiraEn: new Date(Date.now() + 60_000),
      revocadoEn: null,
      user: user(),
    };
    repository.findRefreshToken.mockResolvedValue(session);
    repository.rotateRefreshToken.mockResolvedValue(true);
    const service = new AuthService(
      repository,
      { hash: jest.fn(), verify: jest.fn() },
      tokenMock(),
    );
    const result = await service.refresh('old-token');
    expect(result.refreshToken).toBe('refresh-plain');
    expect(repository.rotateRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ current: session, newHash: 'refresh-sha256' }),
    );
  });

  it('detecta reutilización y revoca la familia', async () => {
    const repository = repositoryMock();
    repository.findRefreshToken.mockResolvedValue({
      id: 'old',
      familyId: 'family',
      usuarioId: user().id,
      tokenHash: 'old-hash',
      reemplazadoPor: 'new',
      expiraEn: new Date(Date.now() + 60_000),
      revocadoEn: new Date(),
      user: user(),
    });
    const service = new AuthService(
      repository,
      { hash: jest.fn(), verify: jest.fn() },
      tokenMock(),
    );
    await expect(service.refresh('old-token')).rejects.toMatchObject({
      response: { code: 'AUTH_REFRESH_REUSED' },
    });
    expect(repository.revokeRefreshFamily).toHaveBeenCalledWith('family', expect.any(Date));
  });

  it('revoca la familia del refresh durante logout', async () => {
    const repository = repositoryMock();
    repository.findRefreshToken.mockResolvedValue({
      id: 'session',
      familyId: 'family',
      usuarioId: user().id,
      tokenHash: 'refresh-sha256',
      reemplazadoPor: null,
      expiraEn: new Date(Date.now() + 60_000),
      revocadoEn: null,
      user: user(),
    });
    const service = new AuthService(
      repository,
      { hash: jest.fn(), verify: jest.fn() },
      tokenMock(),
    );

    await expect(service.logout('refresh-token')).resolves.toBeUndefined();
    expect(repository.revokeRefreshFamily).toHaveBeenCalledWith('family', expect.any(Date));
  });
});

describe('Rs256TokenService', () => {
  it('firma RS256 con empleadoId y TTL de 15 minutos', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const service = new Rs256TokenService(
      new ConfigService({
        JWT_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        JWT_ISSUER: 'arca-auth',
        JWT_AUDIENCE: 'arca-services',
        JWT_KID: 'test-key',
      }),
    );
    const token = service.signAccessToken(
      {
        sub: user().id,
        empleadoId: user().empleadoId,
        rol: 'ADMIN_GENERAL',
        permisos: ['usuario:read'],
      },
      15,
    );
    const decoded = jwt.verify(token, publicKey.export({ type: 'spki', format: 'pem' }), {
      algorithms: ['RS256'],
      issuer: 'arca-auth',
      audience: 'arca-services',
    }) as jwt.JwtPayload & { empleadoId: string };
    expect(decoded.empleadoId).toBe(user().empleadoId);
    expect(decoded.exp! - decoded.iat!).toBe(900);
  });
});
