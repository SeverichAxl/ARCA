import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class CreateVacationRequestDto {
  @ApiProperty({ example: '2026-12-21', format: 'date' })
  @IsDateString({ strict: true })
  fechaInicio!: string;

  @ApiProperty({ example: '2026-12-23', format: 'date' })
  @IsDateString({ strict: true })
  fechaFin!: string;
}
