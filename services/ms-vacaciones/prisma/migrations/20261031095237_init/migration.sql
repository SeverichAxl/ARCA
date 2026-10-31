-- CreateEnum
CREATE TYPE "EstadoEmpleadoRef" AS ENUM ('EN_PRUEBA', 'RATIFICADO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE_JEFE', 'APROBADO_JEFE', 'APROBADO_FINAL', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoExcepcion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "AmbitoFeriado" AS ENUM ('NACIONAL', 'DEPARTAMENTAL');

-- CreateEnum
CREATE TYPE "TipoLicencia" AS ENUM ('PATERNIDAD', 'MATRIMONIO', 'LUTO', 'ADOPCION', 'MAMOGRAFIA_PAPANICOLAU', 'PROSTATICO');

-- CreateEnum
CREATE TYPE "EstadoLicencia" AS ENUM ('PENDIENTE', 'AUTORIZADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "empleado_ref" (
    "empleado_id" UUID NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "area_id" UUID NOT NULL,
    "jefe_empleado_id" UUID,
    "estado" "EstadoEmpleadoRef" NOT NULL,
    "fecha_ingreso" DATE NOT NULL,
    "fecha_baja" DATE,
    "ultimo_evento_en" TIMESTAMP(3) NOT NULL,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleado_ref_pkey" PRIMARY KEY ("empleado_id")
);

-- CreateTable
CREATE TABLE "saldo_vacaciones" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "gestion" INTEGER NOT NULL,
    "dias_asignados" INTEGER NOT NULL,
    "dias_tomados" INTEGER NOT NULL DEFAULT 0,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saldo_vacaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_vacacion" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "dias_habiles" INTEGER NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE_JEFE',
    "jefe_empleado_id" UUID,
    "aprobado_jefe_por" UUID,
    "aprobado_jefe_en" TIMESTAMP(3),
    "aprobado_rrhh_por" UUID,
    "aprobado_rrhh_en" TIMESTAMP(3),
    "motivo_rechazo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitud_vacacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "descuento_saldo" (
    "id" UUID NOT NULL,
    "solicitud_id" UUID NOT NULL,
    "saldo_id" UUID NOT NULL,
    "dias" INTEGER NOT NULL,

    CONSTRAINT "descuento_saldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_solicitud" (
    "id" UUID NOT NULL,
    "solicitud_id" UUID NOT NULL,
    "desde" "EstadoSolicitud",
    "hacia" "EstadoSolicitud" NOT NULL,
    "actor_usuario_id" UUID NOT NULL,
    "comentario" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_excepcion" (
    "id" UUID NOT NULL,
    "solicitud_id" UUID NOT NULL,
    "dias_excedentes" INTEGER NOT NULL,
    "justificacion" TEXT NOT NULL,
    "estado" "EstadoExcepcion" NOT NULL DEFAULT 'PENDIENTE',
    "resuelto_por" UUID,
    "resuelto_en" TIMESTAMP(3),
    "comentario" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_excepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licencia" (
    "id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "tipo" "TipoLicencia" NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "estado" "EstadoLicencia" NOT NULL DEFAULT 'PENDIENTE',
    "respaldo_public_id" TEXT,
    "autorizado_por" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feriado" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" TEXT NOT NULL,
    "ambito" "AmbitoFeriado" NOT NULL DEFAULT 'NACIONAL',
    "departamento" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_vacaciones" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_vacaciones_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "evento_procesado" (
    "event_id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "procesado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_procesado_pkey" PRIMARY KEY ("event_id")
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

-- CreateIndex
CREATE INDEX "empleado_ref_area_id_idx" ON "empleado_ref"("area_id");

-- CreateIndex
CREATE INDEX "empleado_ref_jefe_empleado_id_idx" ON "empleado_ref"("jefe_empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "saldo_vacaciones_empleado_id_gestion_key" ON "saldo_vacaciones"("empleado_id", "gestion");

-- CreateIndex
CREATE INDEX "solicitud_vacacion_empleado_id_estado_idx" ON "solicitud_vacacion"("empleado_id", "estado");

-- CreateIndex
CREATE INDEX "solicitud_vacacion_jefe_empleado_id_estado_idx" ON "solicitud_vacacion"("jefe_empleado_id", "estado");

-- CreateIndex
CREATE INDEX "solicitud_vacacion_fecha_inicio_fecha_fin_idx" ON "solicitud_vacacion"("fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE INDEX "descuento_saldo_solicitud_id_idx" ON "descuento_saldo"("solicitud_id");

-- CreateIndex
CREATE INDEX "historial_solicitud_solicitud_id_idx" ON "historial_solicitud"("solicitud_id");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_excepcion_solicitud_id_key" ON "solicitud_excepcion"("solicitud_id");

-- CreateIndex
CREATE INDEX "licencia_empleado_id_fecha_inicio_fecha_fin_idx" ON "licencia"("empleado_id", "fecha_inicio", "fecha_fin");

-- CreateIndex
CREATE UNIQUE INDEX "feriado_fecha_ambito_departamento_key" ON "feriado"("fecha", "ambito", "departamento");

-- CreateIndex
CREATE INDEX "outbox_evento_publicado_en_occurred_on_idx" ON "outbox_evento"("publicado_en", "occurred_on");

-- AddForeignKey
ALTER TABLE "saldo_vacaciones" ADD CONSTRAINT "saldo_vacaciones_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado_ref"("empleado_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_vacacion" ADD CONSTRAINT "solicitud_vacacion_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado_ref"("empleado_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descuento_saldo" ADD CONSTRAINT "descuento_saldo_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud_vacacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "descuento_saldo" ADD CONSTRAINT "descuento_saldo_saldo_id_fkey" FOREIGN KEY ("saldo_id") REFERENCES "saldo_vacaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_solicitud" ADD CONSTRAINT "historial_solicitud_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud_vacacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_excepcion" ADD CONSTRAINT "solicitud_excepcion_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud_vacacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencia" ADD CONSTRAINT "licencia_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado_ref"("empleado_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE solicitud_vacacion ADD CONSTRAINT ck_no_autoaprobacion_jefe
  CHECK (aprobado_jefe_por IS NULL OR aprobado_jefe_por <> empleado_id);
ALTER TABLE solicitud_vacacion ADD CONSTRAINT ck_no_autoaprobacion_rrhh
  CHECK (aprobado_rrhh_por IS NULL OR aprobado_rrhh_por <> empleado_id);
ALTER TABLE solicitud_vacacion ADD CONSTRAINT ck_fechas_validas CHECK (fecha_fin >= fecha_inicio);

CREATE OR REPLACE FUNCTION excepcion_no_autoresuelta() RETURNS trigger AS $$
BEGIN
  IF NEW.resuelto_por IS NOT NULL AND NEW.resuelto_por = (SELECT empleado_id FROM solicitud_vacacion WHERE id = NEW.solicitud_id) THEN
    RAISE EXCEPTION 'Nadie puede resolver su propia solicitud de excepción';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_excepcion_no_autoresuelta BEFORE INSERT OR UPDATE ON solicitud_excepcion
  FOR EACH ROW EXECUTE FUNCTION excepcion_no_autoresuelta();
