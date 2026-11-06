import { PrismaAuthRepository } from './prisma-auth.repository';

describe('PrismaAuthRepository', () => {
  it('el tercer intento fallido reinicia el contador y bloquea durante 15 minutos', async () => {
    const update = jest.fn().mockResolvedValue({});
    const repository = new PrismaAuthRepository({ usuario: { update } } as never);
    const now = new Date('2026-11-01T12:00:00.000Z');

    await repository.recordFailedAttempt(
      {
        id: 'user-id',
        username: 'admin',
        email: null,
        passwordHash: 'hash',
        estado: 'ACTIVO',
        intentosFallidos: 2,
        bloqueadoHasta: null,
        empleadoId: null,
        rol: { id: 'role-id', codigo: 'ADMIN_GENERAL', nombre: 'Admin', permisos: [] },
      },
      { maxFailedAttempts: 3, lockMinutes: 15, accessTtlMinutes: 15, refreshTtlHours: 8 },
      now,
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: {
        intentosFallidos: 0,
        bloqueadoHasta: new Date('2026-11-01T12:15:00.000Z'),
      },
    });
  });
});
