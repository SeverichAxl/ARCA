import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { CONTRATO_VARIABLES, type ContratoVariable } from '../../domain/templates/template.models';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VARIABLES_ENUM = [...CONTRATO_VARIABLES];
const ESTADOS = ['BORRADOR', 'GENERADO', 'EMITIDO', 'ANULADO'];

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class PreviewContratoDto {
  @ApiProperty({ format: 'uuid', description: 'Plantilla de contrato a utilizar' })
  @IsUUID()
  plantillaId!: string;

  @ApiProperty({ format: 'uuid', description: 'Empleado cuyos datos se inyectan' })
  @IsUUID()
  empleadoId!: string;
}

export class GenerarPdfDatosDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Incluye las firmas previamente registradas en la nueva versión.',
  })
  @IsOptional()
  @IsBoolean()
  incluirFirmas?: boolean;
}

export class CreateContratoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  plantillaId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  empleadoId!: string;

  @ApiPropertyOptional({
    example: '2026-01-15',
    description: 'Fecha de inicio contractual (YYYY-MM-DD).',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'Debe tener formato YYYY-MM-DD.' })
  fechaInicio?: string;

  @ApiPropertyOptional({ example: 'Contrato indefinido con periodo de prueba.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  observacion?: string;
}

export class ContratoCreadoResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  empleadoId!: string;

  @ApiProperty({ format: 'uuid' })
  plantillaId!: string;

  @ApiProperty({ example: 1, description: 'Versión de plantilla utilizada' })
  plantillaVersion!: number;

  @ApiProperty({ enum: ESTADOS, example: 'BORRADOR' })
  estado!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  creadoEn!: Date;
}

export class PreviewContratoResponseDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'null en la vista previa efímera; ID del contrato en la vista de un contrato guardado.',
  })
  contratoId!: string | null;

  @ApiProperty({ format: 'uuid' })
  empleadoId!: string;

  @ApiProperty({ format: 'uuid' })
  plantillaId!: string;

  @ApiProperty({ example: 1 })
  plantillaVersion!: number;

  @ApiProperty({ description: 'HTML interpolado; no se persiste en la vista efímera.' })
  htmlPreview!: string;

  @ApiProperty({ enum: VARIABLES_ENUM, isArray: true })
  variablesResueltas!: ContratoVariable[];

  @ApiProperty({ enum: VARIABLES_ENUM, isArray: true })
  camposFaltantes!: ContratoVariable[];

  @ApiProperty({ type: [String] })
  advertencias!: string[];
}

export class DocumentoGeneradoResponseDto {
  @ApiProperty({ format: 'uuid' })
  contratoId!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ format: 'uuid' })
  versionId!: string;

  @ApiProperty({ enum: ESTADOS })
  estado!: string;

  @ApiProperty({
    type: 'object',
    properties: {
      publicIdRef: { type: 'string' },
      versionId: { type: 'string', format: 'uuid' },
      hashSha256: { type: 'string' },
      bytes: { type: 'number' },
      mime: { type: 'string', example: 'application/pdf' },
      creadoEn: { type: 'string', format: 'date-time' },
    },
  })
  documento!: {
    publicIdRef: string;
    versionId: string;
    hashSha256: string;
    bytes: number;
    mime: string;
    creadoEn: Date;
  };

  @ApiProperty()
  firmadoTrabajador!: boolean;

  @ApiProperty()
  firmadoRepresentante!: boolean;

  @ApiProperty({ enum: VARIABLES_ENUM, isArray: true })
  camposFaltantes!: ContratoVariable[];

  @ApiProperty({ type: [String] })
  advertencias!: string[];
}

export class DescargaContratoResponseDto {
  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiProperty({ example: 300 })
  expiresInSeconds!: number;

  @ApiProperty({ format: 'uuid' })
  versionId!: string;
}
