import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { VacationConfigurationController } from './vacation-configuration.controller';
import { VacationConfigurationService } from './vacation-configuration.service';
@Module({
  imports: [PrismaModule],
  controllers: [VacationConfigurationController],
  providers: [VacationConfigurationService],
  exports: [VacationConfigurationService],
})
export class VacationConfigurationModule {}
