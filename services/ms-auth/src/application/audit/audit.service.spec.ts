import type { AuditRepository } from '../../domain/audit/audit.repository';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('rechaza rangos de fechas invertidos', async () => {
    const repository: jest.Mocked<AuditRepository> = { list: jest.fn() };
    const service = new AuditService(repository);

    await expect(
      service.list({
        desde: '2026-11-02T12:00:00.000Z',
        hasta: '2026-11-01T12:00:00.000Z',
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('retorna auditoría paginada', async () => {
    const repository: jest.Mocked<AuditRepository> = {
      list: jest.fn().mockResolvedValue({ data: [], total: 21 }),
    };
    const service = new AuditService(repository);

    await expect(service.list({ page: 2, pageSize: 10 })).resolves.toEqual({
      data: [],
      meta: { page: 2, pageSize: 10, total: 21, totalPages: 3 },
    });
  });
});
