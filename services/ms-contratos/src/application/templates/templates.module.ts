import { Module } from '@nestjs/common';
import { PLANTILLA_REPOSITORY } from '../../domain/templates/template.repository';
import { PrismaPlantillaRepository } from '../../infrastructure/prisma/repositories/prisma-plantilla.repository';
import { PlantillaService } from './template.service';
import { PlantillasController } from './templates.controller';

@Module({
  controllers: [PlantillasController],
  providers: [
    PlantillaService,
    PrismaPlantillaRepository,
    { provide: PLANTILLA_REPOSITORY, useExisting: PrismaPlantillaRepository },
  ],
  exports: [PLANTILLA_REPOSITORY],
})
export class TemplatesModule {}
