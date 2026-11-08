-- TSK-ARQ-202 / HU-24: refuerzo de inmutabilidad para planillas cerradas,
-- detalles asociados y boletas emitidas. Aplicar después de la migración Sprint 2.
-- NOTA: el servicio DEBE bloquear mutaciones; esto es defensa en profundidad.
-- Rollback: DROP TRIGGER ... y DROP FUNCTION planillas_bloquear_mutacion_historico();

CREATE OR REPLACE FUNCTION planillas_bloquear_mutacion_historico()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'planilla_mensual' THEN
    IF OLD.estado = 'CERRADA' THEN
      RAISE EXCEPTION 'Registro inmutable (HU-24/RF-26): no se permite mutar una planilla cerrada.';
    END IF;
  ELSIF TG_TABLE_NAME = 'planilla_detalle' THEN
    IF EXISTS (
      SELECT 1
      FROM planilla_mensual p
      WHERE p.id = OLD.planilla_id AND p.estado = 'CERRADA'
    ) THEN
      RAISE EXCEPTION 'Registro inmutable (HU-24/RF-26): no se permite mutar un detalle de planilla cerrada.';
    END IF;
  ELSIF TG_TABLE_NAME = 'boleta_pago' THEN
    IF OLD.estado = 'EMITIDA' THEN
      RAISE EXCEPTION 'Registro inmutable (HU-24/RF-26): no se permite mutar una boleta emitida.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_planilla_mensual_inmutable ON planilla_mensual;
CREATE TRIGGER trg_planilla_mensual_inmutable
BEFORE UPDATE OR DELETE ON planilla_mensual
FOR EACH ROW
EXECUTE FUNCTION planillas_bloquear_mutacion_historico();

DROP TRIGGER IF EXISTS trg_planilla_detalle_inmutable ON planilla_detalle;
CREATE TRIGGER trg_planilla_detalle_inmutable
BEFORE UPDATE OR DELETE ON planilla_detalle
FOR EACH ROW
EXECUTE FUNCTION planillas_bloquear_mutacion_historico();

DROP TRIGGER IF EXISTS trg_boleta_pago_inmutable ON boleta_pago;
CREATE TRIGGER trg_boleta_pago_inmutable
BEFORE UPDATE OR DELETE ON boleta_pago
FOR EACH ROW
EXECUTE FUNCTION planillas_bloquear_mutacion_historico();