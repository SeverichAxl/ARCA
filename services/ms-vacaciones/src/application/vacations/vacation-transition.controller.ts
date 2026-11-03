import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import {
  CreateVacationExceptionDto,
  RejectVacationDto,
  ResolveVacationExceptionDto,
  VacationCommentDto,
} from './vacation-transition.dto';
import { VacationApprovalService } from './vacation-approval.service';

@ApiTags('vacaciones')
@ApiBearerAuth()
@Controller('vacaciones/solicitudes')
export class VacationTransitionController {
  constructor(private readonly approvals: VacationApprovalService) {}

  @Post(':id/aprobar-jefe')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vacaciones:approve_jefe')
  @ApiOperation({ summary: 'Aprobar solicitud en el nivel del jefe inmediato' })
  @ApiOkResponse()
  approveByManager(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Body() input: VacationCommentDto,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.approvals.approveByManager(requestId, principal, input.comentario);
  }

  @Post(':id/aprobar-rrhh')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vacaciones:approve_rrhh')
  @ApiOperation({ summary: 'Aprobar solicitud en el nivel final de RRHH' })
  @ApiOkResponse()
  approveByHr(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Body() input: VacationCommentDto,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.approvals.approveByHr(requestId, principal, input.comentario);
  }

  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('vacaciones:approve_jefe', 'vacaciones:approve_rrhh')
  @ApiOperation({ summary: 'Rechazar solicitud en el nivel de aprobación actual' })
  @ApiOkResponse()
  reject(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Body() input: RejectVacationDto,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.approvals.reject(requestId, principal, input.motivo);
  }

  @Post(':id/excepcion')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('vacaciones:request')
  @ApiOperation({ summary: 'Solicitar excepción por saldo insuficiente' })
  @ApiCreatedResponse()
  createException(
    @Param('id', new ParseUUIDPipe()) requestId: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Body() input: CreateVacationExceptionDto,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.approvals.createException(requestId, principal, input.justificacion);
  }
}

@ApiTags('vacaciones')
@ApiBearerAuth()
@Controller('vacaciones/excepciones')
export class VacationExceptionController {
  constructor(private readonly approvals: VacationApprovalService) {}

  @Post(':id/resolver')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vacaciones:excepcion_resolve')
  @ApiOperation({ summary: 'Resolver solicitud de excepción por exceso de días' })
  @ApiOkResponse()
  resolve(
    @Param('id', new ParseUUIDPipe()) exceptionId: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Body() input: ResolveVacationExceptionDto,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.approvals.resolveException(
      exceptionId,
      principal,
      input.decision,
      input.comentario,
    );
  }
}
