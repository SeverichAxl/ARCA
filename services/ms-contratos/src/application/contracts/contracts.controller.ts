import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Audit } from '@arca/audit';
import { CurrentPrincipal, type InternalPrincipal } from '@arca/internal-auth';
import { RequireAnyPermission } from '../../common/decorators/require-any-permission.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  ContratoCreadoResponseDto,
  CreateContratoDto,
  PreviewContratoDto,
  PreviewContratoResponseDto,
} from './contract.dto';
import { ContractService } from './contract.service';

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'El identificador del contrato no es un UUID válido.',
    }),
});

const apiErrorSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 400 },
    code: { type: 'string', example: 'CONTR_DATOS_INCOMPLETOS' },
    message: { type: 'string' },
    details: { type: 'object', additionalProperties: true },
    traceId: { type: 'string' },
  },
};

@ApiTags('contratos')
@ApiBearerAuth()
@Controller('contratos')
export class ContractsController {
  constructor(private readonly service: ContractService) {}

  @Post()
  @RequirePermission('contrato:generate')
  @Audit({ modulo: 'contratos', accion: 'CONTRATO_CREAR' })
  @ApiOperation({
    summary: 'Registrar un contrato a partir de una plantilla y un empleado',
  })
  @ApiCreatedResponse({
    description: 'Contrato persistido en estado BORRADOR.',
    type: ContratoCreadoResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Plantilla inactiva, fecha inválida o datos incompletos.',
    schema: apiErrorSchema,
  })
  @ApiNotFoundResponse({
    description: 'Plantilla o empleado no encontrado.',
    schema: apiErrorSchema,
  })
  @ApiForbiddenResponse({ description: 'Permiso contrato:generate requerido.' })
  create(@Body() dto: CreateContratoDto, @CurrentPrincipal() principal: InternalPrincipal) {
    return this.service.create(dto, principal);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('contrato:generate')
  @Audit({ modulo: 'contratos', accion: 'CONTRATO_PREVISUALIZAR' })
  @ApiOperation({
    summary: 'Generar una vista previa efímera (no persiste el contrato)',
  })
  @ApiOkResponse({
    description: 'HTML interpolado con los datos reales del empleado.',
    type: PreviewContratoResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Plantilla inactiva o datos insuficientes.',
    schema: apiErrorSchema,
  })
  @ApiNotFoundResponse({
    description: 'Plantilla o empleado no encontrado.',
    schema: apiErrorSchema,
  })
  @ApiForbiddenResponse({ description: 'Permiso contrato:generate requerido.' })
  preview(
    @Body() dto: PreviewContratoDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.preview(dto, principal);
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermission('contrato:generate', 'contrato:read')
  @Audit({ modulo: 'contratos', accion: 'CONTRATO_PREVISUALIZAR' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Vista previa de un contrato persistido con la versión de plantilla usada',
  })
  @ApiOkResponse({
    description: 'HTML interpolado del contrato.',
    type: PreviewContratoResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos insuficientes para resolver las variables.',
    schema: apiErrorSchema,
  })
  @ApiNotFoundResponse({ description: 'Contrato no encontrado.', schema: apiErrorSchema })
  @ApiForbiddenResponse({
    description: 'Permiso contrato:generate o contrato:read requerido.',
  })
  previewById(
    @Param('id', uuidPipe) id: string,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.previewById(id, principal);
  }
}
