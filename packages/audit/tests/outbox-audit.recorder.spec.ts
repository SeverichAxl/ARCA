import { OutboxService } from '@arca/messaging';
import { OutboxAuditRecorder } from '../src/adapters/outbox-audit.recorder';
import type { AuditEntry } from '../src/audit.types';

const entry: AuditEntry = {
  eventId: '00000000-0000-4000-8000-000000000001',
  occurredOn: new Date('2026-01-02T03:04:05.000Z'),
  usuarioId: '00000000-0000-4000-8000-000000000002',
  empleadoId: null,
  ipOrigen: '10.0.0.1',
  modulo: 'personal',
  accion: 'AREA_ACTUALIZAR',
  metodo: 'PATCH',
  recurso: '/areas/:id',
  resultado: 'EXITO',
  payload: {
    antes: { nombre: 'Antes', ci: '12345678' },
    despues: { nombre: 'Después', remuneracion: 1000 },
  },
};

describe('OutboxAuditRecorder', () => {
  it('inserta AUDITORIA_REGISTRADA en la misma transacción y enmascara antes de publicar', async () => {
    const tx = { outboxEvento: { create: jest.fn() } };
    const prisma = {
      $transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const outbox = new OutboxService();
    const addSpy = jest.spyOn(outbox, 'add').mockResolvedValue({
      eventId: entry.eventId,
      occurredOn: entry.occurredOn,
    });
    const recorder = new OutboxAuditRecorder(prisma as never, outbox, 'ms-personal');

    await recorder.record(entry);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith(
      tx,
      'AUDITORIA_REGISTRADA',
      expect.objectContaining({
        usuarioId: entry.usuarioId,
        modulo: 'personal',
        accion: 'AREA_ACTUALIZAR',
        resultado: 'EXITO',
        producer: 'ms-personal',
        datos: {
          antes: { nombre: 'Antes', ci: '***5678' },
          despues: { nombre: 'Después', remuneracion: '***' },
        },
      }),
    );
  });
});
