import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentPrincipal,
  RequireAnyPermission,
  RequirePermission,
} from '@arca/internal-auth';
import type { InternalPrincipal } from '@arca/internal-auth';
import { CreateVacationRequestDto } from './create-vacation-request.dto';
import {
  CancelVacationRequestDto,
  VacationRequestQueryDto,
} from './vacation-request-query.dto';
import { VacationRequestService } from './vacation-request.service';

@ApiTags('vacaciones')
@ApiBearerAuth()
@Controller('vacaciones/solicitudes')
export class VacationRequestController {
  constructor(private readonly requests: VacationRequestService) {}

  @Get()
  @RequireAnyPermission(
    'vacaciones:read_own',
    'vacaciones:approve_jefe',
    'vacaciones:approve_rrhh',
  )
  @ApiOperation({ summary: 'Listar solicitudes propias o de una bandeja de aprobación' })
  @ApiOkResponse()
  list(
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Query() query: VacationRequestQueryDto,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.requests.list(principal, query);
  }

  @Get(':id')
  @RequireAnyPermission(
    'vacaciones:read_own',
    'vacaciones:read_area',
    'vacaciones:read_all',
  )
  @ApiOperation({ summary: 'Consultar una solicitud con su historial y excepción' })
  @ApiOkResponse()
  getById(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.requests.getById(requestId, principal);
  }

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

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vacaciones:request')
  @ApiOperation({ summary: 'Cancelar una solicitud propia antes de la aprobación final' })
  @ApiOkResponse()
  cancel(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Body() input: CancelVacationRequestDto = new CancelVacationRequestDto(),
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.requests.cancel(requestId, principal, input.motivo);
  }
}
