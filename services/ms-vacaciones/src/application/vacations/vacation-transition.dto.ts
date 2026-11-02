import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class VacationDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}

export class VacationRejectionDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/)
  @MaxLength(1000)
  motivo!: string;
}

export class ExceptionDecisionDto {
  @IsIn(['APROBADA', 'RECHAZADA'])
  decision!: 'APROBADA' | 'RECHAZADA';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}
