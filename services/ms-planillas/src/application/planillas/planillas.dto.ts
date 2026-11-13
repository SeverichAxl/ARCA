import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
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

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  pageSize = 20;
}

export class ListarPlanillasQueryDto extends PaginacionDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio?: number;

  @ApiPropertyOptional({ enum: ['BORRADOR', 'CERRADA'] })
  @IsOptional()
  @IsIn(['BORRADOR', 'CERRADA'])
  estado?: 'BORRADOR' | 'CERRADA';

  @ApiPropertyOptional({ example: '2026-01', description: 'Periodo inicial (YYYY-MM), inclusive' })
  @IsOptional()
  @Matches(PERIODO_PATTERN, { message: 'Debe tener formato YYYY-MM.' })
  desde?: string;

  @ApiPropertyOptional({ example: '2026-12', description: 'Periodo final (YYYY-MM), inclusive' })
  @IsOptional()
  @Matches(PERIODO_PATTERN, { message: 'Debe tener formato YYYY-MM.' })
  hasta?: string;
}

export class DetalleQueryDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  empleadoId?: string;
}

export class ResumenQueryDto {
  @ApiProperty({ example: '2026-01' })
  @Matches(PERIODO_PATTERN, { message: 'Debe tener formato YYYY-MM.' })
  desde!: string;

  @ApiProperty({ example: '2026-12' })
  @Matches(PERIODO_PATTERN, { message: 'Debe tener formato YYYY-MM.' })
  hasta!: string;
}

export class ParametrosQueryDto {
  @ApiPropertyOptional({ example: '2026-10-31', description: 'Fecha de corte; por defecto hoy' })
  @IsOptional()
  @Matches(FECHA_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fecha?: string;
}
