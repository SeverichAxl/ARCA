/**
 * Tipos del contrato de planillas/boletas.
 *
 * Fuente de verdad:
 * - docs/api/planillas.md
 * - docs/api/openapi/planillas.yaml
 * - services/ms-planillas/prisma/schema.prisma
 *
 * Los importes llegan SIEMPRE como string decimal (nunca `number`).
 */

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}

export type EstadoBoleta = 'EMITIDA' | 'ANULADA';

export interface Boleta {
  id: string;
  planillaId: string;
  periodo: string;
  empleadoId: string;
  liquidoPagable: string;
  hashSha256: string;
  emitidaEn: string;
  /**
   * `EstadoBoleta` existe en la base de datos, pero el OpenAPI v1 no lo
   * publica en la lista. La UI lo muestra si llega; si no, asume `EMITIDA`.
   */
  estado?: EstadoBoleta;
}

export interface BoletaListFilters {
  page?: number;
  pageSize?: number;
  periodo?: string;
  planillaId?: string;
}

export interface DescargaBoleta {
  url: string;
  expiresInSeconds: number;
  hashSha256: string;
}

export interface SubsidioInformativo {
  concepto: string;
  monto: string;
}

/**
 * Desglose del detalle. El contrato v1 NO publica estos campos en la boleta
 * (`GET /planillas/boletas/:id` devuelve solo metadatos + hash). El mock los
 * incluye para demostrar el panel; la UI los oculta si el backend no los envía.
 *
 * `aportePatronal` es informativo (lo paga el empleador) y NO forma parte de
 * `totalDescuentos`. Los subsidios también son informativos y NO suman al
 * líquido pagable.
 */
export interface BoletaDesglose {
  haberBasico: string;
  bonoAntiguedad: string;
  horasExtra: string;
  otrosIngresos: string;
  totalGanado: string;
  aporteLaboral: string;
  aportePatronal: string;
  ans: string;
  rcIva: string;
  otrosDescuentos: string;
  totalDescuentos: string;
  liquidoPagable: string;
  subsidiosInformativos: SubsidioInformativo[];
}

export interface BoletaDetalle extends Boleta {
  desglose?: BoletaDesglose;
}
