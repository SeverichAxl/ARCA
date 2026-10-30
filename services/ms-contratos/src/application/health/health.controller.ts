import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Estado de salud del servicio' })
  check() {
    return {
      status: 'ok',
      service: 'ms-contratos',
      timestamp: new Date().toISOString(),
    };
  }
}
