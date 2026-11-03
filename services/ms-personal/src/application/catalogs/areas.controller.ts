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
import { AreaTreeQueryDto, CreateAreaDto, ListAreasQueryDto, UpdateAreaDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('areas')
@ApiBearerAuth()
@RequirePermission('catalogo:manage')
@Controller('areas')
export class AreasController {
  constructor(private readonly service: CatalogService) {}

  @Get('tree')
  @RequirePermission('organigrama:read')
  @ApiOperation({ summary: 'Consultar la jerarquía de áreas' })
  tree(@Query() query: AreaTreeQueryDto) {
    return this.service.getAreaTree(query);
  }

  @Get()
  @ApiOperation({ summary: 'Listar áreas' })
  list(@Query() query: ListAreasQueryDto) {
    return this.service.listAreas(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un área' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getArea(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un área' })
  create(@Body() dto: CreateAreaDto) {
    return this.service.createArea(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un área' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAreaDto) {
    return this.service.updateArea(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Eliminar un área sin funcionarios ni subáreas' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteArea(id);
  }
}
