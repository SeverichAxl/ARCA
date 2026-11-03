import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const nullableUuid = ({ value }: { value: unknown }): unknown => (value === '' ? null : value);

const queryBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
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

export class ListAreasQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @Transform(queryBoolean)
  @IsOptional()
  activa?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Transform(nullableUuid)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID()
  @IsOptional()
  padreId?: string | null;
}

export class AreaTreeQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  raizId?: string;
}

export class CreateAreaDto {
  @ApiProperty({ example: 'Tecnología' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Transform(nullableUuid)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID()
  @IsOptional()
  padreId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Transform(nullableUuid)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID()
  @IsOptional()
  jefeId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}

export class UpdateAreaDto extends PartialType(CreateAreaDto) {}

export class ListCargosQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @Transform(queryBoolean)
  @IsOptional()
  activo?: boolean;
}

export class CreateCargoDto {
  @ApiProperty({ example: 'Analista' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ example: 'Analista de procesos' })
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}

export class UpdateCargoDto extends PartialType(CreateCargoDto) {}
