-- CreateEnum
CREATE TYPE "EstadoPlanilla" AS ENUM ('BORRADOR', 'CALCULADA', 'APROBADA', 'PAGADA', 'ANULADA');

-- CreateTable
CREATE TABLE "planillas" (
    "id" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPlanilla" NOT NULL DEFAULT 'BORRADOR',
    "totalBruto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDeducciones" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNeto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_planillas" (
    "id" UUID NOT NULL,
    "planillaId" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "salarioBase" DECIMAL(14,2) NOT NULL,
    "deducciones" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netoPagar" DECIMAL(14,2) NOT NULL,
    "conceptos" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detalle_planillas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planillas_periodo_key" ON "planillas"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "detalle_planillas_planillaId_empleadoId_key" ON "detalle_planillas"("planillaId", "empleadoId");

-- AddForeignKey
ALTER TABLE "detalle_planillas" ADD CONSTRAINT "detalle_planillas_planillaId_fkey" FOREIGN KEY ("planillaId") REFERENCES "planillas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
