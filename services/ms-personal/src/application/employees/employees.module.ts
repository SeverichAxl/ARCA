import { Module } from '@nestjs/common';
import { PersonalCryptoService } from '../../infrastructure/crypto/personal-crypto.service';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { PersonalMessagingModule } from '../../infrastructure/messaging/messaging.config';
import { BajasService } from './bajas.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { InamovilidadesService } from './inamovilidades.service';

@Module({
  imports: [StorageModule, PersonalMessagingModule],
  controllers: [EmployeesController],
  providers: [PersonalCryptoService, EmployeesService, BajasService, InamovilidadesService],
})
export class EmployeesModule {}
