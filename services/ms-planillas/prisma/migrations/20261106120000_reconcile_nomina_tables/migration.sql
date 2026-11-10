-- Keep the original payroll schema separate from the Sprint 2 model that follows.
ALTER TYPE "EstadoPlanilla" RENAME TO "EstadoPlanillaNomina";

ALTER TABLE "parametro_legal" RENAME TO "parametro_legal_nomina";
ALTER TABLE "parametro_legal_nomina"
  RENAME CONSTRAINT "parametro_legal_pkey" TO "parametro_legal_nomina_pkey";
ALTER TABLE "parametro_legal_nomina"
  RENAME CONSTRAINT "parametro_legal_valor_no_negativo"
  TO "parametro_legal_nomina_valor_no_negativo";
ALTER TABLE "parametro_legal_nomina"
  RENAME CONSTRAINT "parametro_legal_clave_formato"
  TO "parametro_legal_nomina_clave_formato";
ALTER INDEX "parametro_legal_clave_vigente_desde_key"
  RENAME TO "parametro_legal_nomina_clave_vigente_desde_key";

ALTER TABLE "planilla_detalle" RENAME TO "planilla_detalle_nomina";
ALTER TABLE "planilla_detalle_nomina"
  RENAME CONSTRAINT "planilla_detalle_pkey" TO "planilla_detalle_nomina_pkey";
ALTER TABLE "planilla_detalle_nomina"
  RENAME CONSTRAINT "planilla_detalle_planilla_id_fkey"
  TO "planilla_detalle_nomina_planilla_id_fkey";
ALTER TABLE "planilla_detalle_nomina"
  RENAME CONSTRAINT "planilla_detalle_dias" TO "planilla_detalle_nomina_dias";
ALTER TABLE "planilla_detalle_nomina"
  RENAME CONSTRAINT "planilla_detalle_importes_no_negativos"
  TO "planilla_detalle_nomina_importes_no_negativos";
ALTER TABLE "planilla_detalle_nomina"
  RENAME CONSTRAINT "planilla_detalle_cuadre" TO "planilla_detalle_nomina_cuadre";
ALTER INDEX "planilla_detalle_empleado_id_idx"
  RENAME TO "planilla_detalle_nomina_empleado_id_idx";
ALTER INDEX "planilla_detalle_planilla_id_area_id_idx"
  RENAME TO "planilla_detalle_nomina_planilla_id_area_id_idx";
ALTER INDEX "planilla_detalle_planilla_id_empleado_id_key"
  RENAME TO "planilla_detalle_nomina_planilla_id_empleado_id_key";
