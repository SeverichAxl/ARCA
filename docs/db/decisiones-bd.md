# Decisiones de BD y seguridad — Sprint 1 (borrador para aprobación hasta 30/10)

## Cambios respecto al backlog (avisar al equipo)
| Cambio | Afecta a |
|---|---|
| Se pasa de 5 a 7 roles: + `ENCARGADO_NOMINA`, + `AUDITOR` | Laura (RBAC, seed), Luciana (menú por rol) |
| Autorización por **permisos** (`personal:read_salary`, etc.), no por rol en el código. Guard: `@RequirePermission('x:y')` | Laura, todos los controllers |
| `ADMIN_GENERAL` ya NO ratifica, no modifica expedientes, no ve sueldos. Ratificar = `personal:ratify` (solo RRHH_OPERATIVO) | **Elias** (DoD de ratificación en TSK-DEV3-102) |
| RRHH_OPERATIVO ya NO cierra planilla ni emite boletas (eso es ENCARGADO_NOMINA) | Sprint 2 (Dev 1) |
| Auditoría la lee solo `AUDITOR` (antes ADMIN + GERENCIA) | Laura (GET /auditoria), Luciana |
| Refresh token: se guarda el HASH, con rotación y detección de reuso (antes "cifrado") | Laura |
| Bloqueo por 3 intentos = temporal (`bloqueado_hasta`, 15 min). `estado=BLOQUEADO` es solo manual | Laura |
| Nadie aprueba lo suyo (CHECK en BD + validación en servicio) | Jean |
| Se añaden `usuario.empleado_id` y `empleado_ref.jefe_empleado_id` | Laura, Jean |

## Claims del JWT (RS256, `kid` en el header, validar iss/aud/exp)
```json
{ "sub": "<usuarioId>", "empleadoId": "<uuid|null>", "rol": "JEFE_AREA",
  "permisos": ["vacaciones:approve_jefe", "..."], "iss": "arca-auth", "aud": "arca-salar", "exp": 0 }
```
`empleadoId` es lo que permite a cada servicio comprobar propiedad del objeto (un funcionario solo ve lo suyo; un jefe solo su área).

## Convenciones de cifrado
- AES-256-GCM, IV aleatorio por valor. Formato de string: `ivB64.tagB64.cipherB64`. Llave distinta por servicio (`ENC_KEY_PERSONAL`, ...).
- `ci_hash` = HMAC-SHA256(ci normalizado, `CI_HMAC_KEY`). Búsqueda: calcular el hash del CI buscado y `WHERE ci_hash = ...`. Búsqueda por CI solo exacta.
- Auditoría: `payload_json` NO debe contener CI ni sueldos en claro: enmascarar (`"ci": "***1234"`) o cifrar esos campos antes de publicar `AUDITORIA_REGISTRADA`.

## Variables de entorno
```
AUTH_DB_OWNER_PASSWORD= AUTH_DB_APP_PASSWORD=
# Repetir para PERSONAL, VACACIONES, CONTRATOS y PLANILLAS.
```
Compose usa `*_DATABASE_URL` para runtime con host `postgres`; al ejecutar Prisma
localmente, cada `services/ms-*/.env` ignorado por Git define `DATABASE_URL` con el
rol `ms_<svc>_app` y `DIRECT_URL` con `ms_<svc>_owner`, ambos con host `localhost`
y la base `db_<svc>`. `ms-auth` también requiere `SEED_ADMIN_USERNAME` y
`SEED_ADMIN_PASSWORD`.

## Pendiente / no implementado ahora
Maker-checker para cambios de sueldo, cadena de hashes en auditoría, TLS (ADR: requerido en producción; demo local en HTTP).

La fuente de verdad de la matriz de permisos y roles es
[`services/ms-auth/prisma/seed.ts`](../../services/ms-auth/prisma/seed.ts);
editar las tablas manualmente no cambia la matriz y esos cambios se sobrescriben
al ejecutar el seed.

## Refuerzos v2

- `ms-personal`: índice único parcial para nombres de áreas raíz; se revocan
  `DELETE` en empleado, historial laboral, bajas e inamovilidades, y `UPDATE`
  en historial laboral.
- `ms-vacaciones`: CHECK para días de saldo no negativos y días hábiles
  positivos; se revoca `DELETE` en solicitudes y `UPDATE`/`DELETE` en el
  historial de solicitudes.
- La aprobación final de vacaciones debe cambiar estado y descontar saldos y
  registrar el descuento en una sola transacción, con transición condicional
  desde `APROBADO_JEFE`.
- Los detalles de generación y aplicación están en
  [`notas-migraciones.md`](./notas-migraciones.md).
