# migrations-extra (ms-contratos)

Scripts SQL de refuerzo aplicados **después** de `prisma migrate deploy` cuando
corresponda (hardening, privilegios, triggers). Mantener idempotencia cuando
sea posible.

Sprint 2: las versiones de contrato/documento son append-only por diseño
(`contrato_version` sin mutación destructiva esperada). Si se requiere
protección adicional (p. ej. impedir cambios tras `EMITIDO`), agregar trigger
similar al de planillas en coordinación con ARQ-203.

Rollback: documentar en el mismo archivo SQL que lo introduzca.