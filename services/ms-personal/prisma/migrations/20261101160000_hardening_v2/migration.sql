CREATE UNIQUE INDEX uq_area_raiz_nombre ON area (nombre) WHERE padre_id IS NULL;

REVOKE DELETE ON empleado, historial_laboral, baja, inamovilidad_laboral FROM ms_personal_app;
REVOKE UPDATE ON historial_laboral FROM ms_personal_app;
