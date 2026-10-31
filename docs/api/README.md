# Borrador v1 para aprobación

Contratos de API y eventos del Sprint 1 de ARCA Ltda. Este documento define las
rutas públicas del gateway y las rutas internas de cada servicio. Es un contrato
de trabajo, no evidencia de que los endpoints ya estén implementados.

## Índice

- [Convenciones transversales](#convenciones-transversales)
- [Documentos](#documentos)
- [Historia/RF -> endpoint](#historiarf---endpoint)
- [Supuestos](#supuestos)
- [Cambios respecto al backlog](#cambios-respecto-al-backlog)
- [Preguntas abiertas para el arquitecto](#preguntas-abiertas-para-el-arquitecto)

## Convenciones transversales

### Enrutamiento y autenticación

Todo acceso externo pasa por el API Gateway y usa el prefijo `/api`. El gateway
retira ese prefijo al reenviar la solicitud: por ejemplo,
`GET /api/personal/employees` se enruta a `GET /employees` en ms-personal.
Los servicios no exponen `/api` como parte de su ruta interna.

Las rutas de negocio protegidas reciben `Authorization: Bearer <access>`. El
gateway verifica la firma JWT RS256, `kid` del header, `iss`, `aud` y `exp`.
Claims contractuales: `sub` (usuarioId), `empleadoId` (UUID o `null` para
cuentas técnicas), `rol`, `permisos`, `iss=arca-auth`, `aud=arca-salar` y
`exp` (epoch en segundos). `familyId` no es claim: solo existe en
`refresh_token`.

El gateway autentica y reenvía estas cabeceras internas firmadas:

| Cabecera | Contenido |
|---|---|
| `X-User-Id` | `sub` del JWT |
| `X-Empleado-Id` | `empleadoId`; representación de `null` pendiente de confirmar |
| `X-Rol` | Código de rol |
| `X-Permisos` | Permisos del token; formato de serialización pendiente de confirmar |
| `X-Timestamp` | Instante de firma |
| `X-Internal-Signature` | HMAC-SHA256 con `INTERNAL_HMAC_KEY` sobre los demás valores firmados, incluido el timestamp |

Cada servicio vuelve a verificar la firma y la tolerancia de 60 segundos antes
de confiar en cualquiera de esas cabeceras. No confía en cabeceras de identidad
no firmadas ni solo en la validación del gateway. La canonización y el orden
exacto de los bytes firmados deben ser idénticos en gateway y servicios.

### Autorización y propiedad

- Cada endpoint protegido declara uno o más códigos exactos existentes en el
  seed de ms-auth. No se asigna autorización por nombre de rol en código.
- La autorización se comprueba en gateway y, obligatoriamente, otra vez en cada
  servicio.
- Un funcionario solo puede leer o modificar sus propios recursos, según la
  operación. Un jefe solo puede leer o aprobar recursos de su área; en
  vacaciones, la relación se valida localmente con
  `empleado_ref.jefe_empleado_id == empleadoId` del token, además del snapshot
  de jefe de la solicitud cuando aplique.
- Si el recurso existe pero pertenece a otro funcionario o área, responder
  `404 NOT_FOUND`, no `403`. `403 FORBIDDEN` queda para permiso ausente.
- Las entradas aplican whitelist explícita; campos no permitidos se rechazan.
  No se hace mass assignment.
- `personal:read_salary` habilita serializar remuneraciones y datos derivados
  de sueldo/finiquito; sin ese permiso dichos campos no aparecen en la
  respuesta.

### Paginación y errores

Listados aceptan `?page=1&pageSize=20` y responden
`{ "data": [], "meta": { "page": 1, "pageSize": 20, "total": 0 } }`.
El máximo permitido para `pageSize` queda propuesto en 100, a confirmar.

Todas las respuestas de error usan
`{ "statusCode": 400, "code": "VALIDATION_ERROR", "message": "...", "details": {}, "traceId": "..." }`.
`details` es opcional; `traceId` siempre está presente. El catálogo y los
status HTTP están en [errores.md](./errores.md).

### Auditoría y datos sensibles

Las acciones sensibles generan la acción de auditoría indicada en cada endpoint
y se publican como `AUDITORIA_REGISTRADA`. Los intentos fallidos de login y los
rechazos `403` también se auditan. Antes de guardar `payload_json` o publicar el
evento, CI se enmascara como `"***1234"` (solo últimos cuatro dígitos);
`remuneracion*`, `password*` y `token*` se enmascaran como `"***"` y nunca se
publican en claro. Aplicar la regla también a estructuras anidadas.

## Documentos

| Documento | Contenido |
|---|---|
| [auth.md](./auth.md) | Login, sesiones, usuarios, RBAC, auditoría y configuración del sistema |
| [personal.md](./personal.md) | Empleados, salario, bajas, inamovilidad, áreas, cargos y organigrama |
| [vacaciones.md](./vacaciones.md) | Saldos, solicitudes, aprobaciones, excepciones, licencias y feriados |
| [errores.md](./errores.md) | Contrato común de errores |
| [eventos.md](./eventos.md) | Sobre, topología, payloads, Outbox e idempotencia |

## Historia/RF -> endpoint

Las rutas de la tabla son las públicas del gateway. El documento de cada
módulo incluye el permiso, la propiedad, el body, las respuestas, errores y
acción de auditoría de cada operación.

| Historia / RF | Cobertura contractual |
|---|---|
| HU-01 / RF-01, RF-02 | `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` |
| HU-01 / RF-03 | Protección por permiso declarada en cada endpoint; `/api/auth/roles` y `/api/auth/permisos` usan `usuario:assign_role` |
| HU-03 / RF-04 | `/api/auth/usuarios` y operaciones de estado/rol/vínculo |
| HU-02 / RF-05 | `/api/auth/auditoria` y evento `AUDITORIA_REGISTRADA` |
| HU-04 / RF-06 | `/api/personal/employees` |
| HU-05 / RF-07 | `/api/personal/employees/:id` y `/ratificar` |
| HU-06 / RF-08 | `/api/personal/employees/:id/baja` |
| HU-07 / RF-09 | `/api/personal/employees` y `/employees/:id` |
| HU-08 / RF-10 | `/api/personal/areas` y `/api/personal/cargos` |
| HU-09 / RF-12 | `/api/personal/areas/tree` |
| HU-11 / RF-11 | `/api/personal/employees/:id/historial` |
| HU-10 / RF-13, RF-30 | Eventos de empleado y `AREA_ACTUALIZADA`; detalle en [eventos.md](./eventos.md) |
| HU-05 a HU-07 / RF-14 | Elegibilidad en `/api/vacaciones/saldo` y validación de `/solicitudes` |
| HU-12 / RF-15, RF-16 | `/api/vacaciones/saldo` y `/api/vacaciones/solicitudes` |
| HU-13 / RF-17 | `/api/vacaciones/solicitudes/:id/aprobar-jefe`, `aprobar-rrhh`, `rechazar`, `cancelar` y excepción |
| HU-14 / RF-18 | `/api/vacaciones/calendario` (supuesto de alcance, pendiente de confirmar) |
| RF-19 | `/api/vacaciones/feriados` y `/api/vacaciones/configuracion` |

## Supuestos

1. Las fechas laborales (`fechaIngreso`, fechas de solicitud y feriados) se
   transportan como `YYYY-MM-DD`; `occurredOn` y marcas de auditoría son ISO
   8601 UTC.
2. El límite propuesto para la firma del empleado es 5 MiB. Se valida extensión,
   MIME declarado y firma mágica PNG/JPEG; el MIME declarado por sí solo no
   acredita el tipo real. Para autorización ministerial se propone PDF de hasta
   10 MiB.
3. La paginación usa `pageSize=20` por defecto y máximo propuesto de 100.
4. **SUPUESTO A CONFIRMAR:** el jefe de un funcionario es el jefe de su área; si
   el funcionario es el propio jefe, su solicitud la aprueba el jefe del área
   padre; si no hay, pasa directamente a RRHH.
5. Se ofrece `GET /vacaciones/calendario` para RF-18 con datos agregados de
   solicitudes y licencias; su alcance por área/empresa se protege con los
   permisos ya existentes.
6. La excepción de saldo se crea junto con la solicitud cuando el cliente marca
   `solicitarExcepcion=true`; requiere justificación. La resolución no omite
   las dos aprobaciones de vacaciones.

## Cambios respecto al backlog

| Tema | Contrato v1 / fuente vigente | Diferencia respecto al backlog |
|---|---|---|
| Roles y autorización | 7 roles y permisos granulares exactos del seed | Backlog/ADR-003 todavía menciona 5 roles y RBAC descrito por rol |
| Administrador y excepciones | `ADMIN_GENERAL` no resuelve excepciones ni gestiona expedientes; `vacaciones:excepcion_resolve` existe para RRHH_OPERATIVO y GERENCIA | TSK-VAC-103 menciona resolución por Gerencia o ADMIN_GENERAL; prevalecen seed y decisiones-bd.md |
| Auditoría | `auditoria:read` (asignado a AUDITOR); payload sensible enmascarado | Decisiones-bd.md reserva Audit Trail a AUDITOR, no a ADMIN_GENERAL/GERENCIA |
| Refresh token | Opaco, almacenado como hash SHA-256, rotación y revocación de familia al detectar reuso | Backlog indica tokens cifrados |
| Bloqueo de cuenta | Temporal mediante `bloqueadoHasta` tras `MAX_FAILED_LOGIN_ATTEMPTS` durante `LOGIN_LOCK_MINUTES`; `estado=BLOQUEADO` es manual | Se distingue del bloqueo permanente/manual implícito en el backlog |
| JWT | `empleadoId` admite `null`; `familyId` no es claim | Contrato aplica decisiones-bd.md; `JwtPayload` común tipa hoy `empleadoId` como `string` |
| Sobre de eventos | Añade `version` y `producer` a `eventId`, `eventName`, `occurredOn`, `payload` | `version` y `producer` son campos nuevos respecto al backlog |
| Evento de áreas | Añade `AREA_ACTUALIZADA` con `areaId`, `nombre`, `padreId`, `jefeEmpleadoId` | Evento nuevo para refrescar el snapshot de jefe en ms-vacaciones |
| Privacidad de eventos | Los eventos de empleado no incluyen CI ni sueldo y llevan el snapshot mínimo de `EmpleadoRef` | `EmpleadoCreadoPayload` común contiene hoy `documento`; no se debe serializar como CI |
| Aprobación | Nadie aprueba ni resuelve su propia solicitud/excepción; propiedad validada en servicio | La regla del backlog se aplica en todos los puntos de entrada |

## Preguntas abiertas para el arquitecto

1. Confirmar formato de `X-Empleado-Id` para nulo, serialización de
   `X-Permisos` y canonización exacta (orden, separador, encoding) de HMAC.
2. `JwtPayload.empleadoId` del DTO común no acepta `null`, aunque
   decisiones-bd.md y `Usuario.empleadoId` sí lo permiten.
3. `EventEnvelope` común no declara `version` ni `producer`; `EVENT_NAMES`
   tampoco incluye `AREA_ACTUALIZADA`. `EmpleadoCreadoPayload` contiene
   `documento` y no el snapshot completo que requiere `EmpleadoRef`.
4. `OutboxEvento` persiste `eventName`, `payload` y `occurredOn`, pero no
   `version` ni `producer`. Confirmar si el publicador agrega esos campos al
   construir el sobre o si se actualizará el DTO/esquema (fuera de este cambio
   documental).
5. El Product Backlog asigna RF-17 a HU-13 y RF-18 (calendario) a HU-14; el
   Sprint Backlog TSK-VAC-103 rotula la aprobación como HU-14 / RF-17. Confirmar
   el identificador de historia correcto.
6. El Product Backlog incluye HU-09 / RF-12 (organigrama), pero el conjunto de
   historias comprometidas que enumera Sprint Backlog omite HU-09; este
   contrato documenta el endpoint solicitado de organigrama.
7. `SolicitudExcepcion` no guarda un estado adicional de la solicitud de
   vacaciones ni existe un campo de saldo excepcional. Confirmar cómo bloquear
   aprobaciones mientras la excepción está pendiente y cómo se descuenta el
   exceso aprobado.
8. Confirmar el límite de `pageSize`, los límites/tipos permitidos para la
    autorización ministerial y la política de retención de adjuntos.
9. Los esquemas de ms-contratos y ms-planillas son stubs de eventos en Sprint
    1 (`EventoProcesado`, `OutboxEvento`); sus contratos de negocio corresponden
    al Sprint 2.
