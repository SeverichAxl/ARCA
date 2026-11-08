import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { ContratoVariable } from '../../domain/templates/template.models';
import { CONTRATO_VARIABLES } from '../../domain/templates/template.models';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const queryBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

const VARIABLES_ENUM = [...CONTRATO_VARIABLES];

export const CONTRATO_HTML_MAX_LENGTH = 200_000;

export class ListPlantillasQueryDto {
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

  @ApiPropertyOptional({ description: 'Filtrar por plantillas activas o inactivas' })
  @Transform(queryBoolean)
  @IsBoolean()
  @IsOptional()
  activa?: boolean;

  @ApiPropertyOptional({ description: 'Texto a buscar en el nombre de la plantilla' })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @IsOptional()
  q?: string;
}

export class CreatePlantillaDto {
  @ApiProperty({ example: 'Contrato indefinido estándar', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre!: string;

  @ApiPropertyOptional({
    example: 'Modelo Ministerio de Trabajo',
    maxLength: 1000,
    nullable: true,
  })
  @Transform(trim)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  descripcion?: string | null;

  @ApiProperty({
    description: 'HTML de la plantilla. Solo se permiten las variables del catálogo HU-17.',
    example:
      '<h1>Contrato</h1><p>Yo {{nombre_empleado}}, CI {{ci}}, cargo {{cargo}}, remuneración {{remuneracion}}, ingreso {{fecha_ingreso}}, prueba {{duracion_prueba}}.</p>',
    maxLength: CONTRATO_HTML_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CONTRATO_HTML_MAX_LENGTH)
  contenidoHtml!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}

export class UpdatePlantillaDto extends PartialType(CreatePlantillaDto) {}

export class PlantillaVersionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ description: 'Contenido HTML saneado de esta versión' })
  contenidoHtml!: string;

  @ApiProperty({
    enum: VARIABLES_ENUM,
    isArray: true,
  })
  variablesDetectadas!: ContratoVariable[];

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;
}

export class PlantillaListadoResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Contrato indefinido estándar' })
  nombre!: string;

  @ApiProperty({ example: 'Modelo Ministerio de Trabajo', nullable: true })
  descripcion!: string | null;

  @ApiProperty({ example: true })
  activa!: boolean;

  @ApiProperty({ example: 1 })
  versionActual!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  actualizadoEn!: Date;
}

export class PaginationMetaResponseDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PlantillaListadoPageResponseDto {
  @ApiProperty({ type: () => [PlantillaListadoResponseDto] })
  data!: PlantillaListadoResponseDto[];

  @ApiProperty({ type: () => PaginationMetaResponseDto })
  meta!: PaginationMetaResponseDto;
}

export class PlantillaCreadaResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Contrato indefinido estándar' })
  nombre!: string;

  @ApiProperty({ example: 'Modelo Ministerio de Trabajo', nullable: true })
  descripcion!: string | null;

  @ApiProperty({
    enum: VARIABLES_ENUM,
    isArray: true,
  })
  variablesDetectadas!: ContratoVariable[];

  @ApiProperty({ example: true })
  activa!: boolean;

  @ApiProperty({ example: 1 })
  versionActual!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;
}

export class PlantillaDetalleResponseDto extends PlantillaListadoResponseDto {
  @ApiProperty({ description: 'Contenido HTML saneado de la versión vigente' })
  contenidoHtml!: string;

  @ApiProperty({
    enum: VARIABLES_ENUM,
    isArray: true,
  })
  variablesDetectadas!: ContratoVariable[];

  @ApiProperty({ type: () => [PlantillaVersionResponseDto] })
  versiones!: PlantillaVersionResponseDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;
}
