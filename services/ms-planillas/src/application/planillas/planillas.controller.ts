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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  CerrarPlanillaDto,
  DetalleQueryDto,
  HistorialQueryDto,
  KpisQueryDto,
  ListarPlanillasQueryDto,
  PaginacionDto,
  ParametrosQueryDto,
  PERIODO_PATTERN,
  ProcesarPlanillaDto,
  RegistrarNovedadDto,
} from './planillas.dto';
import { PlanillasService, type ProcesoIniciado } from './planillas.service';

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
  // El guard global ya verificó la firma; sin principal no hay identidad.
  if (!principal) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' });
  }
  return principal;
}

const PERIODO_PARAM = { name: 'periodo', example: '2026-10', description: 'YYYY-MM' };

/**
 * Contrato: docs/api/planillas.md y docs/api/openapi/planillas.yaml (TSK-ARQ-201).
 * Las rutas marcadas "Extensión" no están en el contrato aprobado y quedan
 * documentadas como propuesta de ampliación.
 * Rutas estáticas antes que `/:id`; las de parámetros (LegalParameterModule)
 * se registran antes que este controlador en app.module.
 */
@ApiTags('planillas')
@ApiBearerAuth()
@Controller('planillas')
@UseInterceptors(DomainErrorInterceptor)
export class PlanillasController {
  constructor(
    private readonly service: PlanillasService,
    private readonly auditContext: AuditContext,
  ) {}

  // -------------------------------------------------- rutas estáticas primero

  @Get('historial')
  @RequirePermission('planilla:read')
  @ApiOperation({ summary: 'Historial inmutable: solo planillas cerradas (HU-24)' })
  historial(@Query() query: HistorialQueryDto) {
    return this.service.historial(query);
  }

  @Get('kpis')
  @RequireAnyPermission('dashboard:read', 'dashboard:read_area')
  @ApiOperation({ summary: 'KPIs de costo y boletas de planillas cerradas (HU-25)' })
  @ApiResponse({ status: 404, description: 'Periodo sin planilla cerrada o área ajena' })
  kpis(@Query() query: KpisQueryDto, @CurrentPrincipal() principal: InternalPrincipal | undefined) {
    return this.service.kpis(query, actor(principal));
  }

  @Get('parametros/vigentes')
  @RequireAnyPermission('planilla:calculate', 'planilla:read', 'parametros_ley:update')
  @ApiOperation({ summary: 'Extensión: parámetros que aplicará el motor a una fecha de corte' })
  parametrosVigentes(@Query() query: ParametrosQueryDto) {
    return this.service.parametrosVigentes(query.fecha);
  }

  @Get('politica-retencion')
  @RequirePermission('planilla:read')
  @ApiOperation({ summary: 'Extensión: política de retención e inmutabilidad (RF-26)' })
  politicaRetencion() {
    return this.service.politicaRetencion();
  }

  @Get('mis-pagos')
  @RequirePermission('boleta:read_own')
  @ApiOperation({ summary: 'Extensión: desglose propio de planillas cerradas (HU-23)' })
  misPagos(
    @Query() query: PaginacionDto,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    return this.service.misPagos(actor(principal), query.page, query.pageSize);
  }

  @Get('mis-pagos/:periodo')
  @RequirePermission('boleta:read_own')
  @ApiParam(PERIODO_PARAM)
  @ApiOperation({ summary: 'Extensión: desglose propio de un periodo cerrado' })
  miPago(
    @Param('periodo') periodo: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    return this.service.miPago(actor(principal), periodoValido(periodo));
  }

  @Get('periodos/:periodo/novedades')
  @RequirePermission('planilla:calculate')
  @ApiParam(PERIODO_PARAM)
  @ApiOperation({ summary: 'Extensión: novedades registradas del periodo' })
  listarNovedades(@Param('periodo') periodo: string) {
    return this.service.listarNovedades(periodoValido(periodo));
  }

  @Put('periodos/:periodo/novedades/:empleadoId')
  @RequirePermission('planilla:calculate')
  @Audit({ modulo: 'planillas', accion: 'PLANILLA_NOVEDAD_REGISTRAR' })
  @ApiParam(PERIODO_PARAM)
  @ApiOperation({
    summary: 'Extensión: novedades del funcionario, incluido el RC-IVA computable editable',
  })
  @ApiResponse({ status: 409, description: 'PLANILLA_ESTADO_INVALIDO: periodo cerrado' })
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

  // -------------------------------------------------- contrato: planillas

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('planilla:calculate')
  @Audit({ modulo: 'planillas', accion: 'PLANILLA_PROCESAR' })
  @ApiOperation({
    summary: 'Procesar periodo: 202 EN_PROCESO; el resultado (CALCULADA o ERROR) se consulta por GET',
  })
  @ApiResponse({ status: 409, description: 'PLANILLA_PERIODO_DUPLICADO' })
  @ApiResponse({
    status: 422,
    description: 'PLANILLA_PARAMETROS_VIGENTES_FALTANTES o PLANILLA_PERIODO_FUTURO',
  })
  async procesar(
    @Body() dto: ProcesarPlanillaDto,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    return this.responderProceso(await this.service.procesar(dto, actor(principal)));
  }

  @Get()
  @RequirePermission('planilla:read')
  @ApiOperation({ summary: 'Listar planillas' })
  listar(@Query() query: ListarPlanillasQueryDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermission('planilla:read')
  @ApiOperation({ summary: 'Totales y estado de la planilla' })
  obtener(@Param('id', uuidPipe) id: string) {
    return this.service.obtener(id);
  }

  @Get(':id/detalles')
  @RequirePermission('planilla:read')
  @ApiOperation({ summary: 'Detalles paginados por funcionario' })
  detalles(@Param('id', uuidPipe) id: string, @Query() query: DetalleQueryDto) {
    return this.service.listarDetalle(id, query);
  }

  @Get(':id/detalles/:empleadoId')
  @RequireAnyPermission('planilla:read', 'boleta:read_all')
  @ApiOperation({ summary: 'Extensión: desglose de un funcionario (fuente de la boleta, HU-22)' })
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
  @ApiOperation({ summary: 'Cerrar: solo desde CALCULADA; queda inmutable (retención 8 años)' })
  @ApiResponse({ status: 409, description: 'PLANILLA_ESTADO_INVALIDO' })
  async cerrar(
    @Param('id', uuidPipe) id: string,
    @Body() _dto: CerrarPlanillaDto,
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

  @Post(':id/recalcular')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('planilla:calculate')
  @Audit({ modulo: 'planillas', accion: 'PLANILLA_RECALCULAR' })
  @ApiOperation({ summary: 'Extensión: recalcular una planilla no cerrada (202 EN_PROCESO)' })
  @ApiResponse({ status: 409, description: 'PLANILLA_ESTADO_INVALIDO' })
  async recalcular(
    @Param('id', uuidPipe) id: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
  ) {
    return this.responderProceso(await this.service.recalcular(id, actor(principal)));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('planilla:calculate')
  @Audit({ modulo: 'planillas', accion: 'PLANILLA_ELIMINAR' })
  @ApiOperation({ summary: 'Extensión: descartar una planilla no cerrada ni en proceso' })
  @ApiResponse({ status: 409, description: 'PLANILLA_ESTADO_INVALIDO' })
  async eliminar(@Param('id', uuidPipe) id: string): Promise<void> {
    await this.service.eliminar(id);
  }

  /** La respuesta 202 no incluye importes: el interceptor de auditoría guarda el body. */
  private responderProceso(proceso: ProcesoIniciado) {
    this.auditContext.captureAfter(proceso.aceptado);
    return proceso.aceptado;
  }
}
