import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { LocalFileStorage } from './local-file.storage';

/**
 * Servidor de archivos del adaptador local. No está expuesto por el gateway:
 * el acceso se autoriza con la firma HMAC de corta duración incluida en la URL.
 */
@ApiExcludeController()
@Controller('files')
export class LocalFilesController {
  constructor(private readonly storage: LocalFileStorage) {}

  @Public()
  @Get(':publicId')
  async read(
    @Param('publicId') publicId: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
  ): Promise<StreamableFile> {
    const file = await this.storage.readSigned(publicId, expires, signature);
    if (!file) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Archivo no encontrado.' });
    return new StreamableFile(file.buffer, {
      type: file.contentType,
      disposition: 'inline',
      length: file.buffer.length,
    });
  }
}
