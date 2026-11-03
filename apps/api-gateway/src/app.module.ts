import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ProxyModule } from './modules/proxy/proxy.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    RateLimitModule,
    ProxyModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
