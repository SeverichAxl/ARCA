-- TSK-ARQ-202 / HU-24: refuerzo de inmutabilidad para planillas cerradas,
-- detalles asociados y boletas emitidas. Aplicar después de la migración Sprint 2.
-- NOTA: el servicio DEBE bloquear mutaciones; esto es defensa en profundidad.
-- Rollback: DROP TRIGGER ... y DROP FUNCTION planillas_bloquear_mutacion_historico();

CREATE OR REPLACE FUNCTION planillas_bloquear_mutacion_historico()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registro inmutable (HU-24/RF-26): no se permite UPDATE/DELETE sobre histórico cerrado/emitido.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_planilla_mensual_inmutable ON planilla_mensual;
CREATE TRIGGER trg_planilla_mensual_inmutable
BEFORE UPDATE OR DELETE ON planilla_mensual
FOR EACH ROW
WHEN (OLD.estado = 'CERRADA')
EXECUTE FUNCTION planillas_bloquear_mutacion_historico();

DROP TRIGGER IF EXISTS trg_planilla_detalle_inmutable ON planilla_detalle;
CREATE TRIGGER trg_planilla_detalle_inmutable
BEFORE UPDATE OR DELETE ON planilla_detalle
FOR EACH ROW
WHEN (EXISTS (
  SELECT 1 FROM planilla_mensual p
  WHERE p.id = OLD.planilla_id AND p.estado = 'CERRADA'
))
EXECUTE FUNCTION planillas_bloquear_mutacion_historico();

DROP TRIGGER IF EXISTS trg_boleta_pago_inmutable ON boleta_pago;
CREATE TRIGGER trg_boleta_pago_inmutable
BEFORE UPDATE OR DELETE ON boleta_pago
FOR EACH ROW
WHEN (OLD.estado = 'EMITIDA')
EXECUTE FUNCTION planillas_bloquear_mutacion_historico();

REVOKE UPDATE, DELETE ON planilla_mensual FROM ms_planillas_app;
REVOKE UPDATE, DELETE ON planilla_detalle FROM ms_planillas_app;
REVOKE UPDATE, DELETE ON boleta_pago FROM ms_planillas_app;
-- Re-otorgar privilegios mínimos necesarios: la aplicación puede necesitar
-- INSERT/SELECT y UPDATE controlado en estados no cerrados. Ajustar en ARQ-203
-- según estrategia de migración/roles (p. ej. role intermedio o lógica en
-- funciones/owner). Si se mantiene RLS/privilegios estrictos, validar con ops.