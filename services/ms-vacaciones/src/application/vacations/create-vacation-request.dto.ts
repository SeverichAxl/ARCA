import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class CreateVacationRequestDto {
  @ApiProperty({ example: '2026-12-21', format: 'date' })
  @IsDateString({ strict: true })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-23', format: 'date' })
  @IsDateString({ strict: true })
  fechaFin!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  solicitarExcepcion?: boolean;

  @ApiPropertyOptional({ maxLength: 1000 })
  @ValidateIf((input: CreateVacationRequestDto) => input.solicitarExcepcion === true)
  @IsString()
  @MaxLength(1000)
  justificacionExcepcion?: string;
}
