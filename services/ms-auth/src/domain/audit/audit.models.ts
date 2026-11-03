export interface AuditListQuery {
  usuarioId?: string;
  modulo?: string;
  desde?: Date;
  hasta?: Date;
  page: number;
  pageSize: number;
}

export interface AuditView {
  id: string;
  eventId: string;
  usuarioId: string | null;
  ipOrigen: string | null;
  modulo: string;
  accion: string;
  metodo: string | null;
  recurso: string | null;
  resultado: string;
  payload: unknown;
  ocurridoEn: Date;
  creadoEn: Date;
}
