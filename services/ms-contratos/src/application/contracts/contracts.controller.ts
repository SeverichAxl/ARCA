import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Audit } from '@arca/audit';
import { CurrentPrincipal, type InternalPrincipal } from '@arca/internal-auth';
import { RequireAnyPermission } from '../../common/decorators/require-any-permission.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  ContratosEmpleadoResponseDto,
  ContratoCreadoResponseDto,
  CreateContratoDto,
  DescargaContratoResponseDto,
  DocumentoGeneradoResponseDto,
  GenerarPdfDatosDto,
  PreviewContratoDto,
  PreviewContratoResponseDto,
} from './contract.dto';
import {
  parseOptionalDatos,
  toArchivoFirma,
} from './contract-multipart';
import { ContratoMultipartExceptionFilter } from './contract-multipart-exception.filter';
import { ContractService } from './contract.service';
import { MAX_FIRMA_BYTES } from '../../domain/contracts/firma-validation';

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

  @Get('empleado/:empleadoId')
  @RequirePermission('contrato:read')
  @Audit({ modulo: 'contratos', accion: 'CONTRATOS_POR_EMPLEADO_LISTAR' })
  @ApiParam({ name: 'empleadoId', format: 'uuid' })
  @ApiOperation({ summary: 'Listar contratos y versiones PDF de un empleado' })
  @ApiOkResponse({
    description: 'Contratos encontrados para el empleado.',
    type: ContratosEmpleadoResponseDto,
    examples: {
      contratosEncontrados: {
        summary: 'Empleado con contratos',
        value: {
          data: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              empleadoId: '22222222-2222-4222-8222-222222222222',
              plantillaId: '11111111-1111-4111-8111-111111111111',
              plantillaNombre: 'Contrato indefinido',
              plantillaVersion: 2,
              estado: 'EMITIDO',
              versionVigente: 2,
              versiones: [
                {
                  id: '44444444-4444-4444-8444-444444444444',
                  version: 2,
                  estado: 'EMITIDO',
                  hashSha256: 'a'.repeat(64),
                  firmadoTrabajador: true,
                  firmadoRepresentante: true,
                  creadoEn: '2026-11-08T12:00:00.000Z',
                  documento: {
                    publicIdRef:
                      '33333333-3333-4333-8333-333333333333/v2',
                    versionId: '44444444-4444-4444-8444-444444444444',
                    mime: 'application/pdf',
                    bytes: 125000,
                  },
                },
              ],
              creadoEn: '2026-11-01T10:00:00.000Z',
            },
          ],
          meta: { total: 1 },
        },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Permiso contrato:read requerido.',
    schema: {
      example: {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Permiso contrato:read requerido.',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Empleado inexistente o sin contratos registrados.',
    schema: {
      example: {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'No se encontraron contratos para el empleado.',
      },
    },
  })
  listarPorEmpleado(
    @Param('empleadoId', uuidPipe) empleadoId: string,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.listarPorEmpleado(empleadoId, principal);
  }

  @Get('por-empleado/:empleadoId')
  @RequirePermission('contrato:read')
  @Audit({ modulo: 'contratos', accion: 'CONTRATOS_POR_EMPLEADO_LISTAR' })
  @ApiParam({ name: 'empleadoId', format: 'uuid' })
  @ApiOperation({
    summary: 'Alias compatible para listar contratos y versiones de un empleado',
  })
  @ApiOkResponse({ type: ContratosEmpleadoResponseDto })
  @ApiForbiddenResponse({
    description: 'Permiso contrato:read requerido.',
    schema: {
      example: {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Permiso contrato:read requerido.',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Empleado inexistente o sin contratos registrados.',
    schema: {
      example: {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'No se encontraron contratos para el empleado.',
      },
    },
  })
  listarPorEmpleadoAlias(
    @Param('empleadoId', uuidPipe) empleadoId: string,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.listarPorEmpleado(empleadoId, principal);
  }

  @Post(':id/pdf')
  @RequirePermission('contrato:generate')
  @Audit({ modulo: 'contratos', accion: 'CONTRATO_PDF_GENERAR' })
  @UseFilters(ContratoMultipartExceptionFilter)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'firmaTrabajador', maxCount: 1 },
        { name: 'firmaRepresentante', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: MAX_FIRMA_BYTES, files: 2, fields: 1 },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        datos: {
          type: 'string',
          description: 'JSON opcional, por ejemplo {"incluirFirmas":true}.',
        },
        firmaTrabajador: { type: 'string', format: 'binary' },
        firmaRepresentante: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Generar una nueva versión PDF inmutable del contrato' })
  @ApiCreatedResponse({ type: DocumentoGeneradoResponseDto })
  @ApiBadRequestResponse({ description: 'Datos o firmas inválidas.', schema: apiErrorSchema })
  @ApiNotFoundResponse({ description: 'Contrato no encontrado.', schema: apiErrorSchema })
  @ApiForbiddenResponse({ description: 'Permiso contrato:generate requerido.' })
  async generatePdf(
    @Param('id', uuidPipe) id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles()
    files:
      | {
      firmaTrabajador?: Express.Multer.File[];
      firmaRepresentante?: Express.Multer.File[];
        }
      | undefined,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    const uploads = files ?? {};
    const dto = await parseOptionalDatos(
      body?.datos,
      GenerarPdfDatosDto,
      { incluirFirmas: true },
    );
    return this.service.generatePdf(
      id,
      dto,
      {
        ...(uploads.firmaTrabajador?.[0]
          ? { firmaTrabajador: toArchivoFirma(uploads.firmaTrabajador[0]) }
          : {}),
        ...(uploads.firmaRepresentante?.[0]
          ? { firmaRepresentante: toArchivoFirma(uploads.firmaRepresentante[0]) }
          : {}),
      },
      principal,
    );
  }

  @Post(':id/firmar')
  @RequirePermission('contrato:generate')
  @Audit({ modulo: 'contratos', accion: 'CONTRATO_FIRMAR' })
  @UseFilters(ContratoMultipartExceptionFilter)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'firmaTrabajador', maxCount: 1 },
        { name: 'firmaRepresentante', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: MAX_FIRMA_BYTES, files: 2, fields: 0 },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        firmaTrabajador: { type: 'string', format: 'binary' },
        firmaRepresentante: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Adjuntar firmas y crear una nueva versión PDF' })
  @ApiCreatedResponse({ type: DocumentoGeneradoResponseDto })
  @ApiBadRequestResponse({ description: 'Se requiere una firma PNG/JPEG válida.', schema: apiErrorSchema })
  @ApiNotFoundResponse({ description: 'Contrato no encontrado.', schema: apiErrorSchema })
  @ApiForbiddenResponse({ description: 'Permiso contrato:generate requerido.' })
  firmar(
    @Param('id', uuidPipe) id: string,
    @UploadedFiles()
    files:
      | {
      firmaTrabajador?: Express.Multer.File[];
      firmaRepresentante?: Express.Multer.File[];
        }
      | undefined,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    const uploads = files ?? {};
    return this.service.firmar(
      id,
      {
        ...(uploads.firmaTrabajador?.[0]
          ? { firmaTrabajador: toArchivoFirma(uploads.firmaTrabajador[0]) }
          : {}),
        ...(uploads.firmaRepresentante?.[0]
          ? { firmaRepresentante: toArchivoFirma(uploads.firmaRepresentante[0]) }
          : {}),
      },
      principal,
    );
  }

  @Get(':id/pdf')
  @RequireAnyPermission('contrato:read', 'contrato:download_own')
  @Audit({ modulo: 'contratos', accion: 'CONTRATO_DESCARGAR' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Obtener una URL temporal para la última versión PDF' })
  @ApiOkResponse({ type: DescargaContratoResponseDto })
  @ApiNotFoundResponse({ description: 'Contrato o PDF no encontrado.', schema: apiErrorSchema })
  @ApiForbiddenResponse({ description: 'Permiso de lectura requerido.' })
  getLatestPdf(
    @Param('id', uuidPipe) id: string,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.getUltimaDescarga(id, principal);
  }

  @Get(':id/versiones/:versionId/descarga')
  @RequireAnyPermission('contrato:read', 'contrato:download_own')
  @Audit({ modulo: 'contratos', accion: 'CONTRATO_DESCARGAR' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'versionId', format: 'uuid' })
  @ApiOperation({ summary: 'Obtener una URL temporal para una versión específica' })
  @ApiOkResponse({ type: DescargaContratoResponseDto })
  @ApiNotFoundResponse({ description: 'Contrato o versión no encontrada.', schema: apiErrorSchema })
  @ApiForbiddenResponse({ description: 'Permiso de lectura requerido.' })
  getVersionPdf(
    @Param('id', uuidPipe) id: string,
    @Param('versionId', uuidPipe) versionId: string,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.getDescarga(id, versionId, principal);
  }
}
