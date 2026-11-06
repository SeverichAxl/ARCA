import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class VacationCommentDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}

export class RejectVacationDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo!: string;
}

export class CreateVacationExceptionDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  justificacion!: string;
}

export class ResolveVacationExceptionDto {
  @ApiProperty({ enum: ['APROBADA', 'RECHAZADA'] })
  @IsIn(['APROBADA', 'RECHAZADA'])
  decision!: 'APROBADA' | 'RECHAZADA';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}
