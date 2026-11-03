import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AUTH_REPOSITORY,
  PASSWORD_HASHER,
  TOKEN_SERVICE,
  type AuthRepository,
  type PasswordHasher,
  type TokenService,
} from '../../domain/auth/auth.ports';
import type { AuthUser, SessionTokens } from '../../domain/auth/auth.models';
import type { LoginDto } from './auth.dto';

export interface RequestMetadata {
  ipOrigen?: string;
  userAgent?: string;
}

const authError = (code: string, message: string) => new UnauthorizedException({ code, message });

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
  ) {}

  async login(dto: LoginDto, metadata: RequestMetadata = {}): Promise<SessionTokens> {
    const now = new Date();
    const settings = await this.repository.getSettings();
    const user = await this.repository.findUserByUsername(dto.username);
    if (!user) throw authError('AUTH_INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');

    if (user.estado !== 'ACTIVO' || (user.bloqueadoHasta && user.bloqueadoHasta > now)) {
      throw authError('AUTH_ACCOUNT_LOCKED', 'La cuenta no está disponible temporalmente.');
    }

    if (!(await this.passwordHasher.verify(user.passwordHash, dto.password))) {
      await this.repository.recordFailedAttempt(user, settings, now);
      throw authError('AUTH_INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    }

    await this.repository.recordSuccessfulLogin(user.id, now);
    return this.createSession(user, settings.accessTtlMinutes, settings.refreshTtlHours, metadata);
  }

  async refresh(refreshToken: string, metadata: RequestMetadata = {}): Promise<SessionTokens> {
    const now = new Date();
    const settings = await this.repository.getSettings();
    const session = await this.repository.findRefreshToken(
      this.tokenService.hashRefreshToken(refreshToken),
    );
    if (!session) throw authError('AUTH_REFRESH_INVALID', 'El refresh token no es válido.');

    if (session.reemplazadoPor || session.revocadoEn) {
      await this.repository.revokeRefreshFamily(session.familyId, now);
      throw authError('AUTH_REFRESH_REUSED', 'La sesión debe iniciarse nuevamente.');
    }
    if (session.expiraEn <= now) {
      throw authError('AUTH_REFRESH_INVALID', 'El refresh token no es válido.');
    }
    if (
      session.user.estado !== 'ACTIVO' ||
      (session.user.bloqueadoHasta && session.user.bloqueadoHasta > now)
    ) {
      await this.repository.revokeRefreshFamily(session.familyId, now);
      throw authError('AUTH_ACCOUNT_LOCKED', 'La cuenta no está disponible temporalmente.');
    }

    const next = this.tokenService.generateRefreshToken();
    const nextId = randomUUID();
    const rotated = await this.repository.rotateRefreshToken({
      current: session,
      newId: nextId,
      newHash: next.hash,
      newExpiresAt: new Date(now.getTime() + settings.refreshTtlHours * 3_600_000),
      now,
      ...metadata,
    });
    if (!rotated) {
      await this.repository.revokeRefreshFamily(session.familyId, now);
      throw authError('AUTH_REFRESH_REUSED', 'La sesión debe iniciarse nuevamente.');
    }

    return {
      accessToken: this.signAccess(session.user, settings.accessTtlMinutes),
      refreshToken: next.token,
      tokenType: 'Bearer',
      expiresIn: settings.accessTtlMinutes * 60,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.repository.findRefreshToken(
      this.tokenService.hashRefreshToken(refreshToken),
    );
    if (!session) {
      throw authError('AUTH_REFRESH_INVALID', 'El refresh token no es válido.');
    }
    await this.repository.revokeRefreshFamily(session.familyId, new Date());
  }

  private async createSession(
    user: AuthUser,
    accessTtlMinutes: number,
    refreshTtlHours: number,
    metadata: RequestMetadata,
  ): Promise<SessionTokens> {
    const refresh = this.tokenService.generateRefreshToken();
    await this.repository.createRefreshToken({
      id: randomUUID(),
      usuarioId: user.id,
      familyId: randomUUID(),
      tokenHash: refresh.hash,
      expiraEn: new Date(Date.now() + refreshTtlHours * 3_600_000),
      ...metadata,
    });
    return {
      accessToken: this.signAccess(user, accessTtlMinutes),
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      expiresIn: accessTtlMinutes * 60,
    };
  }

  private signAccess(user: AuthUser, ttlMinutes: number): string {
    return this.tokenService.signAccessToken(
      {
        sub: user.id,
        empleadoId: user.empleadoId,
        rol: user.rol.codigo,
        permisos: user.rol.permisos,
      },
      ttlMinutes,
    );
  }
}
