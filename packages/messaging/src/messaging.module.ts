import { DynamicModule, Inject, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DEFAULT_RETRY_TTL_MS } from './constants';
import { OutboxPublisher } from './outbox.publisher';
import { EventConsumer } from './event-consumer';
import { MessagingConnection, createAmqpUrl } from './messaging.connection';
import { OutboxService } from './outbox.service';
import type { MessagingOptions, PrismaMessagingClient } from './types';

const MESSAGING_OPTIONS = Symbol('MESSAGING_OPTIONS');
const PRISMA_MESSAGING_CLIENT = Symbol('PRISMA_MESSAGING_CLIENT');

@Injectable()
class MessagingConsumers implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly consumer: EventConsumer,
    @Inject(MESSAGING_OPTIONS) private readonly options: MessagingOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const registration of this.options.consumers ?? []) {
      await this.consumer.subscribe(
        registration.queue,
        registration.bindings,
        registration.handler,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.close();
  }
}

@Module({})
export class MessagingModule {
  static register(options: MessagingOptions): DynamicModule {
    return {
      module: MessagingModule,
      providers: [
        { provide: MESSAGING_OPTIONS, useValue: options },
        { provide: PRISMA_MESSAGING_CLIENT, useExisting: options.prismaToken },
        {
          provide: MessagingConnection,
          useFactory: () => {
            const connection =
              typeof options.connection === 'function'
                ? options.connection()
                : options.connection;
            return new MessagingConnection(
              createAmqpUrl(connection),
              options.retryTtlMs ?? DEFAULT_RETRY_TTL_MS,
            );
          },
        },
        OutboxService,
        {
          provide: OutboxPublisher,
          useFactory: (
            prisma: PrismaMessagingClient,
            connection: MessagingConnection,
          ) => new OutboxPublisher(prisma, connection, options),
          inject: [PRISMA_MESSAGING_CLIENT, MessagingConnection],
        },
        {
          provide: EventConsumer,
          useFactory: (
            prisma: PrismaMessagingClient,
            connection: MessagingConnection,
          ) => new EventConsumer(prisma, connection, options),
          inject: [PRISMA_MESSAGING_CLIENT, MessagingConnection],
        },
        MessagingConsumers,
      ],
      exports: [OutboxService, OutboxPublisher, EventConsumer, MessagingConnection],
    };
  }
}
