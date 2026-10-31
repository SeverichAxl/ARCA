import type { ConsumeMessage } from 'amqplib';
import {
  DuplicateEventError,
  EventConsumer,
  OutboxService,
  getRetryCount,
  retryDestination,
  routingKeyFor,
} from '../src';
import type {
  DeliveryChannel,
  EventEnvelope,
  MessagingOptions,
  PrismaMessagingClient,
  PrismaTransactionLike,
} from '../src/types';

const options: MessagingOptions = {
  connection: {
    hostname: 'localhost',
    port: 5672,
    username: 'test',
    password: 'test',
    vhost: 'arca',
  },
  prismaToken: 'prisma',
  producer: 'test',
};

function message(headers: Record<string, unknown> = {}): ConsumeMessage {
  return {
    content: Buffer.from(
      JSON.stringify({
        eventId: '4a07885a-9916-4dc9-a6b8-39cba72a2132',
        eventName: 'EMPLEADO_CREADO',
        version: 1,
        occurredOn: '2026-10-30T14:30:00.000Z',
        producer: 'ms-personal',
        payload: { empleadoId: 'sample' },
      } satisfies EventEnvelope),
    ),
    fields: {
      consumerTag: 'consumer',
      deliveryTag: 1,
      redelivered: false,
      exchange: 'arca.events',
      routingKey: 'personal.empleado.creado',
    },
    properties: {
      contentType: 'application/json',
      contentEncoding: undefined,
      headers,
      deliveryMode: 2,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: '4a07885a-9916-4dc9-a6b8-39cba72a2132',
      timestamp: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  };
}

function deliveryChannel(): DeliveryChannel & { acked: number; sent: string[] } {
  return {
    acked: 0,
    sent: [],
    ack() {
      this.acked += 1;
    },
    sendToQueue(queue) {
      this.sent.push(queue);
      return true;
    },
    async waitForConfirms() {},
  };
}

describe('routing and retry policy', () => {
  it('resolves event names to the documented routing keys', () => {
    expect(routingKeyFor('EMPLEADO_CREADO')).toBe('personal.empleado.creado');
    expect(routingKeyFor('AUDITORIA_REGISTRADA')).toBe('auditoria.registrada');
  });

  it('retries twice and sends the third failed attempt to the DLQ', () => {
    expect(retryDestination(0, 3, 'q.retry', 'q.dlq')).toEqual({
      destination: 'q.retry',
      nextRetryCount: 1,
    });
    expect(retryDestination(1, 3, 'q.retry', 'q.dlq')).toEqual({
      destination: 'q.retry',
      nextRetryCount: 2,
    });
    expect(retryDestination(2, 3, 'q.retry', 'q.dlq')).toEqual({
      destination: 'q.dlq',
      nextRetryCount: 3,
    });
    expect(getRetryCount('2')).toBe(2);
    expect(getRetryCount('invalid')).toBe(0);
  });
});

describe('OutboxService', () => {
  it('writes the event through the transaction client', async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = {
      outboxEvento: { create, update: jest.fn() },
    } as unknown as PrismaTransactionLike;
    const result = await new OutboxService().add(tx, 'EMPLEADO_CREADO', {
      empleadoId: 'sample',
    });

    expect(result.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(create).toHaveBeenCalledWith({
      data: {
        id: result.eventId,
        eventName: 'EMPLEADO_CREADO',
        payload: { empleadoId: 'sample' },
        occurredOn: result.occurredOn,
      },
    });
  });
});

describe('EventConsumer', () => {
  it('records idempotency and invokes the handler in one transaction', async () => {
    const order: string[] = [];
    const tx = {
      eventoProcesado: {
        create: jest.fn(async () => {
          order.push('processed');
        }),
      },
    } as unknown as PrismaTransactionLike;
    const prisma: PrismaMessagingClient = {
      $transaction: async (handler) => handler(tx),
    };
    const consumer = new EventConsumer(prisma, {} as never, options);
    const handler = jest.fn(async () => {
      order.push('handler');
    });
    const channel = deliveryChannel();

    await consumer.processMessage(
      {
        queue: 'vacaciones.personal-events',
        retryQueue: 'vacaciones.personal-events.retry',
        deadLetterQueue: 'vacaciones.personal-events.dlq',
        maxAttempts: 3,
      },
      handler,
      message(),
      channel,
    );

    expect(order).toEqual(['processed', 'handler']);
    expect(channel.acked).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('acks duplicate event ids without running the handler', async () => {
    const tx = {
      eventoProcesado: {
        create: jest.fn(async () => {
          const error = new Error('duplicate');
          Object.assign(error, { code: 'P2002', meta: { target: ['event_id'] } });
          throw error;
        }),
      },
    } as unknown as PrismaTransactionLike;
    const consumer = new EventConsumer(
      { $transaction: async (handler) => handler(tx) },
      {} as never,
      options,
    );
    const handler = jest.fn();
    const channel = deliveryChannel();

    await consumer.processMessage(
      { queue: 'q', retryQueue: 'q.retry', deadLetterQueue: 'q.dlq', maxAttempts: 3 },
      handler,
      message(),
      channel,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(channel.acked).toBe(1);
  });

  it('does not swallow unrelated unique constraint violations', async () => {
    const tx = {
      eventoProcesado: {
        create: jest.fn(async () => {
          const error = new Error('duplicate');
          Object.assign(error, { code: 'P2002', meta: { target: ['another_unique_field'] } });
          throw error;
        }),
      },
    } as unknown as PrismaTransactionLike;
    const consumer = new EventConsumer(
      { $transaction: async (handler) => handler(tx) },
      {} as never,
      options,
    );
    const channel = deliveryChannel();

    await consumer.processMessage(
      { queue: 'q', retryQueue: 'q.retry', deadLetterQueue: 'q.dlq', maxAttempts: 3 },
      jest.fn(),
      message(),
      channel,
    );

    expect(channel.sent).toEqual(['q.retry']);
    expect(channel.acked).toBe(1);
  });

  it('sends failures to the retry queue and then to the DLQ', async () => {
    const prisma: PrismaMessagingClient = {
      $transaction: async () => {
        throw new Error('transient failure');
      },
    };
    const consumer = new EventConsumer(prisma, {} as never, options);
    const handler = jest.fn();
    const first = deliveryChannel();
    const second = deliveryChannel();

    await consumer.processMessage(
      { queue: 'q', retryQueue: 'q.retry', deadLetterQueue: 'q.dlq', maxAttempts: 3 },
      handler,
      message(),
      first,
    );
    await consumer.processMessage(
      { queue: 'q', retryQueue: 'q.retry', deadLetterQueue: 'q.dlq', maxAttempts: 3 },
      handler,
      message({ 'x-retry-count': 2 }),
      second,
    );

    expect(first.sent).toEqual(['q.retry']);
    expect(second.sent).toEqual(['q.dlq']);
    expect(first.acked).toBe(1);
    expect(second.acked).toBe(1);
  });

  it('treats a duplicate-event error from the handler as success', async () => {
    const prisma: PrismaMessagingClient = {
      $transaction: async (handler) =>
        handler({ outboxEvento: { create: jest.fn(), update: jest.fn() } } as never),
    };
    const consumer = new EventConsumer(prisma, {} as never, options);
    const channel = deliveryChannel();

    await consumer.processMessage(
      { queue: 'q', retryQueue: 'q.retry', deadLetterQueue: 'q.dlq', maxAttempts: 3 },
      async () => {
        throw new DuplicateEventError();
      },
      message(),
      channel,
    );

    expect(channel.acked).toBe(1);
    expect(channel.sent).toHaveLength(0);
  });
});
