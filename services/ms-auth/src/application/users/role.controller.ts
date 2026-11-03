import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { UserService } from './user.service';
import { ListPermissionsQueryDto } from './user.dto';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('auth')
export class RoleController {
  constructor(private readonly service: UserService) {}

  @Get('roles')
  @RequirePermission('usuario:assign_role')
  @ApiOperation({ summary: 'Listar roles y permisos existentes' })
  list() {
    return this.service.listRoles();
  }

  @Get('permisos')
  @RequirePermission('usuario:assign_role')
  @ApiOperation({ summary: 'Listar permisos existentes' })
  listPermissions(@Query() query: ListPermissionsQueryDto) {
    return this.service.listPermissions(query);
  }
}
