-- HU-19 / RF-22: metadatos inmutables de cada firma gráfica por versión.
ALTER TABLE "contrato_version"
  ADD COLUMN "firma_trabajador_version" TEXT,
  ADD COLUMN "firma_trabajador_mime" TEXT,
  ADD COLUMN "firma_trabajador_bytes" INTEGER,
  ADD COLUMN "firma_representante_version" TEXT,
  ADD COLUMN "firma_representante_mime" TEXT,
  ADD COLUMN "firma_representante_bytes" INTEGER;
