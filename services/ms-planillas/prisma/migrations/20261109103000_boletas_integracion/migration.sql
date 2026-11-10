-- Boletas emitidas desde el modelo de nómina reconciliado de Elias.
CREATE TABLE "boleta_pago_nomina" (
  "id" UUID NOT NULL,
  "detalle_id" UUID NOT NULL,
  "empleado_id" UUID NOT NULL,
  "periodo" VARCHAR(7) NOT NULL,
  "hash_sha256" CHAR(64) NOT NULL,
  "documento" BYTEA NOT NULL,
  "firma_incluida" BOOLEAN NOT NULL DEFAULT false,
  "estado" "EstadoBoleta" NOT NULL DEFAULT 'EMITIDA',
  "emitida_por" UUID NOT NULL,
  "emitida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boleta_pago_nomina_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "boleta_pago_nomina_detalle_id_fkey" FOREIGN KEY ("detalle_id")
    REFERENCES "planilla_detalle_nomina"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "boleta_pago_nomina_detalle_id_key"
  ON "boleta_pago_nomina"("detalle_id");
CREATE INDEX "boleta_pago_nomina_empleado_id_periodo_idx"
  ON "boleta_pago_nomina"("empleado_id", "periodo");
CREATE INDEX "boleta_pago_nomina_periodo_emitida_en_idx"
  ON "boleta_pago_nomina"("periodo", "emitida_en");
