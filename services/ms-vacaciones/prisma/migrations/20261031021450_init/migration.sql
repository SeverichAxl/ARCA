-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "saldos_vacaciones" (
    "id" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "diasDisponibles" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldos_vacaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_vacaciones" (
    "id" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "dias" DECIMAL(6,2) NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "aprobadoPor" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_vacaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saldos_vacaciones_empleadoId_anio_key" ON "saldos_vacaciones"("empleadoId", "anio");

-- CreateIndex
CREATE INDEX "solicitudes_vacaciones_empleadoId_estado_idx" ON "solicitudes_vacaciones"("empleadoId", "estado");
