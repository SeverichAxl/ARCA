import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ESTADOS_PLANILLA, type EstadoPlanilla } from '../../domain/planillas/planilla.models';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const IMPORTE_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;
export const PERIODO_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const FECHA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IMPORTE_MSG = 'Debe ser un importe decimal no negativo con hasta 2 decimales (string).';

export const SUBSIDIOS_PERMITIDOS = ['prenatal', 'natalidad', 'lactancia', 'sepelio'] as const;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SubsidiosDto {
  @ApiPropertyOptional({ example: '3300.00' })
  @IsOptional()
  @Matches(IMPORTE_PATTERN, { message: IMPORTE_MSG })
  prenatal?: string;

  @ApiPropertyOptional({ example: '3300.00' })
  @IsOptional()
  @Matches(IMPORTE_PATTERN, { message: IMPORTE_MSG })
  natalidad?: string;

  @ApiPropertyOptional({ example: '3300.00' })
  @IsOptional()
  @Matches(IMPORTE_PATTERN, { message: IMPORTE_MSG })
  lactancia?: string;

  @ApiPropertyOptional({ example: '6600.00' })
  @IsOptional()
  @Matches(IMPORTE_PATTERN, { message: IMPORTE_MSG })
  sepelio?: string;
}

/** Variables del mes de un funcionario. Todo campo omitido toma su valor por defecto. */
export class RegistrarNovedadDto {
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 30,
    description: 'Días trabajados (mes comercial). Omitido = según fecha de ingreso.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  diasTrabajados?: number;

  @ApiPropertyOptional({ example: '0.00', description: 'Horas extra, bonos u otros haberes' })
  @IsOptional()
  @Matches(IMPORTE_PATTERN, { message: IMPORTE_MSG })
  otrosIngresos?: string;

  @ApiPropertyOptional({ example: '0.00', description: 'Anticipos, multas u otros descuentos' })
  @IsOptional()
  @Matches(IMPORTE_PATTERN, { message: IMPORTE_MSG })
  otrosDescuentos?: string;

  @ApiPropertyOptional({
    example: '1500.00',
    description:
      'RC-IVA computable editable: monto de facturas presentadas (F-110). Se aplica su 13 %.',
  })
  @IsOptional()
  @Matches(IMPORTE_PATTERN, { message: IMPORTE_MSG })
  rcIvaComputable?: string;

  @ApiPropertyOptional({
    type: SubsidiosDto,
    description: 'Subsidios informativos; no afectan el líquido',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SubsidiosDto)
  subsidios?: SubsidiosDto;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class PaginacionDto {
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

/** Contrato `ProcesarPlanilla` (TSK-ARQ-201). */
export class ProcesarPlanillaDto {
  @ApiProperty({ example: '2026-11' })
  @Matches(PERIODO_PATTERN, { message: 'Debe tener formato YYYY-MM.' })
  periodo!: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description:
      'Informativo; el cálculo usa siempre el último día del periodo como fecha de corte.',
  })
  @IsOptional()
  @Matches(FECHA_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaProceso?: string;

  @ApiPropertyOptional({ example: 'Proceso mensual noviembre', maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class CerrarPlanillaDto {
  @ApiPropertyOptional({ enum: [true] })
  @IsOptional()
  @Equals(true, { message: 'Si se envía, confirmacion debe ser true.' })
  confirmacion?: true;
}

export class ListarPlanillasQueryDto extends PaginacionDto {
  @ApiPropertyOptional({ example: '2026-10' })
  @IsOptional()
  @Matches(PERIODO_PATTERN, { message: 'Debe tener formato YYYY-MM.' })
  periodo?: string;

  @ApiPropertyOptional({ enum: ESTADOS_PLANILLA })
  @IsOptional()
  @IsIn(ESTADOS_PLANILLA)
  estado?: EstadoPlanilla;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Se compara por su periodo (YYYY-MM)',
  })
  @IsOptional()
  @Matches(FECHA_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Se compara por su periodo (YYYY-MM)',
  })
  @IsOptional()
  @Matches(FECHA_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  hasta?: string;
}

export class HistorialQueryDto extends PaginacionDto {
  @ApiPropertyOptional({ example: '2026-10' })
  @IsOptional()
  @Matches(PERIODO_PATTERN, { message: 'Debe tener formato YYYY-MM.' })
  periodo?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @ApiPropertyOptional({ example: 2026, minimum: 2000, maximum: 9999 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  gestion?: number;
}

export class DetalleQueryDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Extensión: filtro por área' })
  @IsOptional()
  @IsUUID()
  areaId?: string;
}

export class KpisQueryDto {
  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Por defecto, la última planilla cerrada',
  })
  @IsOptional()
  @Matches(PERIODO_PATTERN, { message: 'Debe tener formato YYYY-MM.' })
  periodo?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  areaId?: string;
}

export class ParametrosQueryDto {
  @ApiPropertyOptional({ example: '2026-10-31', description: 'Fecha de corte; por defecto hoy' })
  @IsOptional()
  @Matches(FECHA_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fecha?: string;
}
