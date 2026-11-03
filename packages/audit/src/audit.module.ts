import { Global, Module, type DynamicModule, type InjectionToken, type Type } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { OutboxService } from '@arca/messaging';
import { AuditContext } from './audit.context';
import { AuditInterceptor } from './audit.interceptor';
import { AUDIT_RECORDER } from './audit.recorder';
import type { AuditRecorder } from './audit.types';
import {
  PrismaAuditLogRecorder,
  type AuditLogPrismaClient,
} from './adapters/prisma-audit-log.recorder';
import {
  OutboxAuditRecorder,
  type OutboxAuditPrismaClient,
} from './adapters/outbox-audit.recorder';

export type AuditModuleOptions =
  | {
      recorder: 'prisma';
      prismaToken: InjectionToken;
    }
  | {
      recorder: 'outbox';
      prismaToken: InjectionToken;
      producer: string;
    };

export type AuditPrismaToken = InjectionToken;

function recorderFactory(
  options: AuditModuleOptions,
  prisma: unknown,
): AuditRecorder {
  if (options.recorder === 'prisma') {
    return new PrismaAuditLogRecorder(prisma as AuditLogPrismaClient);
  }
  return new OutboxAuditRecorder(
    prisma as OutboxAuditPrismaClient,
    new OutboxService(),
    options.producer,
  );
}

@Global()
@Module({})
export class AuditModule {
  static register(options: AuditModuleOptions): DynamicModule {
    return {
      module: AuditModule,
      global: true,
      providers: [
        AuditContext,
        {
          provide: AUDIT_RECORDER,
          useFactory: (prisma: unknown) => recorderFactory(options, prisma),
          inject: [options.prismaToken as Type<unknown> | InjectionToken],
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: AuditInterceptor,
        },
      ],
      exports: [AuditContext, AUDIT_RECORDER],
    };
  }
}
