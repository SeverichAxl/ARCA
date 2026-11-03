import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FECHA_RE } from '../../../common/validation/validacion';

export const TIPOS_INAMOVILIDAD = ['GESTACION', 'PROGENITOR', 'DISCAPACIDAD', 'TUTOR_DISCAPACIDAD'] as const;
export const ESTADOS_EMPLEADO = ['EN_PRUEBA', 'RATIFICADO', 'INACTIVO'] as const;
const DEPARTAMENTOS = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BE', 'PD'];
const MSG_FECHA = 'Debe tener el formato YYYY-MM-DD.';
const MONTO_MAX = 10_000_000;

export class InamovilidadDto {
  @IsIn(TIPOS_INAMOVILIDAD)
  tipo: (typeof TIPOS_INAMOVILIDAD)[number];

  @Matches(FECHA_RE, { message: MSG_FECHA })
  fechaInicio: string;

  @IsOptional()
  @Matches(FECHA_RE, { message: MSG_FECHA })
  fechaFin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class CreateEmpleadoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombres: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellidos: string;

  @IsString()
  @Matches(/^\s*\d{4,10}(-[0-9A-Za-z]{1,2})?\s*$/, {
    message: 'CI inválida (ej. 1234567 o 1234567-1B).',
  })
  ci: string;

  @IsUUID('all')
  areaId: string;

  @IsUUID('all')
  cargoId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MONTO_MAX)
  remuneracion: number;

  @Matches(FECHA_RE, { message: MSG_FECHA })
  fechaIngreso: string;

  @IsOptional()
  @IsIn(DEPARTAMENTOS)
  ciExpedido?: string;

  @IsOptional()
  @Matches(FECHA_RE, { message: MSG_FECHA })
  fechaNacimiento?: string;

  @IsOptional()
  @IsBoolean()
  esExtranjero?: boolean;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s]{6,20}$/, { message: 'Teléfono inválido.' })
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  diasPrueba?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => InamovilidadDto)
  inamovilidad?: InamovilidadDto;
}

export class UpdateEmpleadoDto {
  @IsOptional()
  @IsUUID('all')
  areaId?: string;

  @IsOptional()
  @IsUUID('all')
  cargoId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MONTO_MAX)
  remuneracion?: number;

  @Matches(FECHA_RE, { message: MSG_FECHA })
  fechaEfectiva: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}

export class RatificarDto {
  @Matches(FECHA_RE, { message: MSG_FECHA })
  fechaRatificacion: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class BajaDto {
  @Matches(FECHA_RE, { message: MSG_FECHA })
  fechaBaja: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;

  @IsBoolean()
  aplicaDesahucio: boolean;

  /** Días de vacación pendientes (los informa ms-vacaciones / el frontend). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(120)
  diasVacacionPendientes?: number;

  /** Últimos 1..3 sueldos para el SPI. Si se omite, se usa el haber básico. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsNumber({ maxDecimalPlaces: 2 }, { each: true })
  @Min(0, { each: true })
  @Max(MONTO_MAX, { each: true })
  sueldosUltimosMeses?: number[];
}

export class CerrarInamovilidadDto {
  @Matches(FECHA_RE, { message: MSG_FECHA })
  fechaFin: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

const aBooleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class PaginacionQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class ListEmpleadosQuery extends PaginacionQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ci?: string;

  @IsOptional()
  @IsUUID('all')
  areaId?: string;

  @IsOptional()
  @IsUUID('all')
  cargoId?: string;

  @IsOptional()
  @IsEnum(Object.fromEntries(ESTADOS_EMPLEADO.map((e) => [e, e])))
  estado?: (typeof ESTADOS_EMPLEADO)[number];

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  inamovilidad?: boolean;
}
