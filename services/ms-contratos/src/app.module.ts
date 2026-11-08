import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '@arca/audit';
import { ContractsModule } from './application/contracts/contracts.module';
import { HealthModule } from './application/health/health.module';
import { TemplatesModule } from './application/templates/templates.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { PrismaService } from './infrastructure/prisma/prisma.service';

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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
