import { Module } from '@nestjs/common';
import { VacationBalanceController } from './vacation-balance.controller';
import { VacationBalanceService } from './vacation-balance.service';
import { VacationRequestController } from './vacation-request.controller';
import { VacationRequestService } from './vacation-request.service';

@Module({
  controllers: [VacationBalanceController, VacationRequestController],
  providers: [VacationBalanceService, VacationRequestService],
})
export class VacationsModule {}
