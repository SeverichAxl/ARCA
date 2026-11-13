import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Audit, AuditContext } from '@arca/audit';
import {
  CurrentPrincipal,
  RequireAnyPermission,
  RequirePermission,
  type InternalPrincipal,
} from '@arca/internal-auth';
import type { Actor } from '../../domain/planillas/planilla.models';
import { DomainErrorInterceptor } from './domain-error.interceptor';
import {
  DetalleQueryDto,
  ListarPlanillasQueryDto,
  PaginacionDto,
  ParametrosQueryDto,
  PERIODO_PATTERN,
  RegistrarNovedadDto,
  ResumenQueryDto,
} from './planillas.dto';
import { PlanillasService } from './planillas.service';

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
    }),
});

function periodoValido(periodo: string): string {
  if (!PERIODO_PATTERN.test(periodo)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      details: { fields: { periodo: 'Debe tener formato YYYY-MM.' } },
    });
  }
  return periodo;
}

function actor(principal: InternalPrincipal | undefined): Actor {
  if (!principal) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' });
  }
  return principal;
}

const PERIODO_PARAM = { name: 'periodo', example: '2026-10', description: 'YYYY-MM' };

@ApiTags('planillas')
@ApiBearerAuth()
@Controller('planillas')
@UseInterceptors(DomainErrorInterceptor)
export class PlanillasController {
  constructor(
    private readonly service: PlanillasService,
    private readonly auditContext: AuditContext,
  ) {}

  @Get('parametros/vigentes')
  @RequireAnyPermission('planilla:calculate', 'planilla:read', 'parametros_ley:update')
  @ApiOperation({ summary: 'Parámetros legales que aplicará el motor a una fecha de corte' })
  parametrosVigentes(@Query() query: ParametrosQueryDto) {
    return this.service.parametrosVigentes(query.fecha);
  }

  @Get('politica-retencion')
  @RequirePermission('planilla:read')
  @ApiOperation({ summary: 'Política de retención e inmutabilidad (RF-26)' })
  politicaRetencion() {
    return this.service.politicaRetencion();
  }

  @Get('resumen')
  @RequirePermission('dashboard:read')
  @ApiOperation({ summary: 'Costo salarial por periodo cerrado (dashboard, HU-25)' })
  resumen(@Query() query: ResumenQueryDto) {
    return this.service.resumenCostos(query.desde, query.hasta);
  }

  @Get('mis-pagos')
  @RequirePermission('boleta:read_own')
  @ApiOperation({ summary: 'Autoconsulta: pagos propios de planillas cerradas (HU-23)' })
  misPagos(
    @Query() query: PaginacionDto,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    return this.service.misPagos(actor(principal), query.page, query.pageSize);
  }

  @Get('mis-pagos/:periodo')
  @RequirePermission('boleta:read_own')
  @ApiParam(PERIODO_PARAM)
  @ApiOperation({ summary: 'Autoconsulta: desglose propio de un periodo cerrado' })
  miPago(
    @Param('periodo') periodo: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    return this.service.miPago(actor(principal), periodoValido(periodo));
  }

  @Get('periodos/:periodo/novedades')
  @RequirePermission('planilla:calculate')
  @ApiParam(PERIODO_PARAM)
  @ApiOperation({ summary: 'Listar novedades del periodo' })
  listarNovedades(@Param('periodo') periodo: string) {
    return this.service.listarNovedades(periodoValido(periodo));
  }

  @Put('periodos/:periodo/novedades/:empleadoId')
  @RequirePermission('planilla:calculate')
  @Audit({ modulo: 'planillas', accion: 'PLANILLA_NOVEDAD_REGISTRAR' })
  @ApiParam(PERIODO_PARAM)
  @ApiOperation({
    summary: 'Registrar/editar novedades (incluye RC-IVA computable editable) de un funcionario',
  })
  @ApiResponse({ status: 409, description: 'PLAN_CERRADA' })
  async registrarNovedad(
    @Param('periodo') periodo: string,
    @Param('empleadoId', uuidPipe) empleadoId: string,
    @Body() dto: RegistrarNovedadDto,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    const resultado = await this.service.registrarNovedad(
      periodoValido(periodo),
      empleadoId,
      dto,
      actor(principal),
    );
    this.auditContext.captureAfter({
      periodo: resultado.periodo,
      empleadoId: resultado.empleadoId,
      diasTrabajados: resultado.diasTrabajados,
      camposEditados: Object.keys(dto),
    });
    return resultado;
  }

  @Post('periodos/:periodo/calcular')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('planilla:calculate')
  @Audit({ modulo: 'planillas', accion: 'PLANILLA_CALCULAR' })
  @ApiParam(PERIODO_PARAM)
  @ApiOperation({
    summary: 'Procesar el periodo para funcionarios activos (crea o recalcula BORRADOR)',
  })
  @ApiResponse({ status: 409, description: 'PLAN_CERRADA: el periodo ya fue cerrado' })
  @ApiResponse({ status: 422, description: 'PLAN_PARAMETROS_INCOMPLETOS, PLAN_SIN_EMPLEADOS, ...' })
  async calcular(
    @Param('periodo') periodo: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    const resultado = await this.service.calcular(periodoValido(periodo), actor(principal));
    this.auditContext.captureAfter({
      planillaId: resultado.planilla.id,
      periodo: resultado.planilla.periodo,
      version: resultado.planilla.version,
      totalEmpleados: resultado.planilla.totalEmpleados,
      duracionTotalMs: resultado.duracionTotalMs,
    });
    return resultado;
  }

  @Get('periodos/:periodo')
  @RequirePermission('planilla:read')
  @ApiParam(PERIODO_PARAM)
  @ApiOperation({ summary: 'Cabecera y totales de la planilla de un periodo' })
  obtenerPorPeriodo(@Param('periodo') periodo: string) {
    return this.service.obtenerPorPeriodo(periodoValido(periodo));
  }

  @Get()
  @RequirePermission('planilla:read')
  @ApiOperation({ summary: 'Historial de planillas con filtros (HU-24)' })
  @ApiOkResponse()
  listar(@Query() query: ListarPlanillasQueryDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermission('planilla:read')
  @ApiOperation({ summary: 'Cabecera de una planilla' })
  obtener(@Param('id', uuidPipe) id: string) {
    return this.service.obtener(id);
  }

  @Get(':id/detalle')
  @RequirePermission('planilla:read')
  @ApiOperation({ summary: 'Desglose por funcionario (paginado, filtros por área/empleado)' })
  detalle(@Param('id', uuidPipe) id: string, @Query() query: DetalleQueryDto) {
    return this.service.listarDetalle(id, query);
  }

  @Get(':id/empleados/:empleadoId')
  @RequireAnyPermission('planilla:read', 'boleta:read_all')
  @ApiOperation({ summary: 'Desglose de un funcionario (fuente de la boleta PDF, HU-22)' })
  detalleEmpleado(
    @Param('id', uuidPipe) id: string,
    @Param('empleadoId', uuidPipe) empleadoId: string,
  ) {
    return this.service.obtenerDetalleEmpleado(id, empleadoId);
  }

  @Post(':id/cerrar')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('planilla:close')
  @Audit({ modulo: 'planillas', accion: 'PLANILLA_CERRAR' })
  @ApiOperation({ summary: 'Cerrar la planilla: queda inmutable y con retención mínima de 8 años' })
  @ApiResponse({ status: 409, description: 'PLAN_CERRADA: doble cierre' })
  async cerrar(
    @Param('id', uuidPipe) id: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    const cerrada = await this.service.cerrar(id, actor(principal));
    this.auditContext.captureAfter({
      planillaId: cerrada.id,
      periodo: cerrada.periodo,
      estado: cerrada.estado,
      retencionHasta: cerrada.retencionHasta,
    });
    return cerrada;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('planilla:calculate')
  @Audit({ modulo: 'planillas', accion: 'PLANILLA_BORRADOR_ELIMINAR' })
  @ApiOperation({ summary: 'Descartar un BORRADOR. Una planilla cerrada responde 409.' })
  @ApiResponse({ status: 409, description: 'PLAN_CERRADA' })
  async eliminar(@Param('id', uuidPipe) id: string): Promise<void> {
    await this.service.eliminarBorrador(id);
  }
}
