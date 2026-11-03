import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { EstadoEmpleado } from '../../domain/employees/employee.models';
import type { TipoInamovilidad } from '../../domain/employees/inamovilidad';

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MONEY_PATTERN = /^\d{1,13}(?:\.\d{1,2})?$/;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const toMoneyString = ({ value }: { value: unknown }): unknown => {
  return typeof value === 'string' ? value.trim() : value;
};

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 20;
}

export class InamovilidadDatosDto {
  @ApiProperty({ enum: ['GESTACION', 'PROGENITOR', 'DISCAPACIDAD', 'TUTOR_DISCAPACIDAD'] })
  @IsEnum(['GESTACION', 'PROGENITOR', 'DISCAPACIDAD', 'TUTOR_DISCAPACIDAD'])
  tipo!: TipoInamovilidad;

  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaInicio!: string;

  @ApiPropertyOptional({ example: '2027-10-01' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaFin?: string;

  @ApiPropertyOptional({ example: 'Reposo prenatal' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class CreateEmployeeDatosDto {
  @ApiProperty({ example: 'Ana María' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres!: string;

  @ApiProperty({ example: 'Rojas Pérez' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellidos!: string;

  @ApiProperty({ example: '12345678' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  ci!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  areaId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cargoId!: string;

  @ApiProperty({ example: '6000.00' })
  @Transform(toMoneyString)
  @Matches(MONEY_PATTERN, { message: 'Debe ser un importe no negativo con hasta 2 decimales.' })
  remuneracion!: string;

  @ApiProperty({ example: '2026-01-15' })
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaIngreso!: string;

  @ApiPropertyOptional({ example: 'LP' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  ciExpedido?: string;

  @ApiPropertyOptional({ example: '1990-05-20' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaNacimiento?: string;

  @ApiPropertyOptional({ default: false })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  esExtranjero?: boolean;

  @ApiPropertyOptional({ example: 'ana.rojas@arca.local' })
  @Transform(trim)
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: '70000000' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @ApiPropertyOptional({ example: 'Av. Arce 1234' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string;

  @ApiPropertyOptional({ default: 90, minimum: 0, maximum: 90 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  diasPrueba?: number;

  @ApiPropertyOptional({ type: InamovilidadDatosDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InamovilidadDatosDto)
  inamovilidad?: InamovilidadDatosDto;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cargoId?: string;

  @ApiPropertyOptional({ example: '6500.00' })
  @Transform(toMoneyString)
  @IsOptional()
  @Matches(MONEY_PATTERN, { message: 'Debe ser un importe no negativo con hasta 2 decimales.' })
  remuneracion?: string;

  @ApiProperty({ example: '2026-11-01' })
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaEfectiva!: string;

  @ApiProperty({ example: 'Ajuste por evaluación de desempeño' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}

export class RatifyEmployeeDto {
  @ApiProperty({ example: '2026-11-03' })
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaRatificacion!: string;

  @ApiPropertyOptional({ example: 'Cumplió el periodo de prueba' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class ListEmployeesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Texto a buscar en nombres y apellidos' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ description: 'CI exacta' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ci?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cargoId?: string;

  @ApiPropertyOptional({ enum: ['EN_PRUEBA', 'RATIFICADO', 'INACTIVO'] })
  @IsOptional()
  @IsEnum(['EN_PRUEBA', 'RATIFICADO', 'INACTIVO'])
  estado?: EstadoEmpleado;

  @ApiPropertyOptional({ description: 'true=tiene inamovilidad activa; false=no tiene' })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  inamovilidad?: boolean;
}

export class HistorialQueryDto extends PaginationQueryDto {}

export class BajaDatosDto {
  @ApiProperty({ example: '2026-11-30' })
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaBaja!: string;

  @ApiProperty({ example: 'Renuncia voluntaria' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;

  @ApiPropertyOptional({ default: false })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  aplicaDesahucio?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  diasVacacionesPendientes?: number;

}

export class SimularBajaDto {
  @ApiProperty({ example: '2026-11-30' })
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaBaja!: string;

  @ApiPropertyOptional({ default: false })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  aplicaDesahucio?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  diasVacacionesPendientes?: number;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class CreateInamovilidadDto {
  @ApiProperty({ enum: ['GESTACION', 'PROGENITOR', 'DISCAPACIDAD', 'TUTOR_DISCAPACIDAD'] })
  @IsEnum(['GESTACION', 'PROGENITOR', 'DISCAPACIDAD', 'TUTOR_DISCAPACIDAD'])
  tipo!: TipoInamovilidad;

  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaInicio!: string;

  @ApiPropertyOptional({ example: '2027-10-01' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaFin?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class CerrarInamovilidadDto {
  @ApiProperty({ example: '2026-11-15' })
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaFin!: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
