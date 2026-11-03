import { InjectionToken } from '@nestjs/common';
import type { AuditEntry, AuditRecorder } from './audit.types';

export const AUDIT_RECORDER = Symbol('AUDIT_RECORDER');
export type AuditRecorderToken = InjectionToken;

export interface AuditRecorderPort extends AuditRecorder {
  record(entry: AuditEntry): Promise<void>;
}
