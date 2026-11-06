import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import type { ArchivoEntrante } from '../../domain/employees/file-validation';

type Constructor<T> = new () => T;

function flattenErrors(
  errors: ValidationError[],
  prefix = '',
  output: Record<string, string> = {},
): Record<string, string> {
  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
      output[path || constraint] = message;
    }
    if (error.children?.length) {
      flattenErrors(error.children, path, output);
    }
  }
  return output;
}

export async function validateDto<T extends object>(
  instance: T,
  options: { whitelist?: boolean; forbidNonWhitelisted?: boolean } = {},
): Promise<T> {
  const errors = await validate(instance, {
    whitelist: options.whitelist ?? true,
    forbidNonWhitelisted: options.forbidNonWhitelisted ?? true,
  });
  if (errors.length > 0) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      details: { fields: flattenErrors(errors) },
    });
  }
  return instance;
}

/** Parsea el campo `datos` de un multipart y aplica class-validator. */
export async function parseMultipartDatos<T extends object>(
  raw: unknown,
  dtoClass: Constructor<T>,
): Promise<T> {
  if (raw === undefined || raw === null || raw === '') {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      details: { fields: { datos: 'El campo datos es obligatorio.' } },
    });
  }
  if (typeof raw !== 'string') {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      details: { fields: { datos: 'El campo datos debe ser un JSON serializado.' } },
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      details: { fields: { datos: 'El campo datos no contiene JSON válido.' } },
    });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      details: { fields: { datos: 'El campo datos debe ser un objeto JSON.' } },
    });
  }

  return validateDto(plainToInstance(dtoClass, parsed, { enableImplicitConversion: false }));
}

/** Convierte un archivo de Multer al contrato mínimo del dominio. */
export function toArchivoEntrante(file: Express.Multer.File): ArchivoEntrante {
  return {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  };
}
