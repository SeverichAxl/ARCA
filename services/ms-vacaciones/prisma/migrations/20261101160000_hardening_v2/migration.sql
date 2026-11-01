ALTER TABLE saldo_vacaciones ADD CONSTRAINT ck_saldo_no_negativo
  CHECK (dias_asignados >= 0 AND dias_tomados >= 0);

ALTER TABLE solicitud_vacacion ADD CONSTRAINT ck_dias_habiles_positivo
  CHECK (dias_habiles > 0);

REVOKE DELETE ON solicitud_vacacion FROM ms_vacaciones_app;
REVOKE UPDATE, DELETE ON historial_solicitud FROM ms_vacaciones_app;
