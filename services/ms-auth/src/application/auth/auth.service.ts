import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AUDIT_RECORDER, type AuditEntry, type AuditRecorder } from '@arca/audit';
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
import { LoginRateLimiter } from './login-rate-limiter';

export interface RequestMetadata {
  ipOrigen?: string;
  userAgent?: string;
}

const authError = (code: string, message: string) => new UnauthorizedException({ code, message });

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Optional() private readonly rateLimiter: LoginRateLimiter = new LoginRateLimiter(),
    @Optional()
    @Inject(AUDIT_RECORDER)
    private readonly auditRecorder?: AuditRecorder,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = this.passwordHasher.hash(randomUUID());
    await this.dummyHash;
  }

  async login(dto: LoginDto, metadata: RequestMetadata = {}): Promise<SessionTokens> {
    try {
      this.rateLimiter.consume(metadata.ipOrigen, dto.username);
    } catch (error) {
      await this.recordSecurity({
        accion: 'LOGIN_FALLIDO',
        usuarioId: null,
        recurso: '/auth/login',
        metadata,
        payload: { antes: null, despues: { motivo: 'RATE_LIMITED' } },
      });
      throw error;
    }

    const now = new Date();
    const settings = await this.repository.getSettings();
    const user = await this.repository.findUserByUsername(dto.username);
    if (!user) {
      await this.verifyDummyPassword(dto.password);
      await this.recordSecurity({
        accion: 'LOGIN_FALLIDO',
        usuarioId: null,
        recurso: '/auth/login',
        metadata,
        payload: { antes: null, despues: { motivo: 'CREDENCIALES_INVALIDAS' } },
      });
      throw authError('AUTH_INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    }

    if (user.estado !== 'ACTIVO' || (user.bloqueadoHasta && user.bloqueadoHasta > now)) {
      await this.recordSecurity({
        accion: 'CUENTA_BLOQUEADA',
        usuarioId: user.id,
        empleadoId: user.empleadoId,
        recurso: '/auth/login',
        metadata,
        payload: {
          antes: null,
          despues: {
            motivo: user.estado !== 'ACTIVO' ? 'ESTADO_NO_ACTIVO' : 'BLOQUEO_TEMPORAL',
          },
        },
      });
      throw authError('AUTH_ACCOUNT_LOCKED', 'La cuenta no está disponible temporalmente.');
    }

    if (!(await this.passwordHasher.verify(user.passwordHash, dto.password))) {
      await this.repository.recordFailedAttempt(user, settings, now);
      await this.recordSecurity({
        accion: 'LOGIN_FALLIDO',
        usuarioId: user.id,
        empleadoId: user.empleadoId,
        recurso: '/auth/login',
        metadata,
        payload: { antes: null, despues: { motivo: 'CREDENCIALES_INVALIDAS' } },
      });
      throw authError('AUTH_INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    }

    await this.repository.recordSuccessfulLogin(user.id, now);
    const tokens = await this.createSession(
      user,
      settings.accessTtlMinutes,
      settings.refreshTtlHours,
      metadata,
    );
    await this.recordSecurity({
      accion: 'LOGIN',
      usuarioId: user.id,
      empleadoId: user.empleadoId,
      recurso: '/auth/login',
      metadata,
      payload: { antes: null, despues: { rol: user.rol.codigo } },
    });
    return tokens;
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
      await this.recordSecurity({
        accion: 'AUTH_REFRESH_REUSED',
        usuarioId: session.user.id,
        empleadoId: session.user.empleadoId,
        recurso: '/auth/refresh',
        metadata,
        payload: { antes: null, despues: { motivo: 'REFRESH_REUTILIZADO' } },
      });
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
      await this.recordSecurity({
        accion: 'CUENTA_BLOQUEADA',
        usuarioId: session.user.id,
        empleadoId: session.user.empleadoId,
        recurso: '/auth/refresh',
        metadata,
        payload: { antes: null, despues: { motivo: 'CUENTA_NO_DISPONIBLE' } },
      });
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
      await this.recordSecurity({
        accion: 'AUTH_REFRESH_REUSED',
        usuarioId: session.user.id,
        empleadoId: session.user.empleadoId,
        recurso: '/auth/refresh',
        metadata,
        payload: { antes: null, despues: { motivo: 'REFRESH_REUTILIZADO' } },
      });
      throw authError('AUTH_REFRESH_REUSED', 'La sesión debe iniciarse nuevamente.');
    }

    await this.recordSecurity({
      accion: 'REFRESH_TOKEN_ROTAR',
      usuarioId: session.user.id,
      empleadoId: session.user.empleadoId,
      recurso: '/auth/refresh',
      metadata,
    });

    return {
      accessToken: this.signAccess(session.user, settings.accessTtlMinutes),
      refreshToken: next.token,
      tokenType: 'Bearer',
      expiresIn: settings.accessTtlMinutes * 60,
    };
  }

  async logout(
    refreshToken: string | undefined,
    authenticatedUserId?: string,
    authenticatedEmpleadoId?: string | null,
    metadata: RequestMetadata = {},
  ): Promise<void> {
    const now = new Date();

    if (!refreshToken) {
      if (!authenticatedUserId) {
        throw authError('AUTH_TOKEN_INVALID', 'La sesión no pudo autenticarse.');
      }
      await this.repository.revokeUserSessions(authenticatedUserId, now);
      await this.recordSecurity({
        accion: 'LOGOUT',
        usuarioId: authenticatedUserId,
        empleadoId: authenticatedEmpleadoId ?? null,
        recurso: '/auth/logout',
        metadata,
        payload: { antes: null, despues: { motivo: 'SIN_REFRESH_TOKEN' } },
      });
      return;
    }

    const session = await this.repository.findRefreshToken(
      this.tokenService.hashRefreshToken(refreshToken),
    );
    if (!session) {
      throw authError('AUTH_REFRESH_INVALID', 'El refresh token no es válido.');
    }
    if (authenticatedUserId && session.usuarioId !== authenticatedUserId) {
      throw authError('AUTH_REFRESH_INVALID', 'El refresh token no es válido.');
    }
    await this.repository.revokeRefreshFamily(session.familyId, now);
    await this.recordSecurity({
      accion: 'LOGOUT',
      usuarioId: authenticatedUserId ?? session.usuarioId,
      empleadoId: authenticatedEmpleadoId ?? session.user.empleadoId,
      recurso: '/auth/logout',
      metadata,
    });
  }

  private async verifyDummyPassword(password: string): Promise<void> {
    if (!this.dummyHash) {
      this.dummyHash = this.passwordHasher.hash(randomUUID());
    }
    const hash = await this.dummyHash;
    await this.passwordHasher.verify(hash, password);
  }

  private async recordSecurity(input: {
    accion: string;
    usuarioId: string | null;
    empleadoId?: string | null;
    recurso: string;
    metadata: RequestMetadata;
    payload?: AuditEntry['payload'];
  }): Promise<void> {
    if (!this.auditRecorder) return;

    const entry: AuditEntry = {
      eventId: randomUUID(),
      occurredOn: new Date(),
      usuarioId: input.usuarioId,
      empleadoId: input.empleadoId ?? null,
      ipOrigen: input.metadata.ipOrigen ?? null,
      modulo: 'auth',
      accion: input.accion,
      metodo: 'POST',
      recurso: input.recurso,
      resultado: 'EXITO',
      payload: input.payload ?? { antes: null, despues: null },
    };

    try {
      await this.auditRecorder.record(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `No se pudo registrar la auditoría de seguridad eventId=${entry.eventId} ` +
          `accion=${entry.accion} usuarioId=${entry.usuarioId ?? 'null'}: ${message}`,
      );
    }
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
