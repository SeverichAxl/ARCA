import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  CurrentPrincipal,
  RequireAnyPermission,
  RequirePermission,
  type InternalPrincipal,
} from '@arca/internal-auth';
import type { Response } from 'express';
import { BoletaService, type BoletaDocument } from './boleta.service';

@ApiTags('boletas')
@ApiBearerAuth()
@Controller('planillas/boletas')
export class BoletaController {
  constructor(private readonly service: BoletaService) {}

  @Get('mias/:periodo/pdf')
  @RequirePermission('boleta:read_own')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Descargar la boleta propia de una planilla cerrada' })
  async propia(
    @Param('periodo') periodo: string,
    @CurrentPrincipal() principal: InternalPrincipal,
    @Res() response: Response,
  ) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo))
      throw new BadRequestException('Periodo inválido.');
    this.send(response, await this.service.descargarPropia(periodo, principal));
  }

  @Get(':planillaId/empleados/:empleadoId/pdf')
  @RequireAnyPermission('boleta:read_all', 'boleta:read_own')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Descargar una boleta individual de una planilla cerrada' })
  async descargar(
    @Param('planillaId', ParseUUIDPipe) planillaId: string,
    @Param('empleadoId', ParseUUIDPipe) empleadoId: string,
    @CurrentPrincipal() principal: InternalPrincipal,
    @Res() response: Response,
  ) {
    this.send(response, await this.service.descargar(planillaId, empleadoId, principal));
  }

  @Post('verificar')
  @RequireAnyPermission('boleta:read_all', 'boleta:read_own')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Verificar por SHA-256 que un PDF emitido no fue alterado' })
  verificar(@UploadedFile() file?: Express.Multer.File) {
    if (!file || file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Debe adjuntar un archivo PDF válido.');
    }
    return this.service.verificar(file.buffer);
  }

  private send(response: Response, document: BoletaDocument): void {
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    response.setHeader('X-Document-SHA256', document.hashSha256);
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(document.bytes);
  }
}
