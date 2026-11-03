import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from 'common-dtos';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  type ArchivoSubido,
  MAX_FIRMA_BYTES,
  MAX_PDF_BYTES,
} from '../../common/files/archivo.validator';
import { parseJsonDto } from '../../common/validation/validacion';
import { BajasService } from './bajas.service';
import {
  BajaDto,
  CerrarInamovilidadDto,
  CreateEmpleadoDto,
  InamovilidadDto,
  ListEmpleadosQuery,
  PaginacionQuery,
  RatificarDto,
  UpdateEmpleadoDto,
} from './dto/empleado.dto';
import { EmployeesService } from './employees.service';
import { InamovilidadesService } from './inamovilidades.service';

const uuid = new ParseUUIDPipe({ version: 'all' });
const limitesFirma = { limits: { fileSize: MAX_FIRMA_BYTES + 1, files: 1, fields: 2 } };
const limitesPdf = { limits: { fileSize: MAX_PDF_BYTES + 1, files: 1, fields: 2 } };

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly bajas: BajasService,
    private readonly inamovilidades: InamovilidadesService,
  ) {}

  @Post()
  @RequirePermission('personal:create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Alta de funcionario (campo "datos" JSON + archivo "firma")' })
  @UseInterceptors(FileInterceptor('firma', limitesFirma))
  async crear(
    @Body('datos') datos: string,
    @UploadedFile() firma: ArchivoSubido | undefined,
    @CurrentUser() actor: JwtPayload,
  ) {
    const dto = await parseJsonDto(CreateEmpleadoDto, datos);
    return this.employees.crear(dto, firma, actor);
  }

  @Get()
  @RequirePermission('personal:read')
  @ApiOperation({ summary: 'Listado con búsqueda, filtros y paginación' })
  listar(@Query() query: ListEmpleadosQuery, @CurrentUser() actor: JwtPayload) {
    return this.employees.listar(query, actor);
  }

  @Get(':id')
  @RequirePermission('personal:read')
  detalle(@Param('id', uuid) id: string, @CurrentUser() actor: JwtPayload) {
    return this.employees.detalle(id, actor);
  }

  @Get(':id/historial')
  @RequirePermission('personal:read')
  historial(
    @Param('id', uuid) id: string,
    @Query() query: PaginacionQuery,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.employees.historial(id, query, actor);
  }

  @Get(':id/firma')
  @RequirePermission('personal:read')
  @ApiOperation({ summary: 'URL firmada (5 min) de la firma gráfica' })
  firma(@Param('id', uuid) id: string, @CurrentUser() actor: JwtPayload) {
    return this.employees.urlFirma(id, actor);
  }

  @Patch(':id')
  @RequirePermission('personal:update')
  modificar(
    @Param('id', uuid) id: string,
    @Body() dto: UpdateEmpleadoDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.employees.modificar(id, dto, actor);
  }

  @Post(':id/ratificar')
  @HttpCode(200)
  @RequirePermission('personal:ratify')
  ratificar(
    @Param('id', uuid) id: string,
    @Body() dto: RatificarDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.employees.ratificar(id, dto, actor);
  }

  @Post(':id/baja/preview')
  @HttpCode(200)
  @RequirePermission('personal:baja')
  @ApiOperation({ summary: 'Previsualiza las protecciones y el finiquito sin persistir cambios' })
  previsualizarBaja(
    @Param('id', uuid) id: string,
    @Body() dto: BajaDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.bajas.previsualizar(id, dto, actor);
  }

  @Post(':id/baja')
  @RequirePermission('personal:baja')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Baja (campo "datos" JSON + "autorizacionMinisterio" PDF si hay inamovilidad)',
  })
  @UseInterceptors(FileInterceptor('autorizacionMinisterio', limitesPdf))
  async registrarBaja(
    @Param('id', uuid) id: string,
    @Body('datos') datos: string,
    @UploadedFile() autorizacion: ArchivoSubido | undefined,
    @CurrentUser() actor: JwtPayload,
  ) {
    const dto = await parseJsonDto(BajaDto, datos);
    return this.bajas.registrar(id, dto, autorizacion, actor);
  }

  @Get(':id/inamovilidades')
  @RequirePermission('personal:read')
  listarInamovilidades(@Param('id', uuid) id: string, @Query() query: PaginacionQuery) {
    return this.inamovilidades.listar(id, query);
  }

  @Post(':id/inamovilidades')
  @RequirePermission('personal:inamovilidad')
  crearInamovilidad(
    @Param('id', uuid) id: string,
    @Body() dto: InamovilidadDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.inamovilidades.crear(id, dto, actor);
  }

  @Patch(':id/inamovilidades/:inamovilidadId/cerrar')
  @RequirePermission('personal:inamovilidad')
  cerrarInamovilidad(
    @Param('id', uuid) id: string,
    @Param('inamovilidadId', uuid) inamovilidadId: string,
    @Body() dto: CerrarInamovilidadDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.inamovilidades.cerrar(id, inamovilidadId, dto, actor);
  }
}
