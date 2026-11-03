ALTER TABLE "saldo_vacaciones"
ADD COLUMN "dias_excepcion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "saldo_vacaciones"
ADD CONSTRAINT "ck_saldo_dias_excepcion_no_negativo"
CHECK ("dias_excepcion" >= 0);
