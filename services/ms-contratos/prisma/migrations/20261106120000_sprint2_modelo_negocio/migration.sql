-- Sprint 2 (TSK-ARQ-202): modelo de negocio de contratos.
-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('BORRADOR', 'GENERADO', 'EMITIDO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoVersionContrato" AS ENUM ('BORRADOR', 'GENERADO', 'EMITIDO');

-- CreateTable
CREATE TABLE "plantilla_contrato" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "version_actual" INTEGER NOT NULL DEFAULT 1,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantilla_contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantilla_version" (
    "id" UUID NOT NULL,
    "plantilla_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "contenido_html" TEXT NOT NULL,
    "variables_detectadas" JSONB NOT NULL,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantilla_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "plantilla_id" UUID NOT NULL,
    "plantilla_version_id" UUID NOT NULL,
    "estado" "EstadoContrato" NOT NULL DEFAULT 'BORRADOR',
    "fecha_inicio" DATE,
    "observacion" TEXT,
    "empleado_snapshot" JSONB,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_version" (
    "id" UUID NOT NULL,
    "contrato_id" UUID NOT NULL,
    "plantilla_version_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "estado" "EstadoVersionContrato" NOT NULL DEFAULT 'BORRADOR',
    "documento_public_id" TEXT,
    "documento_version" TEXT,
    "documento_mime" TEXT,
    "documento_bytes" INTEGER,
    "hash_sha256" TEXT,
    "firmado_trabajador" BOOLEAN NOT NULL DEFAULT false,
    "firmado_representante" BOOLEAN NOT NULL DEFAULT false,
    "firma_trabajador_ref" TEXT,
    "firma_representante_ref" TEXT,
    "generado_por" UUID NOT NULL,
    "generado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plantilla_contrato_activa_actualizado_en_idx" ON "plantilla_contrato"("activa", "actualizado_en");

-- CreateIndex
CREATE UNIQUE INDEX "plantilla_version_plantilla_id_version_key" ON "plantilla_version"("plantilla_id", "version");

-- CreateIndex
CREATE INDEX "plantilla_version_plantilla_id_creado_en_idx" ON "plantilla_version"("plantilla_id", "creado_en");

-- CreateIndex
CREATE INDEX "contrato_empleado_id_creado_en_idx" ON "contrato"("empleado_id", "creado_en");

-- CreateIndex
CREATE INDEX "contrato_plantilla_id_idx" ON "contrato"("plantilla_id");

-- CreateIndex
CREATE INDEX "contrato_estado_idx" ON "contrato"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_version_contrato_id_version_key" ON "contrato_version"("contrato_id", "version");

-- CreateIndex
CREATE INDEX "contrato_version_contrato_id_generado_en_idx" ON "contrato_version"("contrato_id", "generado_en");

-- AddForeignKey
ALTER TABLE "plantilla_version" ADD CONSTRAINT "plantilla_version_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantilla_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_plantilla_id_fkey" FOREIGN KEY ("plantilla_id") REFERENCES "plantilla_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_plantilla_version_id_fkey" FOREIGN KEY ("plantilla_version_id") REFERENCES "plantilla_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_version" ADD CONSTRAINT "contrato_version_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_version" ADD CONSTRAINT "contrato_version_plantilla_version_id_fkey" FOREIGN KEY ("plantilla_version_id") REFERENCES "plantilla_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
