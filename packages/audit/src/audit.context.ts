import { Injectable, Scope } from '@nestjs/common';

export interface AuditCaptureSnapshot {
  before: unknown;
  after: unknown;
  hasAfter: boolean;
  accion?: string;
}

/**
 * Contexto por petición para que el controlador o el caso de uso capturen el
 * estado anterior y posterior del recurso. Sin captura, el interceptor usa el
 * body de la respuesta como "despues" y deja "antes" en null.
 */
@Injectable({ scope: Scope.REQUEST })
export class AuditContext {
  private before: unknown = null;
  private after: unknown;
  private hasAfter = false;
  private accion?: string;

  captureBefore(value: unknown): void {
    this.before = value;
  }

  captureAfter(value: unknown): void {
    this.after = value;
    this.hasAfter = true;
  }

  setAccion(accion: string): void {
    this.accion = accion;
  }

  snapshot(): AuditCaptureSnapshot {
    return {
      before: this.before,
      after: this.after,
      hasAfter: this.hasAfter,
      accion: this.accion,
    };
  }
}
