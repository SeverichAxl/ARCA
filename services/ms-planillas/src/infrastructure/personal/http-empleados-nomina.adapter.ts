import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signInternalHeaders } from '@arca/internal-auth';
import { toCents } from '../../domain/common/money';
import type { EmpleadoNomina } from '../../domain/nomina/calculo';
import { parseFecha } from '../../domain/nomina/periodo';
import {
  type Actor,
  type EmpleadosNominaPort,
  PersonalNoDisponibleError,
} from '../../domain/planillas/planilla.models';

interface EmpleadoPersonalDto {
  id: string;
  nombres: string;
  apellidos: string;
  ci?: string;
  areaId: string;
  cargoId: string;
  fechaIngreso: string;
  estado: 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
  remuneracion?: string;
}

interface PaginaPersonal {
  data: EmpleadoPersonalDto[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 100;
const MAX_PAGINAS = 200;
const TIMEOUT_MS = 10_000;
const RUTA_INTERNA = '/employees';

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** Consulta ms-personal con identidad firmada; no accede a su base de datos. */
@Injectable()
export class HttpEmpleadosNominaAdapter implements EmpleadosNominaPort {
  private readonly logger = new Logger(HttpEmpleadosNominaAdapter.name);
  private readonly fetchFn: FetchLike;

  constructor(
    private readonly config: ConfigService,
    fetchFn?: FetchLike,
  ) {
    this.fetchFn = fetchFn ?? (globalThis.fetch as unknown as FetchLike);
  }

  async listarActivos(actor: Actor): Promise<EmpleadoNomina[]> {
    const baseUrl = this.config.get<string>('PERSONAL_SERVICE_URL');
    const secret = this.config.get<string>('INTERNAL_HMAC_KEY');
    if (!baseUrl || !secret) {
      throw new PersonalNoDisponibleError('Falta PERSONAL_SERVICE_URL o INTERNAL_HMAC_KEY.');
    }
    if (!actor.permisos.includes('personal:read_salary')) {
      throw new PersonalNoDisponibleError('El actor no tiene permiso para leer remuneraciones.');
    }

    const empleados: EmpleadoNomina[] = [];
    for (let page = 1; page <= MAX_PAGINAS; page += 1) {
      const pagina = await this.pedirPagina(baseUrl, secret, actor, page);
      for (const item of pagina.data) {
        if (item.estado !== 'INACTIVO') empleados.push(this.mapear(item));
      }
      if (page >= pagina.meta.totalPages) return empleados;
    }
    throw new PersonalNoDisponibleError('La nómina supera el máximo de páginas admitido.');
  }

  private async pedirPagina(
    baseUrl: string,
    secret: string,
    actor: Actor,
    page: number,
  ): Promise<PaginaPersonal> {
    const url = `${baseUrl.replace(/\/+$/, '')}${RUTA_INTERNA}?page=${page}&pageSize=${PAGE_SIZE}`;
    const headers = signInternalHeaders({
      secret,
      method: 'GET',
      path: RUTA_INTERNA,
      principal: {
        userId: actor.userId,
        empleadoId: actor.empleadoId,
        rol: actor.rol,
        permisos: actor.permisos,
      },
    });

    let respuesta: Awaited<ReturnType<FetchLike>>;
    try {
      respuesta = await this.fetchFn(url, {
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(
        `ms-personal no respondió: ${error instanceof Error ? error.message : 'error'}`,
      );
      throw new PersonalNoDisponibleError();
    }
    if (!respuesta.ok) {
      this.logger.error(`ms-personal respondió HTTP ${respuesta.status}`);
      throw new PersonalNoDisponibleError();
    }

    const body = (await respuesta.json()) as Partial<PaginaPersonal>;
    if (!Array.isArray(body.data) || typeof body.meta?.totalPages !== 'number') {
      throw new PersonalNoDisponibleError('Respuesta de ms-personal fuera de contrato.');
    }
    return body as PaginaPersonal;
  }

  private mapear(item: EmpleadoPersonalDto): EmpleadoNomina {
    if (typeof item.remuneracion !== 'string') {
      throw new PersonalNoDisponibleError(
        'ms-personal no devolvió la remuneración del funcionario.',
      );
    }
    parseFecha(item.fechaIngreso);
    return {
      empleadoId: item.id,
      nombreCompleto: `${item.nombres} ${item.apellidos}`.trim(),
      ciEnmascarado: item.ci ?? null,
      areaId: item.areaId,
      cargoId: item.cargoId,
      fechaIngreso: item.fechaIngreso.slice(0, 10),
      haberBasico: toCents(item.remuneracion, 'remuneracion'),
    };
  }
}
