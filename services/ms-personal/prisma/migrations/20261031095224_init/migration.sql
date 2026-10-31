-- CreateEnum
CREATE TYPE "EstadoEmpleado" AS ENUM ('EN_PRUEBA', 'RATIFICADO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "TipoInamovilidad" AS ENUM ('GESTACION', 'PROGENITOR', 'DISCAPACIDAD', 'TUTOR_DISCAPACIDAD');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ALTA', 'CAMBIO_AREA', 'CAMBIO_CARGO', 'CAMBIO_REMUNERACION', 'RATIFICACION', 'BAJA');

-- CreateTable
CREATE TABLE "area" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "padre_id" UUID,
    "jefe_id" UUID,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleado" (
    "id" UUID NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "ci_cifrado" TEXT NOT NULL,
    "ci_hash" TEXT NOT NULL,
    "ci_expedido" TEXT,
    "fecha_nacimiento" DATE,
    "es_extranjero" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "area_id" UUID NOT NULL,
    "cargo_id" UUID NOT NULL,
    "remuneracion_cifrada" TEXT NOT NULL,
    "fecha_ingreso" DATE NOT NULL,
    "dias_prueba" INTEGER NOT NULL DEFAULT 90,
    "estado" "EstadoEmpleado" NOT NULL DEFAULT 'EN_PRUEBA',
    "fecha_ratificacion" DATE,
    "firma_public_id" TEXT NOT NULL,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_laboral" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "fecha_efectiva" DATE NOT NULL,
    "motivo" TEXT,
    "area_anterior_id" UUID,
    "area_nueva_id" UUID,
    "cargo_anterior_id" UUID,
    "cargo_nuevo_id" UUID,
    "remuneracion_anterior_cifrada" TEXT,
    "remuneracion_nueva_cifrada" TEXT,
    "registrado_por" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_laboral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inamovilidad_laboral" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "tipo" "TipoInamovilidad" NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "estado_activo" BOOLEAN NOT NULL DEFAULT true,
    "respaldo_public_id" TEXT,
    "observacion" TEXT,
    "registrado_por" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inamovilidad_laboral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baja" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "fecha_baja" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "aplica_desahucio" BOOLEAN NOT NULL DEFAULT false,
    "autorizacion_mt_public_id" TEXT,
    "sueldo_promedio_cifrado" TEXT NOT NULL,
    "finiquito_total_cifrado" TEXT NOT NULL,
    "finiquito_detalle_cifrado" TEXT NOT NULL,
    "registrado_por" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_evento" (
    "id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_on" TIMESTAMP(3) NOT NULL,
    "publicado_en" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "outbox_evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_personal" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_personal_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "area_padre_id_idx" ON "area"("padre_id");

-- CreateIndex
CREATE INDEX "area_jefe_id_idx" ON "area"("jefe_id");

-- CreateIndex
CREATE UNIQUE INDEX "area_nombre_padre_id_key" ON "area"("nombre", "padre_id");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_nombre_key" ON "cargo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "empleado_ci_hash_key" ON "empleado"("ci_hash");

-- CreateIndex
CREATE INDEX "empleado_area_id_idx" ON "empleado"("area_id");

-- CreateIndex
CREATE INDEX "empleado_cargo_id_idx" ON "empleado"("cargo_id");

-- CreateIndex
CREATE INDEX "empleado_estado_idx" ON "empleado"("estado");

-- CreateIndex
CREATE INDEX "empleado_apellidos_nombres_idx" ON "empleado"("apellidos", "nombres");

-- CreateIndex
CREATE INDEX "historial_laboral_empleado_id_fecha_efectiva_idx" ON "historial_laboral"("empleado_id", "fecha_efectiva");

-- CreateIndex
CREATE INDEX "inamovilidad_laboral_empleado_id_estado_activo_idx" ON "inamovilidad_laboral"("empleado_id", "estado_activo");

-- CreateIndex
CREATE UNIQUE INDEX "baja_empleado_id_key" ON "baja"("empleado_id");

-- CreateIndex
CREATE INDEX "outbox_evento_publicado_en_occurred_on_idx" ON "outbox_evento"("publicado_en", "occurred_on");

-- AddForeignKey
ALTER TABLE "area" ADD CONSTRAINT "area_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area" ADD CONSTRAINT "area_jefe_id_fkey" FOREIGN KEY ("jefe_id") REFERENCES "empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_laboral" ADD CONSTRAINT "historial_laboral_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inamovilidad_laboral" ADD CONSTRAINT "inamovilidad_laboral_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baja" ADD CONSTRAINT "baja_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
