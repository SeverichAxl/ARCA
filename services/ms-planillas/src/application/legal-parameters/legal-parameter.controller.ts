import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, type InternalPrincipal, RequirePermission } from '@arca/internal-auth';
import {
  CreateLegalParameterDto,
  LegalParameterQueryDto,
  UpdateLegalParameterDto,
} from './legal-parameter.dto';
import { LegalParameterService } from './legal-parameter.service';

@ApiTags('Parámetros legales')
@ApiBearerAuth()
@Controller('planillas/parametros')
export class LegalParameterController {
  constructor(private readonly service: LegalParameterService) {}

  @Get()
  @RequirePermission('parametros_ley:update')
  @ApiOperation({ summary: 'Lista el histórico o resuelve parámetros vigentes' })
  list(@Query() query: LegalParameterQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @RequirePermission('parametros_ley:update')
  create(@Body() dto: CreateLegalParameterDto, @CurrentPrincipal() principal: InternalPrincipal) {
    return this.service.create(dto, principal);
  }

  @Patch(':id')
  @RequirePermission('parametros_ley:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLegalParameterDto,
    @CurrentPrincipal() principal: InternalPrincipal,
  ) {
    return this.service.update(id, dto, principal);
  }
}
