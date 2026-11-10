-- TSK-DEV2-201..204: extensión del modelo base de TSK-ARQ-202 para el motor de
-- cálculo mensual (HU-21), novedades, historial inmutable y retención (HU-24/RF-26).
-- Solo agrega columnas con DEFAULT/nullable y tablas nuevas: no modifica datos.
-- Parte 1: DDL generado con prisma migrate diff desde 20261107191000.

ALTER TABLE "planilla_mensual" ADD COLUMN "duracion_ms" INTEGER,
ADD COLUMN "error_proceso" JSONB,
ADD COLUMN "parametros_aplicados" JSONB,
ADD COLUMN "retencion_hasta" DATE,
ADD COLUMN "total_ans" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "total_otros_descuentos" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "total_rc_iva" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "planilla_detalle" ADD COLUMN "anios_antiguedad" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "area_id" UUID,
ADD COLUMN "cargo_id" UUID,
ADD COLUMN "ci_enmascarado" VARCHAR(30),
ADD COLUMN "dias_trabajados" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "fecha_ingreso" DATE,
ADD COLUMN "haber_ganado" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "nombre_completo" TEXT,
ADD COLUMN "otros_descuentos" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "otros_ingresos" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "porcentaje_bono" DECIMAL(9,4) NOT NULL DEFAULT 0,
ADD COLUMN "rc_iva" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "rc_iva_base_imponible" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "rc_iva_impuesto" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "rc_iva_saldo_anterior" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "rc_iva_saldo_siguiente" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "total_descuentos" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "novedad_planilla" (
    "id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "empleado_id" UUID NOT NULL,
    "dias_trabajados" INTEGER,
    "otros_ingresos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otros_descuentos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rc_iva_computable" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subsidios" JSONB NOT NULL DEFAULT '{}',
    "observacion" VARCHAR(500),
    "actualizado_por" UUID NOT NULL,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "novedad_planilla_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "configuracion_planillas" (
    "clave" VARCHAR(60) NOT NULL,
    "valor" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configuracion_planillas_pkey" PRIMARY KEY ("clave")
);

CREATE UNIQUE INDEX "novedad_planilla_periodo_empleado_id_key"
ON "novedad_planilla"("periodo", "empleado_id");
CREATE INDEX "planilla_detalle_planilla_id_area_id_idx"
ON "planilla_detalle"("planilla_id", "area_id");

ALTER TABLE "novedad_planilla"
  ADD CONSTRAINT "novedad_planilla_periodo_formato"
    CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "novedad_planilla_dias"
    CHECK ("dias_trabajados" IS NULL OR "dias_trabajados" BETWEEN 0 AND 30),
  ADD CONSTRAINT "novedad_planilla_importes"
    CHECK ("otros_ingresos" >= 0 AND "otros_descuentos" >= 0 AND "rc_iva_computable" >= 0);

ALTER TABLE "planilla_mensual"
  ADD CONSTRAINT "planilla_mensual_periodo_formato"
    CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') NOT VALID,
  ADD CONSTRAINT "planilla_mensual_cierre_completo" CHECK (
    "estado" <> 'CERRADA'
    OR ("cerrada_por" IS NOT NULL AND "cerrada_en" IS NOT NULL AND "retencion_hasta" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "planilla_detalle"
  ADD CONSTRAINT "planilla_detalle_dias" CHECK ("dias_trabajados" BETWEEN 0 AND 30) NOT VALID,
  ADD CONSTRAINT "planilla_detalle_cuadre" CHECK (
    "total_ganado" = "haber_ganado" + "bono_antiguedad" + "otros_ingresos"
    AND "total_descuentos" = "aporte_laboral" + "ans" + "rc_iva" + "otros_descuentos"
    AND "liquido_pagable" = "total_ganado" - "total_descuentos"
    AND "liquido_pagable" >= 0
  ) NOT VALID;

ALTER TABLE "configuracion_planillas"
  ADD CONSTRAINT "configuracion_planillas_retencion_minima" CHECK (
    "clave" <> 'RETENCION_ANIOS'
    OR CASE WHEN "valor" ~ '^[0-9]{1,3}$' THEN "valor"::integer >= 8 ELSE false END
  );

INSERT INTO "configuracion_planillas" ("clave", "valor", "descripcion", "actualizado_en")
VALUES ('RETENCION_ANIOS', '8', 'Años mínimos de conservación de planillas cerradas (RF-26).', CURRENT_TIMESTAMP)
ON CONFLICT ("clave") DO NOTHING;

CREATE OR REPLACE FUNCTION "planilla_purga_autorizada"(p_retencion DATE) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT p_retencion IS NOT NULL
     AND p_retencion < CURRENT_DATE
     AND COALESCE(current_setting('arca.purga_retencion', true), '') = 'on';
$$;

CREATE OR REPLACE FUNCTION "planilla_mensual_proteger_cerrada"() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."estado" = 'CERRADA' THEN
      RAISE EXCEPTION 'PLAN_INMUTABLE: la planilla % está cerrada y no admite cambios', OLD."periodo"
        USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."estado" = 'CERRADA' AND NOT "planilla_purga_autorizada"(OLD."retencion_hasta") THEN
    RAISE EXCEPTION 'PLAN_INMUTABLE: la planilla % está cerrada; solo se purga vencida la retención y con autorización explícita', OLD."periodo"
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "planilla_mensual_proteger_cerrada"
  BEFORE UPDATE OR DELETE ON "planilla_mensual"
  FOR EACH ROW EXECUTE FUNCTION "planilla_mensual_proteger_cerrada"();

CREATE OR REPLACE FUNCTION "planilla_detalle_proteger"() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_planilla_id UUID;
  v_estado "EstadoPlanilla";
BEGIN
  v_planilla_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."planilla_id" ELSE NEW."planilla_id" END;
  SELECT "estado" INTO v_estado FROM "planilla_mensual" WHERE "id" = v_planilla_id;

  IF v_estado = 'CERRADA' THEN
    RAISE EXCEPTION 'PLAN_INMUTABLE: el detalle pertenece a una planilla cerrada'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."planilla_id" <> NEW."planilla_id" THEN
    RAISE EXCEPTION 'PLAN_INMUTABLE: el detalle no puede cambiar de planilla'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "planilla_detalle_proteger"
  BEFORE INSERT OR UPDATE OR DELETE ON "planilla_detalle"
  FOR EACH ROW EXECUTE FUNCTION "planilla_detalle_proteger"();

CREATE OR REPLACE FUNCTION "novedad_planilla_proteger"() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_periodo TEXT;
BEGIN
  v_periodo := CASE WHEN TG_OP = 'DELETE' THEN OLD."periodo" ELSE NEW."periodo" END;
  IF EXISTS (SELECT 1 FROM "planilla_mensual" WHERE "periodo" = v_periodo AND "estado" = 'CERRADA')
     OR (TG_OP = 'UPDATE' AND EXISTS (
       SELECT 1 FROM "planilla_mensual" WHERE "periodo" = OLD."periodo" AND "estado" = 'CERRADA'
     )) THEN
    RAISE EXCEPTION 'PLAN_INMUTABLE: las novedades del periodo % están cerradas', v_periodo
      USING ERRCODE = 'P0001';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "novedad_planilla_proteger"
  BEFORE INSERT OR UPDATE OR DELETE ON "novedad_planilla"
  FOR EACH ROW EXECUTE FUNCTION "novedad_planilla_proteger"();

CREATE OR REPLACE FUNCTION "planilla_bloquear_truncate"() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PLAN_INMUTABLE: TRUNCATE no está permitido sobre el historial de planillas'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER "planilla_mensual_bloquear_truncate"
  BEFORE TRUNCATE ON "planilla_mensual"
  FOR EACH STATEMENT EXECUTE FUNCTION "planilla_bloquear_truncate"();

CREATE TRIGGER "planilla_detalle_bloquear_truncate"
  BEFORE TRUNCATE ON "planilla_detalle"
  FOR EACH STATEMENT EXECUTE FUNCTION "planilla_bloquear_truncate"();
