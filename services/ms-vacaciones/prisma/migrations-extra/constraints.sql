-- Prisma no soporta CHECK ni triggers. Añadir con: pnpm prisma migrate dev --create-only --name constraints
-- Nadie aprueba lo suyo (regla demostrable a nivel de base de datos):
ALTER TABLE solicitud_vacacion ADD CONSTRAINT ck_no_autoaprobacion_jefe
  CHECK (aprobado_jefe_por IS NULL OR aprobado_jefe_por <> empleado_id);
ALTER TABLE solicitud_vacacion ADD CONSTRAINT ck_no_autoaprobacion_rrhh
  CHECK (aprobado_rrhh_por IS NULL OR aprobado_rrhh_por <> empleado_id);
ALTER TABLE solicitud_vacacion ADD CONSTRAINT ck_fechas_validas CHECK (fecha_fin >= fecha_inicio);

-- CHECK no admite subconsultas: la excepción se protege con trigger.
CREATE OR REPLACE FUNCTION excepcion_no_autoresuelta() RETURNS trigger AS $$
BEGIN
  IF NEW.resuelto_por IS NOT NULL AND NEW.resuelto_por = (SELECT empleado_id FROM solicitud_vacacion WHERE id = NEW.solicitud_id) THEN
    RAISE EXCEPTION 'Nadie puede resolver su propia solicitud de excepción';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_excepcion_no_autoresuelta BEFORE INSERT OR UPDATE ON solicitud_excepcion
  FOR EACH ROW EXECUTE FUNCTION excepcion_no_autoresuelta();
