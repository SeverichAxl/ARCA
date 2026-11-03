import type { AuthSettings, AuthUser, RefreshSession } from './auth.models';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface AuthRepository {
  findUserByUsername(username: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  getSettings(): Promise<AuthSettings>;
  recordFailedAttempt(user: AuthUser, settings: AuthSettings, now: Date): Promise<void>;
  recordSuccessfulLogin(userId: string, now: Date): Promise<void>;
  createRefreshToken(data: {
    id: string;
    usuarioId: string;
    familyId: string;
    tokenHash: string;
    expiraEn: Date;
    ipOrigen?: string;
    userAgent?: string;
  }): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshSession | null>;
  rotateRefreshToken(data: {
    current: RefreshSession;
    newId: string;
    newHash: string;
    newExpiresAt: Date;
    now: Date;
    ipOrigen?: string;
    userAgent?: string;
  }): Promise<boolean>;
  revokeRefreshFamily(familyId: string, now: Date): Promise<void>;
  revokeUserSessions(userId: string, now: Date): Promise<void>;
}
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface TokenService {
  signAccessToken(
    payload: {
      sub: string;
      empleadoId: string | null;
      rol: string;
      permisos: string[];
    },
    ttlMinutes: number,
  ): string;
  generateRefreshToken(): { token: string; hash: string };
  hashRefreshToken(token: string): string;
}
