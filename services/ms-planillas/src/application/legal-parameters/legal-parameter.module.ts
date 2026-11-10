import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { LegalParameterController } from './legal-parameter.controller';
import { LegalParameterService } from './legal-parameter.service';

@Module({
  imports: [PrismaModule],
  controllers: [LegalParameterController],
  providers: [LegalParameterService],
})
export class LegalParameterModule {}
