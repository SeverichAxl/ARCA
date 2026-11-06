import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ListAuditQueryDto } from './audit.dto';
import { AuditService } from './audit.service';

@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('auth/auditoria')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @RequirePermission('auditoria:read')
  @ApiOperation({ summary: 'Consultar el registro inmutable de auditoría' })
  list(@Query() query: ListAuditQueryDto) {
    return this.service.list(query);
  }
}
