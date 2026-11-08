# Refuerzo opcional de inmutabilidad (ms-planillas)

`inmutabilidad_historico.sql` no forma parte del historial gestionado por
Prisma. Aplicarlo manualmente, después de `prisma migrate deploy`, con el
usuario dueño de `db_planillas`. El servicio debe además bloquear cambios a
planillas cerradas, sus detalles y boletas emitidas; el trigger es defensa en
profundidad. El script no cambia grants de roles de aplicación.

## Rollback

El rollback quita exclusivamente los triggers y la función creados por este
refuerzo; no elimina datos:

```sql
DROP TRIGGER IF EXISTS trg_planilla_mensual_inmutable ON planilla_mensual;
DROP TRIGGER IF EXISTS trg_planilla_detalle_inmutable ON planilla_detalle;
DROP TRIGGER IF EXISTS trg_boleta_pago_inmutable ON boleta_pago;
DROP FUNCTION IF EXISTS planillas_bloquear_mutacion_historico();
```

Aplicar el rollback solo como decisión operativa aprobada. Sin los triggers,
la inmutabilidad depende de la lógica del servicio.
