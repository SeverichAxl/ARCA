import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateCargoDto, ListCargosQueryDto, UpdateCargoDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('cargos')
@ApiBearerAuth()
@RequirePermission('catalogo:manage')
@Controller('cargos')
export class CargosController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cargos' })
  list(@Query() query: ListCargosQueryDto) {
    return this.service.listCargos(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un cargo' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getCargo(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un cargo' })
  create(@Body() dto: CreateCargoDto) {
    return this.service.createCargo(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un cargo' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCargoDto) {
    return this.service.updateCargo(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Eliminar un cargo sin funcionarios asignados' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteCargo(id);
  }
}
