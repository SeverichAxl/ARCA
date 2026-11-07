-- Sprint 2 (TSK-ARQ-202): modelo de nómina, parámetros legales, boletas e historial.
-- CreateEnum
CREATE TYPE "TipoParametroLegal" AS ENUM ('SMN', 'APORTE_LABORAL', 'APORTE_PATRONAL', 'BONO_ANTIGUEDAD', 'RC_IVA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPlanilla" AS ENUM ('BORRADOR', 'EN_PROCESO', 'CALCULADA', 'CERRADA', 'ERROR');

-- CreateEnum
CREATE TYPE "EstadoBoleta" AS ENUM ('EMITIDA', 'ANULADA');

-- CreateTable
CREATE TABLE "parametro_legal" (
    "id" UUID NOT NULL,
    "tipo" "TipoParametroLegal" NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" DECIMAL(14,4) NOT NULL,
    "unidad" TEXT,
    "metadata" JSONB,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametro_legal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planilla_mensual" (
    "id" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" "EstadoPlanilla" NOT NULL DEFAULT 'BORRADOR',
    "total_empleados" INTEGER NOT NULL DEFAULT 0,
    "total_ganado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_aportes_lab" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_aportes_pat" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_liquido" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observacion" TEXT,
    "procesada_por" UUID,
    "procesada_en" TIMESTAMP(3),
    "cerrada_por" UUID,
    "cerrada_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planilla_mensual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planilla_detalle" (
    "id" UUID NOT NULL,
    "planilla_id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "ci_hash_ref" TEXT,
    "haber_basico" DECIMAL(14,2) NOT NULL,
    "total_ganado" DECIMAL(14,2) NOT NULL,
    "bono_antiguedad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aporte_laboral" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "aporte_patronal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ans" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rc_iva_computable" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "rc_iva_editado_por" UUID,
    "rc_iva_editado_en" TIMESTAMP(3),
    "rc_iva_observacion" TEXT,
    "liquido_pagable" DECIMAL(14,2) NOT NULL,
    "subsidios_info" JSONB,
    "calculo_snapshot" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planilla_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boleta_pago" (
    "id" UUID NOT NULL,
    "planilla_id" UUID NOT NULL,
    "detalle_id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "liquido_pagable" DECIMAL(14,2) NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "hash_formula_version" INTEGER NOT NULL DEFAULT 1,
    "estado" "EstadoBoleta" NOT NULL DEFAULT 'EMITIDA',
    "documento_public_id" TEXT,
    "documento_version" TEXT,
    "documento_mime" TEXT,
    "firma_grafica_ref" TEXT,
    "emitida_por" UUID NOT NULL,
    "emitida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boleta_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parametro_legal_tipo_clave_vigente_desde_idx" ON "parametro_legal"("tipo", "clave", "vigente_desde");

-- CreateIndex
CREATE INDEX "parametro_legal_activo_vigente_desde_vigente_hasta_idx" ON "parametro_legal"("activo", "vigente_desde", "vigente_hasta");

-- CreateIndex
CREATE UNIQUE INDEX "planilla_mensual_periodo_key" ON "planilla_mensual"("periodo");

-- CreateIndex
CREATE INDEX "planilla_mensual_estado_periodo_idx" ON "planilla_mensual"("estado", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "planilla_detalle_planilla_id_empleado_id_key" ON "planilla_detalle"("planilla_id", "empleado_id");

-- CreateIndex
CREATE INDEX "planilla_detalle_empleado_id_creado_en_idx" ON "planilla_detalle"("empleado_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "boleta_pago_detalle_id_key" ON "boleta_pago"("detalle_id");

-- CreateIndex
CREATE INDEX "boleta_pago_empleado_id_periodo_idx" ON "boleta_pago"("empleado_id", "periodo");

-- CreateIndex
CREATE INDEX "boleta_pago_planilla_id_emitida_en_idx" ON "boleta_pago"("planilla_id", "emitida_en");

-- AddForeignKey
ALTER TABLE "planilla_detalle" ADD CONSTRAINT "planilla_detalle_planilla_id_fkey" FOREIGN KEY ("planilla_id") REFERENCES "planilla_mensual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleta_pago" ADD CONSTRAINT "boleta_pago_planilla_id_fkey" FOREIGN KEY ("planilla_id") REFERENCES "planilla_mensual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleta_pago" ADD CONSTRAINT "boleta_pago_detalle_id_fkey" FOREIGN KEY ("detalle_id") REFERENCES "planilla_detalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
