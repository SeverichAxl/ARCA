import type { Clock } from '../../domain/common/clock';
import { todayInZone } from '../../domain/common/date-only';

export const BUSINESS_TIME_ZONE = 'America/La_Paz';

/** Reloj de producción: zona America/La_Paz, inyectable en pruebas. */
export class SystemClock implements Clock {
  constructor(private readonly timeZone: string = BUSINESS_TIME_ZONE) {}

  today(): string {
    return todayInZone(this.timeZone);
  }
}
