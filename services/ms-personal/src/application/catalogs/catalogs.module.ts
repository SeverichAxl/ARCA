import { Module } from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import { CATALOG_REPOSITORY } from '../../domain/catalogs/catalog.repository';
import { PrismaCatalogRepository } from '../../infrastructure/prisma/repositories/prisma-catalog.repository';
import { AreasController } from './areas.controller';
import { CargosController } from './cargos.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [AreasController, CargosController],
  providers: [
    CatalogService,
    OutboxService,
    { provide: CATALOG_REPOSITORY, useClass: PrismaCatalogRepository },
  ],
})
export class CatalogsModule {}
