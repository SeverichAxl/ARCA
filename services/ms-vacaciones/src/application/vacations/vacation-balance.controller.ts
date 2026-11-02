import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from 'common-dtos';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { VacationBalanceService } from './vacation-balance.service';

@Controller('vacaciones/saldo')
export class VacationBalanceController {
  constructor(private readonly balanceService: VacationBalanceService) {}

  @Get()
  @RequirePermission('vacaciones:read_own')
  getOwnBalance(@Req() request: Request & { user?: JwtPayload }) {
    const empleadoId = request.user?.empleadoId;
    if (!empleadoId) {
      throw new UnauthorizedException('El token no contiene empleadoId.');
    }

    return this.balanceService.getForEmployee(empleadoId);
  }
}
