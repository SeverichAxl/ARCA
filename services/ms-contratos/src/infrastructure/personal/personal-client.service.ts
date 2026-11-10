import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signInternalHeaders, type InternalPrincipal } from '@arca/internal-auth';
import type {
  DatosEmpleadoContrato,
  PersonalDataPort,
} from '../../domain/contracts/personal-data.port';

const DEFAULT_PERSONAL_SERVICE_URL = 'http://ms-personal:4002';
const DEFAULT_CONTRACT_DATA_PATH = '/employees/:id/datos-contrato';
const DEFAULT_TIMEOUT_MS = 5_000;

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function errorCode(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' && code.trim().length > 0 ? code : undefined;
}

/**
 * Cliente de la interfaz autorizada de ms-personal. Firma cada petición con las
 * cabeceras internas del actor original, de modo que ms-personal aplique su
 * propia autorización y solo incluya la remuneración si el actor tiene
 * `personal:read_salary`.
 */
@Injectable()
export class PersonalClientService implements PersonalDataPort {
  constructor(private readonly config: ConfigService) {}

  async getDatosContrato(
    empleadoId: string,
    principal: InternalPrincipal,
  ): Promise<DatosEmpleadoContrato> {
    const baseUrl = (
      this.config.get<string>('PERSONAL_SERVICE_URL') ?? DEFAULT_PERSONAL_SERVICE_URL
    ).replace(/\/+$/, '');
    const pathTemplate =
      this.config.get<string>('PERSONAL_CONTRACT_DATA_PATH') ?? DEFAULT_CONTRACT_DATA_PATH;
    const path = pathTemplate.replace(':id', encodeURIComponent(empleadoId));
    const secret = this.config.get<string>('INTERNAL_HMAC_KEY');

    if (!secret) {
      throw new InternalServerErrorException({
        code: 'CONTR_CONFIG_INVALIDA',
        message: 'Falta INTERNAL_HMAC_KEY para consultar los datos del empleado.',
      });
    }

    const headers = signInternalHeaders({
      secret,
      method: 'GET',
      path,
      principal,
    });

    const timeoutMs = this.timeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...headers,
        },
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw this.mapHttpError(response.status, payload);
      }

      return this.mapDatos(empleadoId, payload);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadGatewayException({
        code: 'CONTR_PERSONAL_UNAVAILABLE',
        message: 'No se pudo consultar los datos del empleado en ms-personal.',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private mapHttpError(status: number, payload: unknown): HttpException {
    const code = errorCode(payload);

    if (status === 404) {
      return new NotFoundException({
        code: 'NOT_FOUND',
        message: 'El empleado no existe o no es accesible para el actor.',
      });
    }

    if (status === 403) {
      return new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tiene permiso para consultar los datos del empleado.',
      });
    }

    if (status === 422) {
      return new UnprocessableEntityException({
        code: code ?? 'CONTR_DATOS_INCOMPLETOS',
        message: 'Los datos del empleado están incompletos para generar el contrato.',
      });
    }

    if (status === 400) {
      return new BadRequestException({
        code: code ?? 'CONTR_DATOS_INCOMPLETOS',
        message: 'Los datos del empleado no son válidos para generar el contrato.',
      });
    }

    return new BadGatewayException({
      code: 'CONTR_PERSONAL_UNAVAILABLE',
      message: 'No se pudo consultar los datos del empleado en ms-personal.',
    });
  }

  private mapDatos(empleadoId: string, payload: unknown): DatosEmpleadoContrato {
    if (typeof payload !== 'object' || payload === null) {
      throw new UnprocessableEntityException({
        code: 'CONTR_DATOS_INCOMPLETOS',
        message: 'ms-personal no devolvió los datos del empleado.',
      });
    }

    const data = payload as Record<string, unknown>;
    const nombreEmpleado =
      text(data.nombre_empleado) ??
      [text(data.nombres), text(data.apellidos)].filter(Boolean).join(' ');
    const ci = text(data.ci);
    const cargo = text(data.cargo) ?? text(data.cargoNombre);
    const fechaIngreso = text(data.fecha_ingreso) ?? text(data.fechaIngreso);
    const duracionPrueba =
      text(data.duracion_prueba) ??
      (typeof data.diasPrueba === 'number' ? `${data.diasPrueba} días` : undefined);
    const remuneracion = text(data.remuneracion);

    const faltantes: string[] = [];
    if (!nombreEmpleado) faltantes.push('nombre_empleado');
    if (!ci) faltantes.push('ci');
    if (!cargo) faltantes.push('cargo');
    if (!fechaIngreso) faltantes.push('fecha_ingreso');
    if (!duracionPrueba) faltantes.push('duracion_prueba');

    if (faltantes.length > 0) {
      throw new UnprocessableEntityException({
        code: 'CONTR_DATOS_INCOMPLETOS',
        message: 'Los datos del empleado están incompletos para generar el contrato.',
        details: { fields: faltantes },
      });
    }

    return {
      empleadoId: text(data.empleadoId) ?? text(data.id) ?? empleadoId,
      nombreEmpleado: nombreEmpleado as string,
      ci: ci as string,
      cargo: cargo as string,
      ...(remuneracion ? { remuneracion } : {}),
      fechaIngreso: fechaIngreso as string,
      duracionPrueba: duracionPrueba as string,
    };
  }

  private timeoutMs(): number {
    const configured = Number(this.config.get<string>('PERSONAL_SERVICE_TIMEOUT_MS'));
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
  }
}
