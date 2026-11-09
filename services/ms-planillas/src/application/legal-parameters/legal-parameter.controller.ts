import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, type InternalPrincipal, RequirePermission } from '@arca/internal-auth';
import {
  CreateLegalParameterDto,
  CreateSeniorityScaleDto,
  LegalParameterQueryDto,
  UpdateLegalParameterDto,
  UpdateSeniorityScaleDto,
} from './legal-parameter.dto';
import { LegalParameterService } from './legal-parameter.service';

@ApiTags('Parámetros legales')
@ApiBearerAuth()
@Controller('planillas/parametros-legales')
export class LegalParameterController {
  constructor(private readonly service: LegalParameterService) {}
  @Get()
  @RequirePermission('parametros_ley:update')
  @ApiOperation({ summary: 'Lista el histórico o resuelve valores vigentes' })
  list(@Query() query: LegalParameterQueryDto) {
    return this.service.list(query);
  }
  @Get(':id') @RequirePermission('parametros_ley:update') find(@Param('id') id: string) {
    return this.service.find(id);
  }
  @Post() @RequirePermission('parametros_ley:update') create(
    @Body() dto: CreateLegalParameterDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.create(dto, principal);
  }
  @Patch(':id') @RequirePermission('parametros_ley:update') update(
    @Param('id') id: string,
    @Body() dto: UpdateLegalParameterDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.update(id, dto, principal);
  }
  @Delete(':id') @HttpCode(204) @RequirePermission('parametros_ley:update') remove(
    @Param('id') id: string,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.remove(id, principal);
  }
}

@ApiTags('Escalas bono de antigüedad')
@ApiBearerAuth()
@Controller('planillas/escalas-antiguedad')
export class SeniorityScaleController {
  constructor(private readonly service: LegalParameterService) {}
  @Get() @RequirePermission('parametros_ley:update') list() {
    return this.service.listScales();
  }
  @Post() @RequirePermission('parametros_ley:update') create(
    @Body() dto: CreateSeniorityScaleDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.createScale(dto, principal);
  }
  @Patch(':id') @RequirePermission('parametros_ley:update') update(
    @Param('id') id: string,
    @Body() dto: UpdateSeniorityScaleDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.updateScale(id, dto, principal);
  }
  @Delete(':id') @HttpCode(204) @RequirePermission('parametros_ley:update') remove(
    @Param('id') id: string,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.removeScale(id, principal);
  }
}
