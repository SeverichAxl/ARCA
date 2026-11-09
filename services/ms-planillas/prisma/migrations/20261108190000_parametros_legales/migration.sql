CREATE TYPE "TipoParametroLegal" AS ENUM ('SALARIO_MINIMO_NACIONAL', 'APORTE_LABORAL', 'APORTE_PATRONAL');

CREATE TABLE "parametro_legal" (
  "id" UUID NOT NULL,
  "tipo" "TipoParametroLegal" NOT NULL,
  "valor" DECIMAL(14,4) NOT NULL,
  "vigencia_desde" DATE NOT NULL,
  "vigencia_hasta" DATE,
  "descripcion" TEXT,
  "creado_por" UUID NOT NULL,
  "actualizado_por" UUID NOT NULL,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parametro_legal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "parametro_legal_rango_check" CHECK ("vigencia_hasta" IS NULL OR "vigencia_hasta" >= "vigencia_desde"),
  CONSTRAINT "parametro_legal_valor_check" CHECK ("valor" >= 0)
);
CREATE UNIQUE INDEX "parametro_legal_tipo_vigencia_desde_key" ON "parametro_legal"("tipo", "vigencia_desde");
CREATE INDEX "parametro_legal_tipo_vigencia_desde_vigencia_hasta_idx" ON "parametro_legal"("tipo", "vigencia_desde", "vigencia_hasta");

CREATE TABLE "escala_bono_antiguedad" (
  "id" UUID NOT NULL,
  "anios_desde" INTEGER NOT NULL,
  "anios_hasta" INTEGER,
  "porcentaje" DECIMAL(7,4) NOT NULL,
  "vigencia_desde" DATE NOT NULL,
  "vigencia_hasta" DATE,
  "creado_por" UUID NOT NULL,
  "actualizado_por" UUID NOT NULL,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "escala_bono_antiguedad_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "escala_bono_anios_check" CHECK ("anios_desde" >= 0 AND ("anios_hasta" IS NULL OR "anios_hasta" >= "anios_desde")),
  CONSTRAINT "escala_bono_porcentaje_check" CHECK ("porcentaje" >= 0),
  CONSTRAINT "escala_bono_vigencia_check" CHECK ("vigencia_hasta" IS NULL OR "vigencia_hasta" >= "vigencia_desde")
);
CREATE UNIQUE INDEX "escala_bono_antiguedad_anios_desde_vigencia_desde_key" ON "escala_bono_antiguedad"("anios_desde", "vigencia_desde");
CREATE INDEX "escala_bono_antiguedad_vigencia_desde_vigencia_hasta_idx" ON "escala_bono_antiguedad"("vigencia_desde", "vigencia_hasta");
