-- ARCA-119 / ARCA-122: defensa en profundidad para las boletas actuales.
-- La tabla heredada boleta_pago ya tiene su propia protección; esta migración
-- cubre boleta_pago_nomina, utilizada por BoletaService.

CREATE OR REPLACE FUNCTION "boleta_nomina_proteger_emitida"() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."estado" = 'EMITIDA' THEN
    RAISE EXCEPTION 'BOLETA_INMUTABLE: no se permite modificar ni eliminar una boleta emitida.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "boleta_nomina_proteger_emitida"
  BEFORE UPDATE OR DELETE ON "boleta_pago_nomina"
  FOR EACH ROW EXECUTE FUNCTION "boleta_nomina_proteger_emitida"();

CREATE OR REPLACE FUNCTION "boleta_nomina_bloquear_truncate"() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'BOLETA_INMUTABLE: no se permite truncar el historial de boletas.';
END;
$$;

CREATE TRIGGER "boleta_nomina_bloquear_truncate"
  BEFORE TRUNCATE ON "boleta_pago_nomina"
  FOR EACH STATEMENT EXECUTE FUNCTION "boleta_nomina_bloquear_truncate"();
