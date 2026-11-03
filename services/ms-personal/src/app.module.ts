import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HealthModule } from './application/health/health.module';
import { EmployeesModule } from './application/employees/employees.module';
import { MessagingTestController } from './application/messaging/messaging-test.controller';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { PersonalMessagingModule } from './infrastructure/messaging/messaging.config';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { MessagingModule } from '@arca/messaging';
import { AuditModule } from '@arca/audit';
import { CatalogsModule } from './application/catalogs/catalogs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    HealthModule,
    CatalogsModule,
    PrismaModule,
    PersonalMessagingModule,
    EmployeesModule,
    AuditModule.register({ recorder: 'outbox', prismaToken: PrismaService, producer: 'ms-personal' }),
    MessagingModule.register({
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
    }),
  ],
  controllers: process.env.NODE_ENV === 'production' ? [] : [MessagingTestController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
