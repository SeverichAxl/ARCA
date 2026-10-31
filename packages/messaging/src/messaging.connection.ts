import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { connect, type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel, Options } from 'amqplib';
import { DEFAULT_RETRY_TTL_MS, EVENTS_EXCHANGE } from './constants';
import type { ConsumerRegistration, MessagingConnectionOptions } from './types';

function encodeCredential(value: string): string {
  return encodeURIComponent(value);
}

export function createAmqpUrl(options: MessagingConnectionOptions): string {
  return `amqp://${encodeCredential(options.username)}:${encodeCredential(options.password)}@${options.hostname}:${options.port}/${encodeURIComponent(options.vhost)}`;
}

@Injectable()
export class MessagingConnection implements OnModuleDestroy {
  private readonly logger = new Logger(MessagingConnection.name);
  private readonly manager: AmqpConnectionManager;
  private readonly channels = new Set<ChannelWrapper>();
  private readonly setupPromises = new WeakMap<ChannelWrapper, Promise<void>>();

  constructor(
    url: string,
    private readonly retryTtlMs = DEFAULT_RETRY_TTL_MS,
  ) {
    this.manager = connect([url], { heartbeatIntervalInSeconds: 10 });
    this.manager.on('connect', () => this.logger.log('Conexión RabbitMQ establecida.'));
    this.manager.on('error', (error) => {
      this.logger.error('Error en la conexión RabbitMQ.', error instanceof Error ? error.stack : String(error));
    });
    this.manager.on('disconnect', ({ err }) => {
      this.logger.error(`Conexión RabbitMQ interrumpida: ${err.message}`);
    });
  }

  createPublisherChannel(): ChannelWrapper {
    const channel = this.trackChannel(this.manager.createChannel({ json: false }));
    const setup = channel.addSetup(async (rawChannel: ConfirmChannel) => {
      await rawChannel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    });
    this.setupPromises.set(channel, setup);
    void setup.catch((error: unknown) => {
      this.logger.error(
        'No se pudo declarar el exchange de eventos.',
        error instanceof Error ? error.stack : String(error),
      );
    });
    channel.on('error', (error) => {
      this.logger.error('Error en el canal publisher de RabbitMQ.', error instanceof Error ? error.stack : String(error));
    });
    return channel;
  }

  async createConsumerChannel(
    registration: ConsumerRegistration,
    setupConsumer: (channel: ConfirmChannel) => Promise<void>,
  ): Promise<ChannelWrapper> {
    const channel = this.trackChannel(this.manager.createChannel({ json: false }));
    try {
      await channel.addSetup(async (rawChannel: ConfirmChannel) => {
        await rawChannel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
        await rawChannel.assertQueue(registration.queue, { durable: true });
        await rawChannel.assertQueue(`${registration.queue}.retry`, {
          durable: true,
          messageTtl: this.retryTtlMs,
          deadLetterExchange: '',
          deadLetterRoutingKey: registration.queue,
        });
        await rawChannel.assertQueue(`${registration.queue}.dlq`, { durable: true });
        for (const binding of registration.bindings) {
          await rawChannel.bindQueue(registration.queue, EVENTS_EXCHANGE, binding);
        }
        await setupConsumer(rawChannel);
      });
    } catch (error) {
      await channel.close();
      throw error;
    }
    channel.on('error', (error) => {
      this.logger.error(
        `Error en el canal consumidor ${registration.queue}.`,
        error instanceof Error ? error.stack : String(error),
      );
    });
    return channel;
  }

  async publish(
    channel: ChannelWrapper,
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: Options.Publish,
  ): Promise<void> {
    await this.setupPromises.get(channel);
    await channel.publish(exchange, routingKey, content, options);
  }

  async close(): Promise<void> {
    await Promise.all([...this.channels].map((channel) => channel.close()));
    await this.manager.close();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private trackChannel(channel: ChannelWrapper): ChannelWrapper {
    this.channels.add(channel);
    channel.once('close', () => this.channels.delete(channel));
    return channel;
  }
}
