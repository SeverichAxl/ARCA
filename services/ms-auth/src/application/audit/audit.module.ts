import { Module } from '@nestjs/common';
import { AUDIT_REPOSITORY } from '../../domain/audit/audit.repository';
import { PrismaAuditRepository } from '../../infrastructure/prisma/repositories/prisma-audit.repository';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    { provide: AUDIT_REPOSITORY, useClass: PrismaAuditRepository },
  ],
})
export class AuditModule {}
