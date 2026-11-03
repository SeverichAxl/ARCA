import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal, RequirePermission } from '@arca/internal-auth';
import type { InternalPrincipal } from '@arca/internal-auth';
import { CreateVacationRequestDto } from './create-vacation-request.dto';
import { VacationRequestService } from './vacation-request.service';

@ApiTags('vacaciones')
@ApiBearerAuth()
@Controller('vacaciones/solicitudes')
export class VacationRequestController {
  constructor(private readonly requests: VacationRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('vacaciones:request')
  @ApiOperation({ summary: 'Solicitar vacaciones propias' })
  @ApiCreatedResponse({
    schema: {
      example: {
        id: '00000000-0000-4000-8000-000000000301',
        empleadoId: '00000000-0000-4000-8000-000000000101',
        fechaInicio: '2026-12-21T00:00:00.000Z',
        fechaFin: '2026-12-23T00:00:00.000Z',
        diasHabiles: 3,
        estado: 'PENDIENTE_JEFE',
        jefeEmpleadoId: '00000000-0000-4000-8000-000000000102',
      },
    },
  })
  create(
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Body() input: CreateVacationRequestDto,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.requests.create(
      principal.empleadoId,
      principal.userId,
      input.fechaInicio,
      input.fechaFin,
      input.solicitarExcepcion ?? false,
      input.justificacionExcepcion,
    );
  }
}
