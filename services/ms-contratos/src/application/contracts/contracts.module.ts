import { Module } from '@nestjs/common';
import { CONTRATO_REPOSITORY } from '../../domain/contracts/contract.repository';
import { PERSONAL_DATA_PORT } from '../../domain/contracts/personal-data.port';
import { PersonalClientService } from '../../infrastructure/personal/personal-client.service';
import { PrismaContratoRepository } from '../../infrastructure/prisma/repositories/prisma-contrato.repository';
import { TemplatesModule } from '../templates/templates.module';
import { ContractService } from './contract.service';
import { ContractsController } from './contracts.controller';

@Module({
  imports: [TemplatesModule],
  controllers: [ContractsController],
  providers: [
    ContractService,
    PersonalClientService,
    { provide: PERSONAL_DATA_PORT, useExisting: PersonalClientService },
    PrismaContratoRepository,
    { provide: CONTRATO_REPOSITORY, useExisting: PrismaContratoRepository },
  ],
})
export class ContractsModule {}
