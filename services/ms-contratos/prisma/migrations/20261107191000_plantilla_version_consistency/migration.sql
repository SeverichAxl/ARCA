-- A contract may only reference a version belonging to its selected template.
ALTER TABLE "plantilla_version"
ADD CONSTRAINT "plantilla_version_id_plantilla_id_key" UNIQUE ("id", "plantilla_id");

ALTER TABLE "contrato"
DROP CONSTRAINT "contrato_plantilla_version_id_fkey";

ALTER TABLE "contrato"
ADD CONSTRAINT "contrato_plantilla_version_id_plantilla_id_fkey"
FOREIGN KEY ("plantilla_version_id", "plantilla_id")
REFERENCES "plantilla_version"("id", "plantilla_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
