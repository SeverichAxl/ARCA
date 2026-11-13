-- Exact-version key required for repeatable parameter seeds.
DROP INDEX IF EXISTS "parametro_legal_tipo_clave_vigente_desde_idx";
CREATE UNIQUE INDEX "parametro_legal_tipo_clave_vigente_desde_key"
ON "parametro_legal"("tipo", "clave", "vigente_desde");
