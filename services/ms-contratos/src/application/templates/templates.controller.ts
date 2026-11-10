import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { CurrentPrincipal, type InternalPrincipal } from '@arca/internal-auth';
import { Audit } from '@arca/audit';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-any-permission.decorator';
import {
  CreatePlantillaDto,
  ListPlantillasQueryDto,
  PlantillaCreadaResponseDto,
  PlantillaDetalleResponseDto,
  PlantillaListadoPageResponseDto,
  UpdatePlantillaDto,
} from './template.dto';
import { PlantillaService } from './template.service';

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'El identificador de la plantilla no es un UUID válido.',
    }),
});

const apiErrorSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 400 },
    code: { type: 'string', example: 'CONTR_VARIABLE_NO_PERMITIDA' },
    message: { type: 'string' },
    details: { type: 'object', additionalProperties: true },
    traceId: { type: 'string' },
  },
};

@ApiTags('plantillas')
@ApiBearerAuth()
@Controller('contratos/plantillas')
export class PlantillasController {
  constructor(private readonly service: PlantillaService) {}

  @Post()
  @RequirePermission('contrato:template_manage')
  @Audit({ modulo: 'contratos', accion: 'CONTRATO_PLANTILLA_CREAR' })
  @ApiOperation({ summary: 'Crear una plantilla de contrato HTML' })
  @ApiCreatedResponse({
    description: 'Plantilla creada y saneada.',
    type: PlantillaCreadaResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'HTML inválido, variables fuera del catálogo o placeholders malformados.',
    schema: apiErrorSchema,
  })
  @ApiForbiddenResponse({ description: 'Permiso contrato:template_manage requerido.' })
  create(@Body() dto: CreatePlantillaDto, @CurrentPrincipal() principal: InternalPrincipal) {
    return this.service.create(dto, principal.userId);
  }

  @Get()
  @RequireAnyPermission('contrato:template_manage', 'contrato:generate')
  @ApiOperation({ summary: 'Listar plantillas de contrato' })
  @ApiOkResponse({ description: 'Listado paginado.', type: PlantillaListadoPageResponseDto })
  @ApiBadRequestResponse({
    description: 'Parámetros de consulta inválidos.',
    schema: apiErrorSchema,
  })
  @ApiForbiddenResponse({
    description: 'Permiso contrato:template_manage o contrato:generate requerido.',
  })
  list(@Query() query: ListPlantillasQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequireAnyPermission('contrato:template_manage', 'contrato:generate')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Obtener una plantilla de contrato por ID' })
  @ApiOkResponse({
    description: 'Detalle y versiones de la plantilla.',
    type: PlantillaDetalleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Plantilla no encontrada.', schema: apiErrorSchema })
  @ApiForbiddenResponse({
    description: 'Permiso contrato:template_manage o contrato:generate requerido.',
  })
  get(@Param('id', uuidPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @RequirePermission('contrato:template_manage')
  @Audit({ modulo: 'contratos', accion: 'CONTRATO_PLANTILLA_ACTUALIZAR' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({
    summary: 'Actualizar una plantilla y crear una nueva versión si cambia el HTML',
  })
  @ApiOkResponse({ description: 'Plantilla actualizada.', type: PlantillaDetalleResponseDto })
  @ApiBadRequestResponse({
    description: 'HTML inválido, variables fuera del catálogo o placeholders malformados.',
    schema: apiErrorSchema,
  })
  @ApiNotFoundResponse({ description: 'Plantilla no encontrada.', schema: apiErrorSchema })
  @ApiForbiddenResponse({ description: 'Permiso contrato:template_manage requerido.' })
  update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdatePlantillaDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.update(id, dto, principal.userId);
  }
}
