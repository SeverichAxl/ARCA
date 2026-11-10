import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import type { ArchivoFirmaEntrante } from '../../domain/contracts/firma-validation';

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

/**
 * Parsea el campo opcional `datos` de un multipart. Si no se envía, devuelve
 * el valor por defecto del endpoint (p. ej. `{ incluirFirmas: true }`).
 */
export async function parseOptionalDatos<T extends object>(
  raw: unknown,
  dtoClass: Constructor<T>,
  fallback: T,
): Promise<T> {
  if (raw === undefined || raw === null || raw === '') return fallback;

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Uno o más campos no son válidos.',
        details: { fields: { datos: 'El campo datos no contiene JSON válido.' } },
      });
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      details: { fields: { datos: 'El campo datos debe ser un objeto JSON.' } },
    });
  }

  return validateDto(
    plainToInstance(dtoClass, parsed, { enableImplicitConversion: false }),
  );
}

/** Convierte un archivo de Multer al mínimo del dominio de firmas. */
export function toArchivoFirma(file: Express.Multer.File): ArchivoFirmaEntrante {
  return {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  };
}
