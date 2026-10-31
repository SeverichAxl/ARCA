import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './application/auth/auth.module';
import { HealthModule } from './application/health/health.module';
import { consumeAuditEvent } from './application/messaging/audit-event.handler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { MessagingModule } from '@arca/messaging';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    HealthModule,
    PrismaModule,
    MessagingModule.register({
      connection: () => ({
        hostname: process.env.RABBITMQ_HOST ?? 'rabbitmq',
        port: Number(process.env.RABBITMQ_PORT ?? 5672),
        username: process.env.RABBITMQ_USER ?? '',
        password: process.env.RABBITMQ_PASSWORD ?? '',
        vhost: process.env.RABBITMQ_VHOST ?? 'arca',
      }),
      prismaToken: PrismaService,
      producer: 'ms-auth',
      publishEnabled: false,
      retryTtlMs: Number(process.env.RABBITMQ_RETRY_TTL_MS ?? 10_000),
      consumers: [
        {
          queue: 'auth.auditoria',
          bindings: ['auditoria.#'],
          handler: consumeAuditEvent,
        },
      ],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
