import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateVacationRequestDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Debe ser una fecha válida con formato YYYY-MM-DD.',
  })
  fechaInicio!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Debe ser una fecha válida con formato YYYY-MM-DD.',
  })
  fechaFin!: string;

  @IsOptional()
  @IsBoolean()
  solicitarExcepcion?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  justificacionExcepcion?: string;
}
