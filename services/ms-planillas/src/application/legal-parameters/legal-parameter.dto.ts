import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export enum LegalParameterType {
  SMN = 'SMN',
  APORTE_LABORAL = 'APORTE_LABORAL',
  APORTE_PATRONAL = 'APORTE_PATRONAL',
  BONO_ANTIGUEDAD = 'BONO_ANTIGUEDAD',
  RC_IVA = 'RC_IVA',
  OTRO = 'OTRO',
}

export class CreateLegalParameterDto {
  @ApiProperty({ enum: LegalParameterType }) @IsEnum(LegalParameterType) tipo!: LegalParameterType;
  @ApiProperty({ example: 'SMN_NACIONAL' })
  @IsString()
  @Matches(/^[A-Z0-9_]{3,80}$/)
  clave!: string;
  @ApiProperty({ example: 3300 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  valor!: number;
  @ApiPropertyOptional({ example: 'BOB' }) @IsOptional() @IsString() @MaxLength(20) unidad?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @ApiProperty({ example: '2026-01-01' }) @IsDateString({ strict: true }) vigenteDesde!: string;
  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  vigenteHasta?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() activo?: boolean;
}

export class UpdateLegalParameterDto {
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) valor?: number;
  @IsOptional() @IsString() @MaxLength(20) unidad?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsDateString({ strict: true }) vigenteHasta?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class LegalParameterQueryDto {
  @ApiPropertyOptional({ enum: LegalParameterType })
  @IsOptional()
  @IsEnum(LegalParameterType)
  tipo?: LegalParameterType;
  @IsOptional() @IsDateString({ strict: true }) vigenteEn?: string;
}
