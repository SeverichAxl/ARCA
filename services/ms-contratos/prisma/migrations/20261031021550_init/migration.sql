-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('INDEFINIDO', 'FIJO', 'OBRA_LABOR', 'PRESTACION_SERVICIOS', 'APRENDIZAJE');

-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('VIGENTE', 'SUSPENDIDO', 'TERMINADO');

-- CreateTable
CREATE TABLE "contratos" (
    "id" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "tipo" "TipoContrato" NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "salario" DECIMAL(14,2) NOT NULL,
    "cargo" TEXT,
    "centroCosto" TEXT,
    "estado" "EstadoContrato" NOT NULL DEFAULT 'VIGENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contratos_empleadoId_estado_idx" ON "contratos"("empleadoId", "estado");
