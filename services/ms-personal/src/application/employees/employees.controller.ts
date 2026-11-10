import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, SkipAudit } from '@arca/audit';
import {
  CurrentPrincipal,
  RequireAnyPermission,
  RequirePermission,
  type InternalPrincipal,
} from '@arca/internal-auth';
import {
  BajaDatosDto,
  CerrarInamovilidadDto,
  CreateEmployeeDatosDto,
  CreateInamovilidadDto,
  HistorialQueryDto,
  ListEmployeesQueryDto,
  ExportEmployeesQueryDto,
  PaginationQueryDto,
  RatifyEmployeeDto,
  SimularBajaDto,
  UpdateEmployeeDto,
} from './employee.dto';
import { EmployeeService } from './employee.service';
import { EmployeeExportService } from './employee-export.service';
import type { Response } from 'express';
import { Res } from '@nestjs/common';
import { MultipartExceptionFilter } from './multipart-exception.filter';
import { parseMultipartDatos, toArchivoEntrante, validateDto } from './multipart';
import { plainToInstance } from 'class-transformer';

type Files = Record<string, Express.Multer.File[] | undefined>;

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
    }),
});

const multipartOptions = {
  limits: { fileSize: 10 * 1024 * 1024, files: 2, fields: 1, fieldSize: 16 * 1024 },
};

async function validateRaw<T extends object>(raw: unknown, dto: new () => T): Promise<T> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return parseMultipartDatos(raw, dto);
  }
  return validateDto(plainToInstance(dto, raw));
}

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
@UseFilters(MultipartExceptionFilter)
export class EmployeesController {
  constructor(
    private readonly service: EmployeeService,
    private readonly exports: EmployeeExportService,
  ) {}

  @Post()
  @RequirePermission('personal:create')
  @Audit({ modulo: 'personal', accion: 'EMPLEADO_CREAR' })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'firma', maxCount: 1 }], multipartOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['datos', 'firma'],
      properties: {
        datos: { type: 'string', example: '{"nombres":"Ana","apellidos":"Rojas"}' },
        firma: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Dar de alta un funcionario' })
  async create(
    @Body('datos') raw: unknown,
    @UploadedFiles() files: Files | undefined,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    const dto = await parseMultipartDatos(raw, CreateEmployeeDatosDto);
    const firma = files?.firma?.[0];
    return this.service.create(dto, firma ? toArchivoEntrante(firma) : undefined, principal);
  }

  @Get()
  @RequirePermission('personal:read')
  @ApiOperation({ summary: 'Buscar y listar funcionarios' })
  list(@Query() query: ListEmployeesQueryDto, @CurrentPrincipal() principal: InternalPrincipal) {
    return this.service.list(query, principal);
  }

  @Get('exportar/archivo')
  @RequirePermission('export:data')
  @ApiOperation({ summary: 'Exportar personal filtrado en CSV o XLSX respetando campos sensibles' })
  async exportFile(
    @Query() query: ExportEmployeesQueryDto,
    @CurrentPrincipal() principal: InternalPrincipal,
    @Res() response: Response,
  ) {
    const file = await this.exports.exportar(query, query.format, principal);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.bytes);
  }

  @Get(':id')
  @RequirePermission('personal:read')
  @ApiOperation({ summary: 'Consultar la ficha de un funcionario' })
  get(@Param('id', uuidPipe) id: string, @CurrentPrincipal() principal: InternalPrincipal) {
    return this.service.get(id, principal);
  }

  @Get(':id/datos-contrato')
  @RequireAnyPermission('contrato:generate', 'contrato:read')
  @ApiOperation({
    summary: 'Datos mínimos del funcionario para resolver variables de contrato (uso interno)',
  })
  contractData(
    @Param('id', uuidPipe) id: string,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.getContractData(id, principal);
  }

  @Get(':id/historial')
  @RequirePermission('personal:read')
  @ApiOperation({ summary: 'Consultar el historial laboral' })
  history(
    @Param('id', uuidPipe) id: string,
    @Query() query: HistorialQueryDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.listHistory(id, query.page, query.pageSize, principal);
  }

  @Get(':id/firma')
  @RequirePermission('personal:read')
  @ApiOperation({ summary: 'Obtener una URL firmada temporal para la firma del funcionario' })
  firmaUrl(@Param('id', uuidPipe) id: string, @CurrentPrincipal() principal: InternalPrincipal) {
    return this.service.getFirmaUrl(id, principal);
  }

  @Patch(':id')
  @RequirePermission('personal:update')
  @Audit({ modulo: 'personal', accion: 'EMPLEADO_MODIFICAR' })
  @ApiOperation({ summary: 'Modificar área, cargo o remuneración' })
  update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.update(id, dto, principal);
  }

  @Post(':id/ratificar')
  @RequirePermission('personal:ratify')
  @Audit({ modulo: 'personal', accion: 'EMPLEADO_RATIFICAR' })
  @ApiOperation({ summary: 'Ratificar un funcionario' })
  ratify(
    @Param('id', uuidPipe) id: string,
    @Body() dto: RatifyEmployeeDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.ratify(id, dto, principal);
  }

  @Post(':id/baja/simular')
  @RequirePermission('personal:baja')
  @SkipAudit()
  @ApiOperation({ summary: 'Simular el finiquito sin registrar la baja' })
  simulateBaja(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SimularBajaDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.simulateBaja(id, dto, principal);
  }

  @Post(':id/baja')
  @RequirePermission('personal:baja')
  @Audit({ modulo: 'personal', accion: 'EMPLEADO_DAR_DE_BAJA' })
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'autorizacionMinisterio', maxCount: 1 }], multipartOptions),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['datos'],
      properties: {
        datos: { type: 'string', example: '{"fechaBaja":"2026-11-30","motivo":"Renuncia"}' },
        autorizacionMinisterio: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Registrar la baja y el finiquito' })
  async baja(
    @Body('datos') raw: unknown,
    @UploadedFiles() files: Files | undefined,
    @Param('id', uuidPipe) id: string,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    const dto = await parseMultipartDatos(raw, BajaDatosDto);
    const file = files?.autorizacionMinisterio?.[0];
    return this.service.baja(id, dto, file ? toArchivoEntrante(file) : undefined, principal);
  }

  @Get(':id/inamovilidades')
  @RequirePermission('personal:read')
  @ApiOperation({ summary: 'Listar inamovilidades de un funcionario' })
  listInamovilidades(
    @Param('id', uuidPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.listInamovilidades(id, query.page, query.pageSize, principal);
  }

  @Post(':id/inamovilidades')
  @RequirePermission('personal:inamovilidad')
  @Audit({ modulo: 'personal', accion: 'INAMOVILIDAD_ALTA' })
  @UseInterceptors(FileFieldsInterceptor([{ name: 'respaldo', maxCount: 1 }], multipartOptions))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({ summary: 'Registrar una inamovilidad laboral' })
  async createInamovilidad(
    @Param('id', uuidPipe) id: string,
    @Body() raw: unknown,
    @UploadedFiles() files: Files | undefined,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    const dto = await validateRaw(raw, CreateInamovilidadDto);
    const file = files?.respaldo?.[0];
    return this.service.createInamovilidad(
      id,
      dto,
      file ? toArchivoEntrante(file) : undefined,
      principal,
    );
  }

  @Patch(':id/inamovilidades/:inamovilidadId/cerrar')
  @RequirePermission('personal:inamovilidad')
  @Audit({ modulo: 'personal', accion: 'INAMOVILIDAD_CERRAR' })
  @ApiOperation({ summary: 'Cerrar una inamovilidad laboral' })
  closeInamovilidad(
    @Param('id', uuidPipe) id: string,
    @Param('inamovilidadId', uuidPipe) inamovilidadId: string,
    @Body() dto: CerrarInamovilidadDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.closeInamovilidad(id, inamovilidadId, dto, principal);
  }
}
