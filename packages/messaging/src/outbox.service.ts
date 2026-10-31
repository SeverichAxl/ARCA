import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { JsonValue, PrismaTransactionLike } from './types';

@Injectable()
export class OutboxService {
  async add(
    tx: PrismaTransactionLike,
    eventName: string,
    payload: Exclude<JsonValue, null>,
  ): Promise<{ eventId: string; occurredOn: Date }> {
    if (!tx.outboxEvento) {
      throw new Error('El cliente Prisma no expone el modelo OutboxEvento.');
    }
    const eventId = randomUUID();
    const occurredOn = new Date();
    await tx.outboxEvento.create({
      data: { id: eventId, eventName, payload, occurredOn },
    });
    return { eventId, occurredOn };
  }
}
