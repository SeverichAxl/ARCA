import type { AuditListQuery, AuditView } from './audit.models';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditRepository {
  list(query: AuditListQuery): Promise<{ data: AuditView[]; total: number }>;
}
