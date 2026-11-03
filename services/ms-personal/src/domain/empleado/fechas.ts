const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const ZONA_BOLIVIA = 'America/La_Paz';

/** Convierte "YYYY-MM-DD" a Date (medianoche UTC). Devuelve null si la fecha no existe. */
export function parseFecha(valor: string): Date | null {
  if (!FECHA_RE.test(valor)) return null;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime()) || formatFecha(fecha) !== valor) return null;
  return fecha;
}

export function formatFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 86_400_000);
}

/** Fecha calendario actual en Bolivia (UTC-4), como medianoche UTC. */
export function hoyBolivia(ahora: Date = new Date()): Date {
  const texto = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_BOLIVIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
  return parseFecha(texto) as Date;
}

function esUltimoDiaDelMes(fecha: Date): boolean {
  return sumarDias(fecha, 1).getUTCMonth() !== fecha.getUTCMonth();
}

/**
 * Días comerciales (año de 360 días, meses de 30) entre dos fechas, ambas inclusive.
 * Es la base usada en liquidaciones laborales en Bolivia.
 * Ej.: 01/01 al 31/01 = 30 días; 01/03/2023 al 30/10/2026 = 1320 días (3 años, 8 meses).
 */
export function diasComerciales(desde: Date, hasta: Date): number {
  if (hasta < desde) return 0;
  const diaDesde = Math.min(desde.getUTCDate(), 30);
  const diaHasta = esUltimoDiaDelMes(hasta) ? 30 : Math.min(hasta.getUTCDate(), 30);
  const inicio = desde.getUTCFullYear() * 360 + desde.getUTCMonth() * 30 + diaDesde;
  const fin = hasta.getUTCFullYear() * 360 + hasta.getUTCMonth() * 30 + diaHasta;
  return Math.max(0, fin - inicio + 1);
}

export function desglosarDias(totalDias: number): { anios: number; meses: number; dias: number } {
  return {
    anios: Math.floor(totalDias / 360),
    meses: Math.floor((totalDias % 360) / 30),
    dias: totalDias % 30,
  };
}
