import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CLOCK,
  EMPLEADOS_NOMINA_PORT,
  PLANILLA_REPOSITORY,
} from '../../domain/planillas/planilla.models';
import { SystemClock } from '../../infrastructure/clock/system-clock';
import { HttpEmpleadosNominaAdapter } from '../../infrastructure/personal/http-empleados-nomina.adapter';
import { PrismaPlanillaRepository } from '../../infrastructure/prisma/repositories/prisma-planilla.repository';
import { PlanillasController } from './planillas.controller';
import { PlanillasService } from './planillas.service';

@Module({
  controllers: [PlanillasController],
  providers: [
    PlanillasService,
    { provide: PLANILLA_REPOSITORY, useClass: PrismaPlanillaRepository },
    {
      provide: EMPLEADOS_NOMINA_PORT,
      useFactory: (config: ConfigService) => new HttpEmpleadosNominaAdapter(config),
      inject: [ConfigService],
    },
    { provide: CLOCK, useClass: SystemClock },
  ],
})
export class PlanillasModule {}
