import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import type { JwtPayload } from 'common-dtos';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  ExceptionDecisionDto,
  VacationDecisionDto,
  VacationRejectionDto,
} from './vacation-transition.dto';
import { VacationApprovalService } from './vacation-approval.service';

@Controller('vacaciones')
export class VacationApprovalController {
  constructor(private readonly approvalService: VacationApprovalService) {}

  @Post('solicitudes/:id/aprobar-jefe')
  @RequirePermission('vacaciones:approve_jefe')
  approveByManager(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Req() request: Request & { user?: JwtPayload },
    @Body() body: VacationDecisionDto,
  ) {
    const actor = this.actorFrom(request);
    return this.approvalService.approveByManager(requestId, actor, body.comentario);
  }

  @Post('solicitudes/:id/aprobar-rrhh')
  @RequirePermission('vacaciones:approve_rrhh')
  approveByHr(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Req() request: Request & { user?: JwtPayload },
    @Body() body: VacationDecisionDto,
  ) {
    const actor = this.actorFrom(request);
    return this.approvalService.approveByHr(requestId, actor, body.comentario);
  }

  @Post('solicitudes/:id/rechazar')
  @RequirePermission('vacaciones:approve_jefe', 'vacaciones:approve_rrhh')
  reject(
    @Param('id', ParseUUIDPipe) requestId: string,
    @Req() request: Request & { user?: JwtPayload },
    @Body() body: VacationRejectionDto,
  ) {
    const actor = this.actorFrom(request);
    return this.approvalService.reject(requestId, actor, body.motivo);
  }

  @Post('excepciones/:id/resolver')
  @RequirePermission('vacaciones:excepcion_resolve')
  resolveException(
    @Param('id', ParseUUIDPipe) exceptionId: string,
    @Req() request: Request & { user?: JwtPayload },
    @Body() body: ExceptionDecisionDto,
  ) {
    const actor = this.actorFrom(request);
    return this.approvalService.resolveException(
      exceptionId,
      actor,
      body.decision,
      body.comentario,
    );
  }

  private actorFrom(request: Request & { user?: JwtPayload }) {
    const user = request.user;
    if (
      !user?.sub ||
      !user.empleadoId ||
      !isUUID(user.sub) ||
      !isUUID(user.empleadoId) ||
      typeof user.rol !== 'string' ||
      !Array.isArray(user.permisos)
    ) {
      throw new UnauthorizedException('El token no contiene la identidad requerida.');
    }

    return {
      usuarioId: user.sub,
      empleadoId: user.empleadoId,
      rol: user.rol,
      permisos: user.permisos,
    };
  }
}
