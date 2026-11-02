import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AUDIT_SINK, LoggerAuditSink } from '../../rbac/audit-sink';
import { AuthModule } from '../auth/auth.module';
import { GatewayAuthorizationMiddleware } from './gateway-authorization.middleware';
import { ProxyService } from './proxy.service';

@Module({
  imports: [AuthModule],
  providers: [
    ProxyService,
    {
      provide: AUDIT_SINK,
      useClass: LoggerAuditSink,
    },
  ],
})
export class ProxyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Único middleware de entrada. No existe otro camino hacia ProxyService.
    consumer.apply(GatewayAuthorizationMiddleware).forRoutes('*');
  }
}
