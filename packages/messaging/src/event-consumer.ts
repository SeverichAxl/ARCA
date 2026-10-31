import { Logger } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConsumeMessage } from 'amqplib';
import {
  DEFAULT_MAX_ATTEMPTS,
  getRetryCount,
  retryDestination,
} from './constants';
import { MessagingConnection } from './messaging.connection';
import type {
  ConsumerRegistration,
  DeliveryChannel,
  EventEnvelope,
  EventHandler,
  MessageMetadata,
  MessagingOptions,
  PrismaMessagingClient,
} from './types';

export class DuplicateEventError extends Error {
  constructor(message = 'El evento ya fue procesado.') {
    super(message);
    this.name = 'DuplicateEventError';
  }
}

function parseEnvelope(message: ConsumeMessage): EventEnvelope {
  const value: unknown = JSON.parse(message.content.toString('utf8'));
  if (
    typeof value !== 'object' ||
    value === null ||
    !('eventId' in value) ||
    typeof value.eventId !== 'string' ||
    !('eventName' in value) ||
    typeof value.eventName !== 'string' ||
    !('occurredOn' in value) ||
    typeof value.occurredOn !== 'string' ||
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !('producer' in value) ||
    typeof value.producer !== 'string' ||
    !('payload' in value)
  ) {
    throw new Error('El sobre recibido no cumple el contrato de eventos.');
  }
  return {
    eventId: value.eventId,
    eventName: value.eventName,
    version: value.version,
    occurredOn: value.occurredOn,
    producer: value.producer,
    payload: value.payload as EventEnvelope['payload'],
  };
}

export function createQueueMetadata(queue: string, maxAttempts: number): MessageMetadata {
  return {
    queue,
    retryQueue: `${queue}.retry`,
    deadLetterQueue: `${queue}.dlq`,
    maxAttempts,
  };
}

export class EventConsumer {
  private readonly logger = new Logger(EventConsumer.name);
  private readonly channels: ChannelWrapper[] = [];

  constructor(
    private readonly prisma: PrismaMessagingClient,
    private readonly connection: MessagingConnection,
    private readonly options: MessagingOptions,
  ) {}

  async subscribe(
    queue: string,
    bindings: string[],
    handler: EventHandler,
  ): Promise<void> {
    const registration: ConsumerRegistration = { queue, bindings, handler };
    const metadata = createQueueMetadata(
      queue,
      this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    );
    const channel = await this.connection.createConsumerChannel(
      registration,
      async (rawChannel) => {
        await rawChannel.consume(queue, (message) => {
          if (message) {
            void this.processMessage(metadata, handler, message, rawChannel).catch(
              (error: unknown) => {
                this.logger.error(`Falló el procesamiento de ${queue}.`, error);
              },
            );
          }
        });
      },
    );
    this.channels.push(channel);
    await channel.waitForConnect();
  }

  async close(): Promise<void> {
    await Promise.all(this.channels.map((channel) => channel.close()));
    this.channels.length = 0;
  }

  async processMessage(
    metadata: MessageMetadata,
    handler: EventHandler,
    message: ConsumeMessage,
    channel: DeliveryChannel,
  ): Promise<void> {
    let envelope: EventEnvelope;
    try {
      envelope = parseEnvelope(message);
    } catch (error) {
      await this.routeFailure(metadata, message, channel, error);
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (tx.eventoProcesado) {
          try {
            await tx.eventoProcesado.create({
              data: { eventId: envelope.eventId, eventName: envelope.eventName },
            });
          } catch (error) {
            if (this.isDuplicateEventId(error)) {
              throw new DuplicateEventError();
            }
            throw error;
          }
        }
        await handler(tx, envelope);
      });
      channel.ack(message);
    } catch (error) {
      if (error instanceof DuplicateEventError) {
        channel.ack(message);
        return;
      }
      await this.routeFailure(metadata, message, channel, error);
    }
  }

  private async routeFailure(
    metadata: MessageMetadata,
    message: ConsumeMessage,
    channel: DeliveryChannel,
    error: unknown,
  ): Promise<void> {
    const retryCount = getRetryCount(message.properties.headers?.['x-retry-count']);
    const { destination, nextRetryCount } = retryDestination(
      retryCount,
      metadata.maxAttempts,
      metadata.retryQueue,
      metadata.deadLetterQueue,
    );
    try {
      channel.sendToQueue(destination, message.content, {
        persistent: true,
        messageId: message.properties.messageId,
        contentType: message.properties.contentType,
        headers: {
          ...message.properties.headers,
          'x-retry-count': nextRetryCount,
        },
      });
      await channel.waitForConfirms();
      channel.ack(message);
      this.logger.warn(
        `Evento ${message.properties.messageId ?? '<sin id>'} enviado a ${destination} tras error: ${this.errorMessage(error)}`,
      );
    } catch (publishError) {
      this.logger.error(
        `No se pudo enviar el mensaje a ${destination}; se conserva la entrega original.`,
        publishError,
      );
    }
  }

  private isDuplicateEventId(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002') {
      return false;
    }
    const meta = 'meta' in error && typeof error.meta === 'object' && error.meta !== null
      ? error.meta
      : undefined;
    const target = meta && 'target' in meta ? meta.target : undefined;
    const fields = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : [];
    return fields.some((field) =>
      [
        'eventId',
        'event_id',
        'EventoProcesado_eventId_key',
        'evento_procesado_event_id_key',
      ].includes(field),
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
