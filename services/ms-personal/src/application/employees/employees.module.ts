import { Module } from '@nestjs/common';
import { CLOCK } from '../../domain/common/clock';
import { EMPLOYEE_REPOSITORY } from '../../domain/employees/employee.repository';
import { ORG_CATALOG_PORT } from '../../domain/employees/org-catalog.port';
import { PersonalCryptoService } from '../../infrastructure/crypto/personal-crypto.service';
import { SystemClock } from '../../infrastructure/clock/system-clock';
import { PrismaEmployeeRepository } from '../../infrastructure/prisma/repositories/prisma-employee.repository';
import { PrismaOrgCatalogAdapter } from '../../infrastructure/prisma/repositories/prisma-org-catalog.adapter';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { OutboxService } from '@arca/messaging';
import { EmployeesController } from './employees.controller';
import { EmployeeService } from './employee.service';

@Module({
  imports: [StorageModule],
  controllers: [EmployeesController],
  providers: [
    EmployeeService,
    PersonalCryptoService,
    OutboxService,
    PrismaEmployeeRepository,
    PrismaOrgCatalogAdapter,
    { provide: EMPLOYEE_REPOSITORY, useExisting: PrismaEmployeeRepository },
    { provide: ORG_CATALOG_PORT, useExisting: PrismaOrgCatalogAdapter },
    { provide: CLOCK, useFactory: () => new SystemClock() },
  ],
})
export class EmployeesModule {}
