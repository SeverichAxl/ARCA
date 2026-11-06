import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermission } from '@arca/internal-auth';
import type { InternalPrincipal } from '@arca/internal-auth';
import { VacationBalanceService } from './vacation-balance.service';

@ApiTags('vacaciones')
@ApiBearerAuth()
@Controller('vacaciones')
export class VacationBalanceController {
  constructor(private readonly balances: VacationBalanceService) {}

  @Get('saldo')
  @RequirePermission('vacaciones:read_own')
  @ApiOperation({ summary: 'Consultar elegibilidad y saldo propio de vacaciones' })
  @ApiOkResponse({
    schema: {
      example: {
        empleadoId: '00000000-0000-4000-8000-000000000101',
        elegible: true,
        gestiones: [
          {
            gestion: 1,
            diasAsignados: 15,
            diasTomados: 0,
            diasPendientes: 15,
          },
        ],
        advertencias: [],
      },
    },
  })
  getOwnBalance(
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    if (Object.keys(query).length > 0) {
      throw new BadRequestException(
        'La consulta de saldo propio no admite parámetros de selección o paginación.',
      );
    }
    return this.balances.getOwnBalance(principal.empleadoId);
  }
}
