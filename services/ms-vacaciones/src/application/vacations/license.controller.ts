import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentPrincipal, RequireAnyPermission } from '@arca/internal-auth';
import type { InternalPrincipal } from '@arca/internal-auth';
import { LicenseQueryDto } from './license-query.dto';
import { VacationLicenseService } from './license.service';

@ApiTags('licencias')
@ApiBearerAuth()
@Controller('vacaciones/empleados/:empleadoId/licencias')
export class LicenseController {
  constructor(private readonly licenses: VacationLicenseService) {}

  @Get()
  @RequireAnyPermission('licencias:read', 'licencias:manage')
  @ApiOperation({ summary: 'Listar licencias de un funcionario' })
  @ApiOkResponse()
  list(
    @Param('empleadoId', new ParseUUIDPipe()) empleadoId: string,
    @CurrentPrincipal() principal: InternalPrincipal | undefined,
    @Query() query: LicenseQueryDto,
  ) {
    if (!principal) {
      throw new ForbiddenException('No se pudo identificar al usuario autenticado.');
    }
    return this.licenses.listForEmployee(empleadoId, principal, query);
  }
}
