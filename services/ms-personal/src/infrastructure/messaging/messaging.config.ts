import { MessagingModule } from '@arca/messaging';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Única instancia del módulo de mensajería para el servicio personal.
 * La misma referencia puede importarse desde AppModule y EmployeesModule.
 */
export const PersonalMessagingModule = MessagingModule.register({
  connection: () => ({
    hostname: process.env.RABBITMQ_HOST ?? 'rabbitmq',
    port: Number(process.env.RABBITMQ_PORT ?? 5672),
    username: process.env.RABBITMQ_USER ?? '',
    password: process.env.RABBITMQ_PASSWORD ?? '',
    vhost: process.env.RABBITMQ_VHOST ?? 'arca',
  }),
  prismaToken: PrismaService,
  producer: 'ms-personal',
  publishEnabled: true,
  retryTtlMs: Number(process.env.RABBITMQ_RETRY_TTL_MS ?? 10_000),
});
