import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum HolidayScope {
  NACIONAL = 'NACIONAL',
  DEPARTAMENTAL = 'DEPARTAMENTAL',
}

export class CreateHolidayDto {
  @IsDateString({ strict: true }) @ApiProperty({ example: '2026-12-25' }) fecha!: string;
  @IsString() @MaxLength(150) nombre!: string;
  @IsEnum(HolidayScope) ambito!: HolidayScope;
  @IsOptional() @IsString() @MaxLength(80) departamento?: string;
}

export class UpdateHolidayDto {
  @IsOptional() @IsDateString({ strict: true }) fecha?: string;
  @IsOptional() @IsString() @MaxLength(150) nombre?: string;
  @IsOptional() @IsEnum(HolidayScope) ambito?: HolidayScope;
  @IsOptional() @IsString() @MaxLength(80) departamento?: string;
}

export class UpdateVacationConfigurationDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 2, default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxGestionesAcumuladas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) diasEscalaInicial?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) diasEscalaMedia?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) diasEscalaMayor?: number;
}
