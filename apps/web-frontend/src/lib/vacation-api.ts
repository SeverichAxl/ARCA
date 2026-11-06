import type { Requester } from '@/lib/admin-api';

export type VacationState =
  | 'PENDIENTE_JEFE'
  | 'APROBADO_JEFE'
  | 'APROBADO_FINAL'
  | 'RECHAZADA'
  | 'CANCELADA';
export type VacationView = 'propias' | 'bandeja-jefe' | 'bandeja-rrhh';

export interface VacationBalance {
  empleadoId: string;
  elegible: boolean;
  advertencias: string[];
  gestiones: Array<{
    gestion: number;
    diasAsignados: number;
    diasExcepcion: number;
    diasTomados: number;
    diasPendientes: number;
  }>;
}

export interface VacationRequest {
  id: string;
  empleadoId: string;
  fechaInicio: string;
  fechaFin: string;
  diasHabiles: number;
  estado: VacationState;
  creadoEn: string;
  empleado?: { nombreCompleto: string; areaId: string };
  excepcion?: { id: string; estado: string; justificacion: string } | null;
}

export interface VacationPage {
  data: VacationRequest[];
  meta: { pagina: number; limite: number; total: number; paginas: number };
}

async function read<T>(request: Requester, path: string, options?: RequestInit): Promise<T> {
  const response = await request(path, options);
  if (!response.ok) {
    let message = `La solicitud falló (${response.status}).`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(' ');
    } catch { /* respuesta sin JSON */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function json(method: string, body?: unknown): RequestInit {
  return { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}

export const vacationApi = {
  getBalance: (request: Requester) => read<VacationBalance>(request, '/vacaciones/saldo'),
  list: (request: Requester, vista: VacationView, estado?: VacationState) => {
    const query = new URLSearchParams({ vista, pagina: '1', limite: '100' });
    if (estado) query.set('estado', estado);
    return read<VacationPage>(request, `/vacaciones/solicitudes?${query}`);
  },
  create: (request: Requester, input: { fechaInicio: string; fechaFin: string; solicitarExcepcion?: boolean; justificacionExcepcion?: string }) =>
    read<VacationRequest>(request, '/vacaciones/solicitudes', json('POST', input)),
  requestException: (request: Requester, id: string, justificacion: string) =>
    read(request, `/vacaciones/solicitudes/${id}/excepcion`, json('POST', { justificacion })),
  approveManager: (request: Requester, id: string, comentario?: string) =>
    read(request, `/vacaciones/solicitudes/${id}/aprobar-jefe`, json('POST', { comentario })),
  approveHr: (request: Requester, id: string, comentario?: string) =>
    read(request, `/vacaciones/solicitudes/${id}/aprobar-rrhh`, json('POST', { comentario })),
  reject: (request: Requester, id: string, motivo: string) =>
    read(request, `/vacaciones/solicitudes/${id}/rechazar`, json('POST', { motivo })),
  resolveException: (request: Requester, id: string, decision: 'APROBADA' | 'RECHAZADA', comentario?: string) =>
    read(request, `/vacaciones/excepciones/${id}/resolver`, json('POST', { decision, comentario })),
};
