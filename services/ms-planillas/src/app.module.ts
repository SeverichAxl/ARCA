import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './application/health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { LegalParameterModule } from './application/legal-parameters/legal-parameter.module';
import { MessagingModule } from '@arca/messaging';
import { PrismaService } from './infrastructure/prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    HealthModule,
    PrismaModule,
    LegalParameterModule,
    MessagingModule.register({
      connection: () => ({
        hostname: process.env.RABBITMQ_HOST ?? 'rabbitmq',
        port: Number(process.env.RABBITMQ_PORT ?? 5672),
        username: process.env.RABBITMQ_USER ?? '',
        password: process.env.RABBITMQ_PASSWORD ?? '',
        vhost: process.env.RABBITMQ_VHOST ?? 'arca',
      }),
      prismaToken: PrismaService,
      producer: 'ms-planillas',
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
