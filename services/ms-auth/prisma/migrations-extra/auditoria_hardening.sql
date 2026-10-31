-- Aplicar como migración personalizada DESPUÉS de crear las tablas:
--   pnpm prisma migrate dev --create-only --name auditoria_hardening
--   (pegar este contenido en el migration.sql generado y luego `migrate dev`)

-- 1) El usuario de runtime solo puede leer e insertar.
REVOKE UPDATE, DELETE, TRUNCATE ON auditoria_log FROM ms_auth_app;

-- 2) Defensa en profundidad: ni siquiera el dueño puede modificar filas.
CREATE OR REPLACE FUNCTION auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'auditoria_log es inmutable (% bloqueado)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_no_update_delete
  BEFORE UPDATE OR DELETE ON auditoria_log
  FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();

CREATE TRIGGER trg_auditoria_no_truncate
  BEFORE TRUNCATE ON auditoria_log
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_inmutable();
