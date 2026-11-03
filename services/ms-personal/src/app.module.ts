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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    HealthModule,
    PrismaModule,
    PersonalMessagingModule,
    EmployeesModule,
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
