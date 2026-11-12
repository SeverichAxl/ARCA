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
  totalPages?: number;
}

export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}

export interface PagoPlanilla {
  id: string;
  planillaId: string;
  periodo: string;
  estadoPlanilla: 'BORRADOR' | 'CERRADA';
  empleado: {
    empleadoId: string;
    nombreCompleto: string;
    ciEnmascarado: string | null;
    areaId: string | null;
    cargoId: string | null;
    fechaIngreso: string;
    aniosAntiguedad: number;
  };
  diasTrabajados: number;
  haberes: {
    haberBasico: string;
    haberGanado: string;
    porcentajeBonoAntiguedad: string;
    bonoAntiguedad: string;
    otrosIngresos: string;
    totalGanado: string;
  };
  descuentos: {
    aporteLaboral: string;
    ans: string;
    rcIva: string;
    otrosDescuentos: string;
    totalDescuentos: string;
  };
  rcIvaDetalle: {
    baseImponible: string;
    impuesto: string;
    computable: string;
    saldoAnterior: string;
    saldoSiguiente: string;
  };
  liquidoPagable: string;
  aportePatronal: string;
  subsidiosInformativos: Record<string, string>;
}

export interface PlanillaCabecera {
  id: string;
  periodo: string;
  anio: number;
  mes: number;
  estado: 'BORRADOR' | 'CERRADA';
  totalEmpleados: number;
  totales: {
    totalGanado: string;
    aportesLaborales: string;
    ans: string;
    rcIva: string;
    otrosDescuentos: string;
    liquidoPagable: string;
    aportesPatronales: string;
  };
  cerradoEn: string | null;
  inmutable: boolean;
}

export interface PlanillaListFilters {
  page?: number;
  pageSize?: number;
  desde?: string;
  hasta?: string;
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
