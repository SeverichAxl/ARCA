import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DOCUMENT_STORAGE } from '../../domain/ports/document-storage.port';
import { CloudinaryStorageAdapter } from './cloudinary-storage.adapter';
import { FakeStorageAdapter } from './fake-storage.adapter';

@Module({
  providers: [
    {
      provide: DOCUMENT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('STORAGE_DRIVER') ?? 'cloudinary';
        if (driver === 'fake') {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('STORAGE_DRIVER=fake no está permitido en producción.');
          }
          new Logger('StorageModule').warn('Usando almacenamiento FAKE en memoria (no usar en demo final).');
          return new FakeStorageAdapter();
        }
        return new CloudinaryStorageAdapter(config);
      },
    },
  ],
  exports: [DOCUMENT_STORAGE],
})
export class StorageModule {}
