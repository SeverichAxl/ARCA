import { Module } from '@nestjs/common';
import { VacationBalanceController } from './vacation-balance.controller';
import { VacationBalanceService } from './vacation-balance.service';

@Module({
  controllers: [VacationBalanceController],
  providers: [VacationBalanceService],
})
export class VacationsModule {}
