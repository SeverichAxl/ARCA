export type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string;
  estado: UserStatus;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
  empleadoId: string | null;
  rol: { id: string; codigo: string; nombre: string; permisos: string[] };
}
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthSettings {
  maxFailedAttempts: number;
  lockMinutes: number;
  accessTtlMinutes: number;
  refreshTtlHours: number;
}

export interface RefreshSession {
  id: string;
  familyId: string;
  usuarioId: string;
  tokenHash: string;
  reemplazadoPor: string | null;
  expiraEn: Date;
  revocadoEn: Date | null;
  user: AuthUser;
}
