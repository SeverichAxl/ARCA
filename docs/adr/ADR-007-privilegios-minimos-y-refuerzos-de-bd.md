# ADR-007: Privilegios mínimos y refuerzos de base de datos

Estado: Aceptado · Fecha: 2026-11-01 · Responsable: Arquitecto de Software

## 1. Contexto

Los servicios escriben datos personales, laborales, solicitudes y registros
históricos. RF-05 requiere conservar auditoría; las operaciones sobre saldos y
solicitudes también deben mantener invariantes ante errores de aplicación.
RNF-08 favorece que cada servicio controle su propio esquema. Las decisiones
de BD registran separación de roles y restricciones que deben sobrevivir a
futuras migraciones.

## 2. Decisión

- Crear por servicio un usuario dueño para migraciones y un usuario de runtime
  con privilegios limitados; `DATABASE_URL` usa runtime y `DIRECT_URL` usa el
  dueño.
- Aplicar `REVOKE` de `DELETE` y/o `UPDATE` en tablas históricas, además de
  restricciones `CHECK` numéricas donde corresponda.
- Mantener un índice único parcial para nombres de áreas raíz.
- Generar migraciones solo bajo responsabilidad del arquitecto. Revisar a mano
  las migraciones Prisma porque no representa todos los índices, `CHECK`,
  `REVOKE` y triggers del SQL.
- Ante el riesgo conocido de Prisma, si `migrate dev` propone
  `DROP INDEX uq_area_raiz_nombre`, retirar esa sentencia de la migración
  generada y preservar el índice parcial.

## 3. Alternativas consideradas

1. **Usar el mismo usuario PostgreSQL para migraciones y runtime:** descartado
   porque el servicio en ejecución tendría privilegios de modificación de
   esquema innecesarios.
2. **Confiar únicamente en validaciones de aplicación:** descartado porque un
   error de código o una ruta de escritura alternativa podría violar
   invariantes de datos.
3. **Expresar todas las restricciones solo en `schema.prisma`:** descartado
   porque Prisma no representa el índice parcial ni todos los privilegios,
   triggers y restricciones SQL requeridos.

## 4. Consecuencias

**Positivas**

- El proceso de runtime no necesita privilegios de propietario para migrar.
- Las restricciones se mantienen en la base incluso ante operaciones que
  eviten las validaciones de aplicación.
- El historial de auditoría y las tablas históricas tienen barreras de
  modificación a nivel PostgreSQL.

**Negativas**

- Hay que administrar credenciales y URLs separadas por servicio y entorno.
- El SQL manual exige revisar migraciones generadas y documentación para no
  retirar accidentalmente controles que Prisma no modela.
- `migrate dev` puede proponer eliminar el índice parcial
  `uq_area_raiz_nombre`; ignorar la advertencia sin revisar puede quitar la
  unicidad de áreas raíz.
- La revocación de privilegios limita operaciones correctivas de runtime y
  obliga a diseñarlas como nuevas escrituras o procedimientos controlados.

## 5. Estado de implementación

**Implementado:** `docker/init-scripts` crea roles owner y app por base; los
schemas separan `DATABASE_URL` y `DIRECT_URL`. Las migraciones crean
restricciones numéricas y el índice parcial, y revocan operaciones sobre
tablas históricas. La auditoría de auth tiene `REVOKE` y triggers que bloquean
update, delete y truncate.

**Planificado / pendiente:** mantener el proceso de revisión arquitectónica en
cada migración futura y vigilar las migraciones generadas por Prisma. El índice
parcial no está representado en `schema.prisma`, por lo que su preservación
depende de esa revisión manual.

## 6. Trazabilidad

- **RF / HU:** HU-02 / RF-05 (auditoría), y operaciones de escritura de
  personal y vacaciones.
- **RNF:** RNF-08 y requisitos de integridad y persistencia de datos.
- **API:** [auth y auditoría](../api/auth.md),
  [vacaciones](../api/vacaciones.md),
  [errores](../api/errores.md).
- **BD:** [decisiones de BD](../db/decisiones-bd.md),
  [notas de migraciones](../db/notas-migraciones.md),
  [mejoras pendientes](../db/mejoras-pendientes.md).
- **Migraciones:** [hardening de personal](../../services/ms-personal/prisma/migrations/20261101160000_hardening_v2/migration.sql),
  [hardening de vacaciones](../../services/ms-vacaciones/prisma/migrations/20261101160000_hardening_v2/migration.sql),
  [migración inicial de auth](../../services/ms-auth/prisma/migrations/20261031095211_init/migration.sql).
- **Otros ADR:** [ADR-001](./ADR-001-microservicios-y-hexagonal.md),
  [ADR-003](./ADR-003-autenticacion-rbac-auditoria.md).
