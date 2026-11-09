import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum LegalParameterType {
  SALARIO_MINIMO_NACIONAL = 'SALARIO_MINIMO_NACIONAL',
  APORTE_LABORAL = 'APORTE_LABORAL',
  APORTE_PATRONAL = 'APORTE_PATRONAL',
}

export class CreateLegalParameterDto {
  @ApiProperty({ enum: LegalParameterType })
  @IsEnum(LegalParameterType)
  tipo!: LegalParameterType;

  @ApiProperty({ description: 'Monto en Bs para SMN; porcentaje para aportes', example: 3300 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  valor!: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({ strict: true })
  vigenciaDesde!: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  vigenciaHasta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}

export class UpdateLegalParameterDto extends PartialType(CreateLegalParameterDto) {}

export class LegalParameterQueryDto {
  @ApiPropertyOptional({ enum: LegalParameterType })
  @IsOptional()
  @IsEnum(LegalParameterType)
  tipo?: LegalParameterType;

  @ApiPropertyOptional({
    description: 'Fecha para resolver la versión vigente',
    example: '2026-11-08',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  vigenteEn?: string;
}

export class CreateSeniorityScaleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  aniosDesde!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  aniosHasta?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  porcentaje!: number;

  @IsDateString({ strict: true })
  vigenciaDesde!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  vigenciaHasta?: string;
}

export class UpdateSeniorityScaleDto extends PartialType(CreateSeniorityScaleDto) {}
