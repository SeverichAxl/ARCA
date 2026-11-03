import { Injectable } from '@nestjs/common';
import type { AuthRepository } from '../../../domain/auth/auth.ports';
import type { AuthSettings, AuthUser, RefreshSession } from '../../../domain/auth/auth.models';
import { PrismaService } from '../prisma.service';

const userInclude = {
  rol: { include: { permisos: { include: { permiso: true } } } },
} as const;

function mapUser(user: any): AuthUser {
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
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByUsername(username: string): Promise<AuthUser | null> {
    const user = await this.prisma.usuario.findUnique({
      where: { username },
      include: userInclude,
    });
    return user ? mapUser(user) : null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.usuario.findUnique({ where: { id }, include: userInclude });
    return user ? mapUser(user) : null;
  }

  async getSettings(): Promise<AuthSettings> {
    const rows = await this.prisma.configuracionSistema.findMany({
      where: {
        clave: {
          in: [
            'MAX_FAILED_LOGIN_ATTEMPTS',
            'LOGIN_LOCK_MINUTES',
            'JWT_ACCESS_TTL_MIN',
            'JWT_REFRESH_TTL_H',
          ],
        },
      },
    });
    const values = new Map(rows.map((row) => [row.clave, Number(row.valor)]));
    return {
      maxFailedAttempts: values.get('MAX_FAILED_LOGIN_ATTEMPTS') ?? 3,
      lockMinutes: values.get('LOGIN_LOCK_MINUTES') ?? 15,
      accessTtlMinutes: values.get('JWT_ACCESS_TTL_MIN') ?? 15,
      refreshTtlHours: values.get('JWT_REFRESH_TTL_H') ?? 8,
    };
  }

  async recordFailedAttempt(user: AuthUser, settings: AuthSettings, now: Date): Promise<void> {
    const attempts = user.intentosFallidos + 1;
    await this.prisma.usuario.update({
      where: { id: user.id },
      data: {
        intentosFallidos: attempts >= settings.maxFailedAttempts ? 0 : attempts,
        bloqueadoHasta:
          attempts >= settings.maxFailedAttempts
            ? new Date(now.getTime() + settings.lockMinutes * 60_000)
            : user.bloqueadoHasta,
      },
    });
  }

  async recordSuccessfulLogin(userId: string, now: Date): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoLoginEn: now },
    });
  }

  async createRefreshToken(data: {
    id: string;
    usuarioId: string;
    familyId: string;
    tokenHash: string;
    expiraEn: Date;
    ipOrigen?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.refreshToken.create({ data });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshSession | null> {
    const session = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { usuario: { include: userInclude } },
    });
    if (!session) return null;
    return {
      id: session.id,
      familyId: session.familyId,
      usuarioId: session.usuarioId,
      tokenHash: session.tokenHash,
      reemplazadoPor: session.reemplazadoPor,
      expiraEn: session.expiraEn,
      revocadoEn: session.revocadoEn,
      user: mapUser(session.usuario),
    };
  }

  async rotateRefreshToken(data: {
    current: RefreshSession;
    newId: string;
    newHash: string;
    newExpiresAt: Date;
    now: Date;
    ipOrigen?: string;
    userAgent?: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.refreshToken.updateMany({
        where: {
          id: data.current.id,
          revocadoEn: null,
          reemplazadoPor: null,
          expiraEn: { gt: data.now },
        },
        data: { revocadoEn: data.now, reemplazadoPor: data.newId },
      });
      if (updated.count !== 1) return false;
      await tx.refreshToken.create({
        data: {
          id: data.newId,
          usuarioId: data.current.usuarioId,
          familyId: data.current.familyId,
          tokenHash: data.newHash,
          expiraEn: data.newExpiresAt,
          ipOrigen: data.ipOrigen,
          userAgent: data.userAgent,
        },
      });
      return true;
    });
  }

  async revokeRefreshFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revocadoEn: null },
      data: { revocadoEn: now },
    });
  }

  async revokeUserSessions(userId: string, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId: userId, revocadoEn: null },
      data: { revocadoEn: now },
    });
  }
}
