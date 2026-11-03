import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '@arca/audit';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AssignRoleDto,
  CreateUserDto,
  LinkEmployeeDto,
  ListUsersQueryDto,
  UpdateUserStatusDto,
} from './user.dto';
import { UserService } from './user.service';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('auth/usuarios')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Post()
  @RequirePermission('usuario:create', 'usuario:assign_role')
  @Audit({ modulo: 'auth', accion: 'USUARIO_CREAR' })
  @ApiOperation({ summary: 'Crear usuario' })
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermission('usuario:read')
  @ApiOperation({ summary: 'Listar usuarios' })
  list(@Query() query: ListUsersQueryDto) {
    return this.service.list(query);
  }

  @Patch(':id/estado')
  @RequirePermission('usuario:update')
  @Audit({ modulo: 'auth', accion: 'USUARIO_CAMBIAR_ESTADO' })
  @ApiOperation({ summary: 'Activar, inactivar o bloquear manualmente un usuario' })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Post(':id/desbloquear')
  @RequirePermission('usuario:update')
  @Audit({ modulo: 'auth', accion: 'USUARIO_DESBLOQUEAR' })
  @ApiOperation({ summary: 'Desbloquear manualmente un usuario' })
  unlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.unlock(id);
  }

  @Put(':id/rol')
  @RequirePermission('usuario:assign_role')
  @Audit({ modulo: 'auth', accion: 'USUARIO_ASIGNAR_ROL' })
  @ApiOperation({ summary: 'Asignar un rol existente' })
  assignRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRoleDto) {
    return this.service.assignRole(id, dto);
  }

  @Put(':id/empleado')
  @RequirePermission('usuario:update')
  @Audit({ modulo: 'auth', accion: 'USUARIO_VINCULAR_EMPLEADO' })
  @ApiOperation({ summary: 'Vincular o desvincular un funcionario' })
  linkEmployee(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkEmployeeDto) {
    return this.service.linkEmployee(id, dto);
  }
}
