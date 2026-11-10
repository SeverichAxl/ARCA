import type { Clock } from '../../domain/planillas/planilla.models';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
