import { Module } from '@nestjs/common';
import { VacationBalanceController } from './vacation-balance.controller';
import { VacationBalanceService } from './vacation-balance.service';
import { VacationRequestController } from './vacation-request.controller';
import { VacationRequestService } from './vacation-request.service';
import { VacationApprovalController } from './vacation-approval.controller';
import { VacationApprovalService } from './vacation-approval.service';

@Module({
  controllers: [VacationBalanceController, VacationRequestController, VacationApprovalController],
  providers: [VacationBalanceService, VacationRequestService, VacationApprovalService],
})
export class VacationsModule {}
