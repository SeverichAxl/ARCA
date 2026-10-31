import { randomUUID } from 'node:crypto';
import { connect, type ConfirmChannel, type ConsumeMessage } from 'amqplib';

const configuredHostname = process.env.RABBITMQ_HOST ?? '127.0.0.1';
const hostname = configuredHostname === 'rabbitmq' ? '127.0.0.1' : configuredHostname;
const port = Number(process.env.RABBITMQ_PORT ?? 5672);
const username = process.env.RABBITMQ_DEFAULT_USER;
const password = process.env.RABBITMQ_DEFAULT_PASS;
const vhost = process.env.RABBITMQ_VHOST ?? 'arca';

if (!username || !password) {
  throw new Error('Configura RABBITMQ_DEFAULT_USER y RABBITMQ_DEFAULT_PASS.');
}

const queue = `integration.${randomUUID()}`;
const retryQueue = `${queue}.retry`;
const deadLetterQueue = `${queue}.dlq`;
const exchange = 'arca.events';
const routingKey = 'personal.integration';
const envelope = {
  eventId: randomUUID(),
  eventName: 'EMPLEADO_CREADO',
  version: 1,
  occurredOn: new Date().toISOString(),
  producer: 'messaging-integration-test',
  payload: { empleadoId: randomUUID() },
};

function publishConfirmed(
  channel: ConfirmChannel,
  targetQueue: string,
  content: Buffer,
  headers: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.sendToQueue(
      targetQueue,
      content,
      { persistent: true, messageId: envelope.eventId, headers },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

function waitFor<T>(promise: Promise<T>, timeoutMs = 10_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout esperando el evento de integración.')), timeoutMs);
      timer.unref();
    }),
  ]);
}

async function main(): Promise<void> {
  const connection = await connect({
    protocol: 'amqp',
    hostname,
    port,
    username,
    password,
    vhost,
  });
  const channel = await connection.createConfirmChannel();

  try {
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.assertQueue(retryQueue, {
      durable: true,
      messageTtl: 250,
      deadLetterExchange: '',
      deadLetterRoutingKey: queue,
    });
    await channel.assertQueue(deadLetterQueue, { durable: true });
    await channel.bindQueue(queue, exchange, routingKey);

    channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(envelope)),
      { persistent: true, messageId: envelope.eventId, contentType: 'application/json' },
    );
    await channel.waitForConfirms();

    let firstDelivery: (value: void) => void = () => undefined;
    let firstFailure: (error: Error) => void = () => undefined;
    const consumed = new Promise<void>((resolve, reject) => {
      firstDelivery = resolve;
      firstFailure = reject;
    });
    const firstConsumer = await channel.consume(
      queue,
      (message) => {
        if (!message) {
          firstFailure(new Error('RabbitMQ canceló el consumidor de integración.'));
          return;
        }
        channel.ack(message);
        firstDelivery();
      },
      { noAck: false },
    );
    await waitFor(consumed);
    await channel.cancel(firstConsumer.consumerTag);
    console.log('OK: evento persistido sin consumidor y recibido al suscribirse.');

    let failedAttempts = 0;
    const dlqReceived = new Promise<ConsumeMessage>((resolve, reject) => {
      void channel.consume(
        deadLetterQueue,
        (message) => {
          if (message) {
            channel.ack(message);
            resolve(message);
          } else {
            reject(new Error('RabbitMQ canceló el consumidor DLQ.'));
          }
        },
        { noAck: false },
      );
    });

    await channel.consume(
      queue,
      (message) => {
        if (!message) {
          return;
        }
        failedAttempts += 1;
        const retryCount = Number(message.properties.headers?.['x-retry-count'] ?? 0);
        const destination = retryCount + 1 >= 3 ? deadLetterQueue : retryQueue;
        void publishConfirmed(channel, destination, message.content, {
          ...message.properties.headers,
          'x-retry-count': retryCount + 1,
        })
          .then(() => channel.ack(message))
          .catch((error: unknown) => {
            console.error('Falló la publicación de retry de integración:', error);
            channel.nack(message, false, true);
          });
      },
      { noAck: false },
    );

    const failingEventId = randomUUID();
    channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify({ ...envelope, eventId: failingEventId })),
      { persistent: true, messageId: failingEventId, contentType: 'application/json' },
    );
    await channel.waitForConfirms();
    const deadLetter = await waitFor(dlqReceived, 10_000);
    if (failedAttempts !== 3 || Number(deadLetter.properties.headers?.['x-retry-count']) !== 3) {
      throw new Error(`Esperaba 3 intentos y DLQ; intentos observados: ${failedAttempts}.`);
    }
    console.log('OK: mensaje fallido se reintentó y terminó en la DLQ tras 3 intentos.');
  } finally {
    await channel.deleteQueue(queue).catch(() => undefined);
    await channel.deleteQueue(retryQueue).catch(() => undefined);
    await channel.deleteQueue(deadLetterQueue).catch(() => undefined);
    await channel.close();
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  console.error('Falló la integración RabbitMQ:', error);
  process.exitCode = 1;
});
