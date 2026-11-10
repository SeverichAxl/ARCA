import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '@arca/internal-auth';
import type { Response } from 'express';
import {
  PlanillaExportService,
  type ExportFormat,
  type ExportFile,
} from './planilla-export.service';

@ApiTags('exportaciones')
@ApiBearerAuth()
@Controller('planillas')
export class PlanillaExportController {
  constructor(private readonly service: PlanillaExportService) {}

  @Get(':id/exportar')
  @RequirePermission('export:data')
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOperation({ summary: 'Exportar el detalle real de una planilla en CSV o XLSX' })
  async exportar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') rawFormat: string,
    @Query('areaId') areaId: string | undefined,
    @Res() response: Response,
  ) {
    const format = rawFormat?.toLowerCase();
    if (format !== 'csv' && format !== 'xlsx')
      throw new BadRequestException('format debe ser csv o xlsx.');
    this.send(response, await this.service.exportar(id, format as ExportFormat, areaId));
  }

  private send(response: Response, file: ExportFile): void {
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.bytes);
  }
}
