import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import { DEFAULT_BATCH_SIZE, EVENT_VERSION, EVENTS_EXCHANGE, routingKeyFor } from './constants';
import { MessagingConnection } from './messaging.connection';
import type { EventEnvelope, MessagingOptions, OutboxRow, PrismaMessagingClient } from './types';

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly channel: ChannelWrapper;
  private readonly intervalMs = 1_000;
  private timer?: NodeJS.Timeout;
  private activeBatch?: Promise<void>;
  private running = false;

  constructor(
    private readonly prisma: PrismaMessagingClient,
    private readonly connection: MessagingConnection,
    private readonly options: MessagingOptions,
  ) {
    this.channel = this.connection.createPublisherChannel();
  }

  onModuleInit(): void {
    if (this.options.publishEnabled === false) {
      return;
    }
    this.timer = setInterval(() => {
      if (this.activeBatch) {
        return;
      }
      const batch = this.publishBatch().catch((error: unknown) => {
        this.logger.error('No se pudo procesar el lote Outbox.', error);
      });
      this.activeBatch = batch;
      void batch.finally(() => {
        if (this.activeBatch === batch) {
          this.activeBatch = undefined;
        }
      });
    }, this.intervalMs);
    this.timer.unref();
  }

  async publishBatch(): Promise<void> {
    if (this.running || this.options.publishEnabled === false) {
      return;
    }
    this.running = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (!tx.outboxEvento) {
          throw new Error('El cliente Prisma no expone el modelo OutboxEvento.');
        }
        const batchSize = this.options.batchSize ?? DEFAULT_BATCH_SIZE;
        const rows = await tx.$queryRaw<OutboxRow[]>`
          SELECT id::text AS "eventId", event_name AS "eventName",
                 payload, occurred_on AS "occurredOn"
          FROM outbox_evento
          WHERE publicado_en IS NULL
          ORDER BY occurred_on
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        `;

        for (const row of rows) {
          try {
            const envelope: EventEnvelope = {
              eventId: row.eventId,
              eventName: row.eventName,
              version: EVENT_VERSION,
              occurredOn: row.occurredOn.toISOString(),
              producer: this.options.producer,
              payload: row.payload,
            };
            const routingKey = routingKeyFor(row.eventName);
            await this.connection.publish(
              this.channel,
              EVENTS_EXCHANGE,
              routingKey,
              Buffer.from(JSON.stringify(envelope)),
              {
                persistent: true,
                messageId: row.eventId,
                contentType: 'application/json',
                headers: { eventName: row.eventName, version: EVENT_VERSION },
              },
            );
            await tx.outboxEvento.update({
              where: { id: row.eventId },
              data: { publicadoEn: new Date() },
            });
          } catch (error) {
            await tx.outboxEvento.update({
              where: { id: row.eventId },
              data: { intentos: { increment: 1 } },
            });
            this.logger.error(
              `No se pudo publicar el evento ${row.eventId}; permanecerá en Outbox.`,
              error,
            );
          }
        }
      });
    } finally {
      this.running = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.activeBatch;
  }
}
