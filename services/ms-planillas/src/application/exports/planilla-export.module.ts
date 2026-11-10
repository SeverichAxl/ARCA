import { Module } from '@nestjs/common';
import { PlanillaExportController } from './planilla-export.controller';
import { PlanillaExportService } from './planilla-export.service';

@Module({ controllers: [PlanillaExportController], providers: [PlanillaExportService] })
export class PlanillaExportModule {}
