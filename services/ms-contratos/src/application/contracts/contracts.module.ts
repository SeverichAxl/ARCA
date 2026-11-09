import { Module } from '@nestjs/common';
import { CONTRATO_STORAGE_PORT } from '../../domain/contracts/contrato-storage.port';
import { PDF_GENERATOR_PORT } from '../../domain/contracts/pdf-generator.port';
import { CONTRATO_REPOSITORY } from '../../domain/contracts/contract.repository';
import { PERSONAL_DATA_PORT } from '../../domain/contracts/personal-data.port';
import { PuppeteerPdfGeneratorService } from '../../infrastructure/pdf/puppeteer-pdf-generator.service';
import { PersonalClientService } from '../../infrastructure/personal/personal-client.service';
import { PrismaContratoRepository } from '../../infrastructure/prisma/repositories/prisma-contrato.repository';
import { CloudinaryContratoStorage } from '../../infrastructure/storage/cloudinary-contrato.storage';
import { TemplatesModule } from '../templates/templates.module';
import { ContractService } from './contract.service';
import { ContractsController } from './contracts.controller';

@Module({
  imports: [TemplatesModule],
  controllers: [ContractsController],
  providers: [
    ContractService,
    PuppeteerPdfGeneratorService,
    { provide: PDF_GENERATOR_PORT, useExisting: PuppeteerPdfGeneratorService },
    CloudinaryContratoStorage,
    { provide: CONTRATO_STORAGE_PORT, useExisting: CloudinaryContratoStorage },
    PersonalClientService,
    { provide: PERSONAL_DATA_PORT, useExisting: PersonalClientService },
    PrismaContratoRepository,
    { provide: CONTRATO_REPOSITORY, useExisting: PrismaContratoRepository },
  ],
})
export class ContractsModule {}
