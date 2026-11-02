DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_no_autoaprobacion_jefe'
      AND conrelid = 'solicitud_vacacion'::regclass
  ) THEN
    ALTER TABLE solicitud_vacacion
      ADD CONSTRAINT ck_no_autoaprobacion_jefe
      CHECK (aprobado_jefe_por IS NULL OR aprobado_jefe_por <> empleado_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_no_autoaprobacion_rrhh'
      AND conrelid = 'solicitud_vacacion'::regclass
  ) THEN
    ALTER TABLE solicitud_vacacion
      ADD CONSTRAINT ck_no_autoaprobacion_rrhh
      CHECK (aprobado_rrhh_por IS NULL OR aprobado_rrhh_por <> empleado_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_fechas_validas'
      AND conrelid = 'solicitud_vacacion'::regclass
  ) THEN
    ALTER TABLE solicitud_vacacion
      ADD CONSTRAINT ck_fechas_validas CHECK (fecha_fin >= fecha_inicio);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION excepcion_no_autoresuelta() RETURNS trigger AS $$
BEGIN
  IF NEW.resuelto_por IS NOT NULL AND NEW.resuelto_por = (
    SELECT empleado_id
    FROM solicitud_vacacion
    WHERE id = NEW.solicitud_id
  ) THEN
    RAISE EXCEPTION 'Nadie puede resolver su propia solicitud de excepción';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_excepcion_no_autoresuelta ON solicitud_excepcion;
CREATE TRIGGER trg_excepcion_no_autoresuelta
  BEFORE INSERT OR UPDATE ON solicitud_excepcion
  FOR EACH ROW EXECUTE FUNCTION excepcion_no_autoresuelta();
