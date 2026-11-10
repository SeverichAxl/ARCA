-- TSK-DEV2-201 / TSK-ARQ-202: modelo de nómina (HU-20/21/24, RF-23/24/26).
-- DDL generado con prisma migrate diff desde 20261031095304_init.

CREATE TYPE "EstadoPlanilla" AS ENUM ('BORRADOR', 'CERRADA');

CREATE TABLE "parametro_legal" (
    "id" UUID NOT NULL,
    "clave" VARCHAR(60) NOT NULL,
    "valor" DECIMAL(18,6) NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "descripcion" TEXT,
    "creado_por" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parametro_legal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "escala_antiguedad" (
    "id" UUID NOT NULL,
    "anios_desde" INTEGER NOT NULL,
    "anios_hasta" INTEGER,
    "porcentaje" DECIMAL(9,4) NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "creado_por" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "escala_antiguedad_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "planilla" (
    "id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" "EstadoPlanilla" NOT NULL DEFAULT 'BORRADOR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parametros" JSONB NOT NULL,
    "total_empleados" INTEGER NOT NULL,
    "total_ganado" DECIMAL(16,2) NOT NULL,
    "total_aportes_laborales" DECIMAL(16,2) NOT NULL,
    "total_ans" DECIMAL(16,2) NOT NULL,
    "total_rc_iva" DECIMAL(16,2) NOT NULL,
    "total_otros_descuentos" DECIMAL(16,2) NOT NULL,
    "total_liquido" DECIMAL(16,2) NOT NULL,
    "total_aportes_patronales" DECIMAL(16,2) NOT NULL,
    "duracion_ms" INTEGER NOT NULL,
    "calculado_por" UUID NOT NULL,
    "calculado_en" TIMESTAMP(3) NOT NULL,
    "cerrado_por" UUID,
    "cerrado_en" TIMESTAMP(3),
    "retencion_hasta" DATE,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planilla_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "planilla_detalle" (
    "id" UUID NOT NULL,
    "planilla_id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "ci_enmascarado" VARCHAR(30),
    "area_id" UUID NOT NULL,
    "cargo_id" UUID NOT NULL,
    "fecha_ingreso" DATE NOT NULL,
    "haber_basico" DECIMAL(14,2) NOT NULL,
    "dias_trabajados" INTEGER NOT NULL,
    "haber_ganado" DECIMAL(14,2) NOT NULL,
    "anios_antiguedad" INTEGER NOT NULL,
    "porcentaje_bono" DECIMAL(9,4) NOT NULL,
    "bono_antiguedad" DECIMAL(14,2) NOT NULL,
    "otros_ingresos" DECIMAL(14,2) NOT NULL,
    "total_ganado" DECIMAL(14,2) NOT NULL,
    "aporte_laboral" DECIMAL(14,2) NOT NULL,
    "ans" DECIMAL(14,2) NOT NULL,
    "rc_iva_base_imponible" DECIMAL(14,2) NOT NULL,
    "rc_iva_impuesto" DECIMAL(14,2) NOT NULL,
    "rc_iva_computable" DECIMAL(14,2) NOT NULL,
    "rc_iva_saldo_anterior" DECIMAL(14,2) NOT NULL,
    "rc_iva_saldo_siguiente" DECIMAL(14,2) NOT NULL,
    "rc_iva" DECIMAL(14,2) NOT NULL,
    "otros_descuentos" DECIMAL(14,2) NOT NULL,
    "total_descuentos" DECIMAL(14,2) NOT NULL,
    "liquido_pagable" DECIMAL(14,2) NOT NULL,
    "aporte_patronal" DECIMAL(14,2) NOT NULL,
    "subsidios" JSONB NOT NULL DEFAULT '{}',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planilla_detalle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "configuracion_planillas" (
    "clave" VARCHAR(60) NOT NULL,
    "valor" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configuracion_planillas_pkey" PRIMARY KEY ("clave")
);

CREATE UNIQUE INDEX "parametro_legal_clave_vigente_desde_key" ON "parametro_legal"("clave", "vigente_desde");
CREATE UNIQUE INDEX "escala_antiguedad_vigente_desde_anios_desde_key" ON "escala_antiguedad"("vigente_desde", "anios_desde");
CREATE UNIQUE INDEX "novedad_planilla_periodo_empleado_id_key" ON "novedad_planilla"("periodo", "empleado_id");
CREATE UNIQUE INDEX "planilla_periodo_key" ON "planilla"("periodo");
CREATE INDEX "planilla_anio_mes_idx" ON "planilla"("anio", "mes");
CREATE INDEX "planilla_estado_idx" ON "planilla"("estado");
CREATE INDEX "planilla_detalle_empleado_id_idx" ON "planilla_detalle"("empleado_id");
CREATE INDEX "planilla_detalle_planilla_id_area_id_idx" ON "planilla_detalle"("planilla_id", "area_id");
CREATE UNIQUE INDEX "planilla_detalle_planilla_id_empleado_id_key" ON "planilla_detalle"("planilla_id", "empleado_id");

ALTER TABLE "planilla_detalle"
  ADD CONSTRAINT "planilla_detalle_planilla_id_fkey"
  FOREIGN KEY ("planilla_id") REFERENCES "planilla"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parametro_legal"
  ADD CONSTRAINT "parametro_legal_valor_no_negativo" CHECK ("valor" >= 0),
  ADD CONSTRAINT "parametro_legal_clave_formato" CHECK ("clave" ~ '^[A-Z0-9_]{2,60}$');

ALTER TABLE "escala_antiguedad"
  ADD CONSTRAINT "escala_antiguedad_rango" CHECK (
    "anios_desde" >= 0 AND ("anios_hasta" IS NULL OR "anios_hasta" >= "anios_desde")
  ),
  ADD CONSTRAINT "escala_antiguedad_porcentaje" CHECK ("porcentaje" >= 0 AND "porcentaje" <= 100);

ALTER TABLE "novedad_planilla"
  ADD CONSTRAINT "novedad_planilla_periodo_formato" CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "novedad_planilla_dias" CHECK ("dias_trabajados" IS NULL OR "dias_trabajados" BETWEEN 0 AND 30),
  ADD CONSTRAINT "novedad_planilla_importes" CHECK (
    "otros_ingresos" >= 0 AND "otros_descuentos" >= 0 AND "rc_iva_computable" >= 0
  );

ALTER TABLE "planilla"
  ADD CONSTRAINT "planilla_periodo_formato" CHECK ("periodo" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "planilla_periodo_coherente" CHECK ("periodo" = "anio"::text || '-' || lpad("mes"::text, 2, '0')),
  ADD CONSTRAINT "planilla_totales_no_negativos" CHECK (
    "total_empleados" >= 0 AND "total_ganado" >= 0 AND "total_aportes_laborales" >= 0
    AND "total_ans" >= 0 AND "total_rc_iva" >= 0 AND "total_otros_descuentos" >= 0
    AND "total_liquido" >= 0 AND "total_aportes_patronales" >= 0 AND "duracion_ms" >= 0
  ),
  ADD CONSTRAINT "planilla_cierre_completo" CHECK (
    ("estado" = 'BORRADOR' AND "cerrado_por" IS NULL AND "cerrado_en" IS NULL AND "retencion_hasta" IS NULL)
    OR ("estado" = 'CERRADA' AND "cerrado_por" IS NOT NULL AND "cerrado_en" IS NOT NULL AND "retencion_hasta" IS NOT NULL)
  );

ALTER TABLE "planilla_detalle"
  ADD CONSTRAINT "planilla_detalle_dias" CHECK ("dias_trabajados" BETWEEN 0 AND 30),
  ADD CONSTRAINT "planilla_detalle_importes_no_negativos" CHECK (
    "haber_basico" >= 0 AND "haber_ganado" >= 0 AND "bono_antiguedad" >= 0 AND "otros_ingresos" >= 0
    AND "total_ganado" >= 0 AND "aporte_laboral" >= 0 AND "ans" >= 0 AND "rc_iva_base_imponible" >= 0
    AND "rc_iva_impuesto" >= 0 AND "rc_iva_computable" >= 0 AND "rc_iva_saldo_anterior" >= 0
    AND "rc_iva_saldo_siguiente" >= 0 AND "rc_iva" >= 0 AND "otros_descuentos" >= 0
    AND "total_descuentos" >= 0 AND "liquido_pagable" >= 0 AND "aporte_patronal" >= 0
  ),
  ADD CONSTRAINT "planilla_detalle_cuadre" CHECK (
    "total_ganado" = "haber_ganado" + "bono_antiguedad" + "otros_ingresos"
    AND "total_descuentos" = "aporte_laboral" + "ans" + "rc_iva" + "otros_descuentos"
    AND "liquido_pagable" = "total_ganado" - "total_descuentos"
  );

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

CREATE OR REPLACE FUNCTION "planilla_proteger_cerrada"() RETURNS TRIGGER
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

CREATE TRIGGER "planilla_proteger_cerrada"
  BEFORE UPDATE OR DELETE ON "planilla"
  FOR EACH ROW EXECUTE FUNCTION "planilla_proteger_cerrada"();

CREATE OR REPLACE FUNCTION "planilla_detalle_proteger"() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_planilla_id UUID;
  v_estado "EstadoPlanilla";
  v_retencion DATE;
BEGIN
  v_planilla_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."planilla_id" ELSE NEW."planilla_id" END;
  SELECT "estado", "retencion_hasta" INTO v_estado, v_retencion
    FROM "planilla" WHERE "id" = v_planilla_id;

  IF v_estado = 'CERRADA'
     AND NOT (TG_OP = 'DELETE' AND "planilla_purga_autorizada"(v_retencion)) THEN
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
  IF EXISTS (SELECT 1 FROM "planilla" WHERE "periodo" = v_periodo AND "estado" = 'CERRADA')
     OR (TG_OP = 'UPDATE' AND EXISTS (
       SELECT 1 FROM "planilla" WHERE "periodo" = OLD."periodo" AND "estado" = 'CERRADA'
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

CREATE TRIGGER "planilla_bloquear_truncate"
  BEFORE TRUNCATE ON "planilla"
  FOR EACH STATEMENT EXECUTE FUNCTION "planilla_bloquear_truncate"();

CREATE TRIGGER "planilla_detalle_bloquear_truncate"
  BEFORE TRUNCATE ON "planilla_detalle"
  FOR EACH STATEMENT EXECUTE FUNCTION "planilla_bloquear_truncate"();
