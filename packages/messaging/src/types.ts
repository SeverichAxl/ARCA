import type { Type } from '@nestjs/common';
import type { ConsumeMessage, Options } from 'amqplib';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface EventEnvelope<TPayload = JsonValue> {
  eventId: string;
  eventName: string;
  version: number;
  occurredOn: string;
  producer: string;
  payload: TPayload;
}

export interface OutboxCreateInput {
  id: string;
  eventName: string;
  payload: Exclude<JsonValue, null>;
  occurredOn: Date;
}

export interface OutboxRow {
  eventId: string;
  eventName: string;
  payload: JsonValue;
  occurredOn: Date;
}

export interface PrismaTransactionLike {
  $queryRaw<T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
  outboxEvento?: {
    create(args: { data: OutboxCreateInput }): Promise<unknown>;
    update(args: {
      where: { id: string };
      data: { publicadoEn?: Date; intentos?: { increment: number } };
    }): Promise<unknown>;
  };
  eventoProcesado?: {
    create(args: { data: { eventId: string; eventName: string } }): Promise<unknown>;
  };
}

export interface PrismaMessagingClient {
  $transaction<T>(callback: (tx: PrismaTransactionLike) => Promise<T>): Promise<T>;
}

export interface MessagingConnectionOptions {
  hostname: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
}

export interface MessagingOptions {
  connection: MessagingConnectionOptions | (() => MessagingConnectionOptions);
  prismaToken: string | symbol | Type<object>;
  producer: string;
  publishEnabled?: boolean;
  retryTtlMs?: number;
  maxAttempts?: number;
  batchSize?: number;
  consumers?: ConsumerRegistration[];
}

export interface ConsumerRegistration {
  queue: string;
  bindings: string[];
  handler: EventHandler;
}

export type EventHandler = (
  tx: PrismaTransactionLike,
  envelope: EventEnvelope,
) => Promise<void>;

export interface DeliveryChannel {
  ack(message: ConsumeMessage): void;
  sendToQueue(
    queue: string,
    content: Buffer,
    options: Options.Publish,
  ): boolean;
  waitForConfirms(): Promise<void>;
}

export interface MessageMetadata {
  queue: string;
  retryQueue: string;
  deadLetterQueue: string;
  maxAttempts: number;
}
