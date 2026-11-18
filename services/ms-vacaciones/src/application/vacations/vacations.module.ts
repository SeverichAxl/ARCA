import { Module } from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import { VacationBalanceController } from './vacation-balance.controller';
import { VacationBalanceService } from './vacation-balance.service';
import { VacationRequestController } from './vacation-request.controller';
import { VacationRequestService } from './vacation-request.service';
import {
  VacationExceptionController,
  VacationTransitionController,
} from './vacation-transition.controller';
import { VacationApprovalService } from './vacation-approval.service';
import { LicenseController } from './license.controller';
import { VacationLicenseService } from './license.service';

@Module({
  controllers: [
    VacationBalanceController,
    VacationRequestController,
    VacationTransitionController,
    VacationExceptionController,
    LicenseController,
  ],
  providers: [
    VacationBalanceService,
    VacationRequestService,
    VacationApprovalService,
    VacationLicenseService,
    OutboxService,
  ],
})
export class VacationsModule {}
