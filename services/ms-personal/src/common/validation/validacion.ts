import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { Errores } from '../../domain/errors/domain.error';
import { parseFecha } from '../../domain/empleado/fechas';

export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function aplanarErrores(errores: ValidationError[], prefijo = ''): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const error of errores) {
    const ruta = prefijo ? `${prefijo}.${error.property}` : error.property;
    if (error.constraints) {
      resultado[ruta] = Object.values(error.constraints)[0];
    }
    if (error.children?.length) {
      Object.assign(resultado, aplanarErrores(error.children, ruta));
    }
  }
  return resultado;
}

/** Valida el campo `datos` (JSON) de un multipart/form-data contra un DTO con whitelist estricta. */
export async function parseJsonDto<T extends object>(
  clase: new () => T,
  crudo: unknown,
  campo = 'datos',
): Promise<T> {
  if (typeof crudo !== 'string' || crudo.trim() === '') {
    throw Errores.validacion({ [campo]: 'Debe enviarse como texto JSON en el formulario.' });
  }

  let plano: unknown;
  try {
    plano = JSON.parse(crudo);
  } catch {
    throw Errores.validacion({ [campo]: 'JSON mal formado.' });
  }

  if (typeof plano !== 'object' || plano === null || Array.isArray(plano)) {
    throw Errores.validacion({ [campo]: 'Debe ser un objeto JSON.' });
  }

  const instancia = plainToInstance(clase, plano);
  const errores = await validate(instancia, { whitelist: true, forbidNonWhitelisted: true });
  if (errores.length) {
    throw Errores.validacion(aplanarErrores(errores));
  }
  return instancia;
}

/** Convierte un campo "YYYY-MM-DD" a Date o lanza VALIDATION_ERROR con el nombre del campo. */
export function fechaCampo(campo: string, valor: string): Date {
  const fecha = parseFecha(valor);
  if (!fecha) {
    throw Errores.validacion({ [campo]: 'Fecha inválida, use el formato YYYY-MM-DD.' });
  }
  return fecha;
}
