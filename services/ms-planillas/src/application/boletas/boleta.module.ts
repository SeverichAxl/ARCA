import { Module } from '@nestjs/common';
import { BoletaController } from './boleta.controller';
import { BoletaService } from './boleta.service';

@Module({ controllers: [BoletaController], providers: [BoletaService] })
export class BoletaModule {}
