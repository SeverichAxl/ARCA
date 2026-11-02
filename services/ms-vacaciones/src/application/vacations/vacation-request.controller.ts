import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import type { JwtPayload } from 'common-dtos';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateVacationRequestDto } from './create-vacation-request.dto';
import { VacationRequestService } from './vacation-request.service';

@Controller('vacaciones/solicitudes')
export class VacationRequestController {
  constructor(private readonly requestService: VacationRequestService) {}

  @Post()
  @RequirePermission('vacaciones:request')
  create(@Req() request: Request & { user?: JwtPayload }, @Body() body: CreateVacationRequestDto) {
    const empleadoId = request.user?.empleadoId;
    const actorUsuarioId = request.user?.sub;
    if (!empleadoId || !actorUsuarioId || !isUUID(empleadoId) || !isUUID(actorUsuarioId)) {
      throw new UnauthorizedException('El token no contiene la identidad requerida.');
    }

    return this.requestService.create(
      empleadoId,
      actorUsuarioId,
      body.fechaInicio,
      body.fechaFin,
      body.solicitarExcepcion ?? false,
      body.justificacionExcepcion,
    );
  }
}
