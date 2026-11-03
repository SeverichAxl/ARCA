import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FILE_STORAGE_PORT } from '../../domain/employees/file-storage.port';
import { CloudinaryFileStorage } from './cloudinary-file.storage';
import { LocalFileStorage } from './local-file.storage';
import { LocalFilesController } from './local-files.controller';

@Module({
  controllers: [LocalFilesController],
  providers: [
    LocalFileStorage,
    {
      provide: FILE_STORAGE_PORT,
      inject: [ConfigService, LocalFileStorage],
      useFactory: (
        configService: ConfigService,
        local: LocalFileStorage,
      ) => {
        const driver = (configService.get<string>('STORAGE_DRIVER') ?? 'local').toLowerCase();
        if (driver === 'cloudinary') return new CloudinaryFileStorage(configService);
        if (driver !== 'local') {
          throw new Error('STORAGE_DRIVER debe ser "local" o "cloudinary".');
        }
        return local;
      },
    },
  ],
  exports: [FILE_STORAGE_PORT, LocalFileStorage],
})
export class StorageModule {}
