import { BadRequestException, ValidationPipe } from '@nestjs/common';

/** Pipe global: whitelist estricta y errores con el formato común (docs/api/errores.md). */
export function crearValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: () =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Uno o más campos no son válidos.',
      }),
  });
}
