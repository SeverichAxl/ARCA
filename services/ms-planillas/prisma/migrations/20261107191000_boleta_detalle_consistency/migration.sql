-- A receipt may only reference a detail from the same payroll run.
ALTER TABLE "planilla_detalle"
ADD CONSTRAINT "planilla_detalle_id_planilla_id_key" UNIQUE ("id", "planilla_id");

ALTER TABLE "boleta_pago"
ADD CONSTRAINT "boleta_pago_detalle_id_planilla_id_key" UNIQUE ("detalle_id", "planilla_id");

ALTER TABLE "boleta_pago"
DROP CONSTRAINT "boleta_pago_detalle_id_fkey";

ALTER TABLE "boleta_pago"
ADD CONSTRAINT "boleta_pago_detalle_id_planilla_id_fkey"
FOREIGN KEY ("detalle_id", "planilla_id")
REFERENCES "planilla_detalle"("id", "planilla_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
