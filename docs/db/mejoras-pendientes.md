# Mejoras pendientes y decisiones

| Ítem                                                  | Estado               | Motivo                                                                                     |
| ----------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| Restricción `EXCLUDE` para traslapes de vacaciones    | Pendiente — Sprint 3 | Requiere `btree_gist`; no cubre licencias.                                                 |
| `aprobado_jefe_por = jefe_empleado_id`                | Diferido             | Confirmar primero la regla del jefe.                                                       |
| Trigger de inamovilidad al registrar una baja         | Descartado           | Se implementará en el servicio (TSK-DEV3-103) con pruebas; el flujo de baja aún no existe. |
| Purga de `outbox_evento` publicados                   | Pendiente — Sprint 3 | La política de retención y purga se implementará en ese sprint.                            |
| Remuneración cifrada no filtrable ni agregable en SQL | Aceptado             | El dashboard descifra en la aplicación; es aceptable por RNF-05 con ~200 empleados.        |

El seed de auth no elimina permisos que dejen de estar en la lista de
`services/ms-auth/prisma/seed.ts`; deben retirarse explícitamente si se desea
limpiar esos permisos obsoletos.
