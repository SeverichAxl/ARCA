import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { catchError, from, mergeMap, throwError, type Observable } from 'rxjs';
import { AuditContext } from './audit.context';
import {
  AUDIT_METADATA_KEY,
  SKIP_AUDIT_METADATA_KEY,
  type AuditOptions,
} from './audit.decorator';
import { AUDIT_RECORDER } from './audit.recorder';
import type { AuditEntry, AuditErrorDetail, AuditPayload, AuditRecorder } from './audit.types';
import { maskSensitive } from './mask';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

interface AuditableRequest {
  method?: string;
  path?: string;
  originalUrl?: string;
  baseUrl?: string;
  ip?: string;
  route?: { path?: string };
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  internalPrincipal?: {
    userId?: string;
    empleadoId?: string | null;
  };
}

function normalizeRoute(request: AuditableRequest): string {
  const routePath = request.route?.path;
  const raw = (routePath ? `${request.baseUrl ?? ''}${routePath}` : undefined)
    ?? request.path
    ?? request.originalUrl
    ?? '/';

  const withoutQuery = raw.split('?')[0] ?? '/';
  return (
    withoutQuery
      .replace(UUID_PATTERN, ':id')
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      .slice(0, 500) || '/'
  );
}

function moduleFromRoute(recurso: string): string {
  const segments = recurso.split('/').filter((segment) => segment.length > 0);
  if (segments[0] === 'api') return segments[1] ?? 'app';
  return segments[0] ?? 'app';
}

function ipOf(request: AuditableRequest): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedValue) return forwardedValue.split(',')[0]?.trim() ?? null;
  return request.ip ?? request.socket?.remoteAddress ?? null;
}

function errorDetail(error: unknown): AuditErrorDetail {
  if (error instanceof HttpException) {
    const statusCode = error.getStatus();
    const response = error.getResponse();
    const code =
      typeof response === 'object' &&
      response !== null &&
      'code' in response &&
      typeof (response as { code?: unknown }).code === 'string'
        ? (response as { code: string }).code
        : `HTTP_${statusCode}`;
    return { statusCode, code };
  }
  return { statusCode: 500, code: 'INTERNAL_ERROR' };
}

/**
 * Audita toda escritura (POST/PUT/PATCH/DELETE). Se ejecuta después del
 * handler; si el registro de auditoría falla, se registra un ERROR y la
 * respuesta al cliente no se modifica.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditContext: AuditContext,
    @Inject(AUDIT_RECORDER) private readonly recorder: AuditRecorder,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditableRequest>();
    const method = (request.method ?? 'GET').toUpperCase();

    if (!WRITE_METHODS.has(method)) return next.handle();

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const options = this.reflector.getAllAndOverride<AuditOptions>(AUDIT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const recurso = normalizeRoute(request);
    const modulo = options?.modulo ?? moduleFromRoute(recurso);
    const accion = this.auditContext.snapshot().accion
      ?? options?.accion
      ?? `${method} ${recurso}`;

    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        await this.record(request, {
          modulo,
          accion,
          recurso,
          body,
          error: undefined,
        });
        return body;
      }),
      catchError((error: unknown) =>
        from(
          this.record(request, {
            modulo,
            accion,
            recurso,
            body: undefined,
            error,
          }),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }

  private async record(
    request: AuditableRequest,
    input: {
      modulo: string;
      accion: string;
      recurso: string;
      body: unknown;
      error: unknown;
    },
  ): Promise<void> {
    const snapshot = this.auditContext.snapshot();
    const usuarioId = request.internalPrincipal?.userId ?? null;
    const empleadoId = request.internalPrincipal?.empleadoId ?? null;
    const failed = input.error !== undefined;

    const payload: AuditPayload = {
      antes: maskSensitive(snapshot.before),
      despues: maskSensitive(
        snapshot.hasAfter ? snapshot.after : failed ? null : input.body,
      ),
      ...(empleadoId ? { empleadoId } : {}),
      ...(failed ? { error: errorDetail(input.error) } : {}),
    };

    const entry: AuditEntry = {
      eventId: randomUUID(),
      occurredOn: new Date(),
      usuarioId,
      empleadoId,
      ipOrigen: ipOf(request),
      modulo: input.modulo,
      accion: snapshot.accion ?? input.accion,
      metodo: (request.method ?? 'GET').toUpperCase(),
      recurso: input.recurso,
      resultado: failed ? 'FALLIDO' : 'EXITO',
      payload,
    };

    try {
      await this.recorder.record(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `No se pudo registrar la auditoría eventId=${entry.eventId} ` +
          `modulo=${entry.modulo} accion=${entry.accion} metodo=${entry.metodo} ` +
          `recurso=${entry.recurso}: ${message}`,
      );
    }
  }
}
