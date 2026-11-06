import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { UserStatus } from '../../domain/auth/auth.models';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateUserDto {
  @ApiProperty({ example: 'laura.admin' })
  @Transform(trim)
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,100}$/)
  username!: string;

  @ApiPropertyOptional({ example: 'laura@arca.bo' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(200)
  @IsOptional()
  email?: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,200}$/, {
    message: 'password debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo',
  })
  password!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  rolId!: string;

}

export enum UserStatusDto {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  BLOQUEADO = 'BLOQUEADO',
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatusDto })
  @IsEnum(UserStatusDto)
  estado!: UserStatus;
}

export class AssignRoleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  rolId!: string;
}

export class LinkEmployeeDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  empleadoId!: string | null;
}

export class ListPermissionsQueryDto {
  @ApiPropertyOptional({ example: 'personal' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  modulo?: string;
}

export class ListUsersQueryDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: UserStatusDto })
  @IsEnum(UserStatusDto)
  @IsOptional()
  estado?: UserStatus;

  @ApiPropertyOptional({ example: 'ADMIN_GENERAL' })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  rol?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 20;
}
