import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '@arca/audit';
import { MessagingModule } from '@arca/messaging';
import { ContractsModule } from './application/contracts/contracts.module';
import { HealthModule } from './application/health/health.module';
import { TemplatesModule } from './application/templates/templates.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { PrismaService } from './infrastructure/prisma/prisma.service';

const rabbitMqConnection = () => ({
  hostname: process.env.RABBITMQ_HOST ?? 'rabbitmq',
  port: Number(process.env.RABBITMQ_PORT ?? 5672),
  username: process.env.RABBITMQ_USER ?? '',
  password: process.env.RABBITMQ_PASSWORD ?? '',
  vhost: process.env.RABBITMQ_VHOST ?? 'arca',
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    HealthModule,
    TemplatesModule,
    ContractsModule,
    PrismaModule,
    AuditModule.register({
      recorder: 'outbox',
      prismaToken: PrismaService,
      producer: 'ms-contratos',
    }),
    MessagingModule.register({
      connection: rabbitMqConnection,
      prismaToken: PrismaService,
      producer: 'ms-contratos',
      publishEnabled: true,
      retryTtlMs: Number(process.env.RABBITMQ_RETRY_TTL_MS ?? 10_000),
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
