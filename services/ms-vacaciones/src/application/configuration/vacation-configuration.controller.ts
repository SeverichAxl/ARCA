import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '@arca/internal-auth';
import {
  CreateHolidayDto,
  UpdateHolidayDto,
  UpdateVacationConfigurationDto,
} from './vacation-configuration.dto';
import { VacationConfigurationService } from './vacation-configuration.service';

@ApiTags('Configuración de vacaciones')
@ApiBearerAuth()
@Controller('vacaciones')
export class VacationConfigurationController {
  constructor(private readonly service: VacationConfigurationService) {}
  @Get('feriados') @RequirePermission('vacaciones:config') holidays(
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
    return this.service.listHolidays(year);
  }
  @Post('feriados') @RequirePermission('vacaciones:config') create(@Body() dto: CreateHolidayDto) {
    return this.service.createHoliday(dto);
  }
  @Patch('feriados/:id') @RequirePermission('vacaciones:config') update(
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.service.updateHoliday(id, dto);
  }
  @Delete('feriados/:id') @HttpCode(204) @RequirePermission('vacaciones:config') remove(
    @Param('id') id: string,
  ) {
    return this.service.removeHoliday(id);
  }
  @Get('configuracion') @RequirePermission('vacaciones:config') policy() {
    return this.service.getPolicy();
  }
  @Patch('configuracion') @RequirePermission('vacaciones:config') updatePolicy(
    @Body() dto: UpdateVacationConfigurationDto,
  ) {
    return this.service.updatePolicy(dto);
  }
}
