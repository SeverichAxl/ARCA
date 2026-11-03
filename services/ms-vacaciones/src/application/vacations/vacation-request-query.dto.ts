import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoSolicitud } from '../../../prisma/generated/client';

export class VacationRequestQueryDto {
  @ApiProperty({ enum: ['propias', 'bandeja-jefe', 'bandeja-rrhh'] })
  @IsIn(['propias', 'bandeja-jefe', 'bandeja-rrhh'])
  vista!: 'propias' | 'bandeja-jefe' | 'bandeja-rrhh';

  @ApiPropertyOptional({ enum: EstadoSolicitud })
  @IsOptional()
  @IsEnum(EstadoSolicitud)
  estado?: EstadoSolicitud;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  desde?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  hasta?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 20;
}

export class CancelVacationRequestDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
