import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Counter {
  count: number;
  expiresAt: number;
}

const DEFAULT_IP_MAX = 10;
const DEFAULT_IP_WINDOW_MS = 60_000;
const DEFAULT_USER_MAX = 10;
const DEFAULT_USER_WINDOW_MS = 15 * 60_000;
const SWEEP_INTERVAL_MS = 60_000;

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function normalizeLoginUsername(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, '');
}

export function rateLimitedError(): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      code: 'RATE_LIMITED',
      message: 'Demasiados intentos de inicio de sesión. Intente más tarde.',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/**
 * Limitador en memoria con expiración de claves. La instancia es suficiente
 * para la demo (un proceso); en producción se reemplaza por un almacén
 * compartido. La clave de usuario se normaliza y se aplica también a usuarios
 * inexistentes para no revelar cuáles existen.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly ipCounters = new Map<string, Counter>();
  private readonly userCounters = new Map<string, Counter>();
  private readonly ipMax = positiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_IP_MAX, DEFAULT_IP_MAX);
  private readonly ipWindowMs = positiveInt(
    process.env.AUTH_LOGIN_RATE_LIMIT_IP_WINDOW_MS,
    DEFAULT_IP_WINDOW_MS,
  );
  private readonly userMax = positiveInt(
    process.env.AUTH_LOGIN_RATE_LIMIT_USER_MAX,
    DEFAULT_USER_MAX,
  );
  private readonly userWindowMs = positiveInt(
    process.env.AUTH_LOGIN_RATE_LIMIT_USER_WINDOW_MS,
    DEFAULT_USER_WINDOW_MS,
  );
  private lastSweep = Date.now();

  consume(ip: string | null | undefined, username: string): void {
    const now = Date.now();
    this.sweepIfNeeded(now);
    this.hit(this.ipCounters, ip && ip.length > 0 ? ip : 'desconocida', this.ipMax, this.ipWindowMs, now);
    this.hit(
      this.userCounters,
      normalizeLoginUsername(username) || '<vacio>',
      this.userMax,
      this.userWindowMs,
      now,
    );
  }

  private hit(
    counters: Map<string, Counter>,
    key: string,
    max: number,
    windowMs: number,
    now: number,
  ): void {
    const current = counters.get(key);
    if (!current || current.expiresAt <= now) {
      counters.set(key, { count: 1, expiresAt: now + windowMs });
      return;
    }
    if (current.count >= max) {
      throw rateLimitedError();
    }
    current.count += 1;
  }

  private sweepIfNeeded(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const counters of [this.ipCounters, this.userCounters]) {
      for (const [key, value] of counters) {
        if (value.expiresAt <= now) counters.delete(key);
      }
    }
  }
}
