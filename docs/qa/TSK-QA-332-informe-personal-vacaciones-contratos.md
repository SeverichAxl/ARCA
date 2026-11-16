# TSK-QA-332 — Informe QA: Personal, Vacaciones y Contratos

- **Fecha:** 2026-11-16
- **Alcance:** flujos E2E de:
  - Personal → `services/ms-personal/src/application/employees` y `catalogs`
  - Vacaciones → `services/ms-vacaciones/src/application/vacations` y `messaging`
  - Contratos → `services/ms-contratos/src/application/contracts`
- **Fuentes revisadas (solo lectura):**
  - `services/ms-personal/src/application/employees/employees.controller.ts`, `employee.dto.ts`, `employee.service.ts` (alta, ratificación, `presentEmployee`)
  - `services/ms-personal/src/application/catalogs/areas.controller.ts`
  - `services/ms-vacaciones/src/application/vacations/vacation-request.controller.ts`, `vacation-request.service.ts`, `vacation-transition.controller.ts`, `vacation-transition.dto.ts`, `vacation-approval.service.ts`, `vacation-balance.controller.ts`, `vacation-balance.service.ts`, `vacation-balance.sync.ts`, `vacation-eligibility.ts`
  - `services/ms-vacaciones/src/application/messaging/personal-events.handler.ts`
  - `services/ms-contratos/src/application/contracts/contracts.controller.ts`, `contract.dto.ts`, `contract.service.ts`
  - `services/ms-auth/src/application/users/user.controller.ts`, `user.dto.ts`
  - `apps/api-gateway/src/rbac/routes/{auth,personal,vacaciones,contratos}.routes.ts`
  - `scripts/seed-demo.ts` (payloads de referencia)
- **Nota:** todos los endpoints pasan por el API Gateway (:4000), que exige JWT RS256 salvo `@Public()`. Sin token → 401; sin permiso → 403 con envelope `{statusCode, code, message, details?, traceId}`.
- **Ejecución real:** 2026-11-16 contra `http://localhost:4000` con el script temporal `tmp-qa-332.mjs` (fetch nativo de Node; credenciales de `.env`: `SEED_ADMIN_*` y `DEMO_USERS_PASSWORD`; script eliminado tras la corrida). Corrida definitiva: 2026-11-16T00:11:39Z. Resultado global: **37 casos → 34 PASS, 3 FAIL, 0 NO EJECUTADO**. Los 3 FAIL están documentados en la Sección 3 (DEF-01 y DEF-02).
- **Nota de corrida previa:** una primera ejecución (00:00:54Z) detectó el DEF-01 al intentar el Flujo 2 con `demo.funcionario` (422 `VAC_NO_ELEGIBLE`) y un falso FAIL de descarga PDF por error propio del script (magia `%PDF-` leída como 5 bytes); se corrigió el script y se re-ejecutó completo. La corrida de las 00:11:39Z es la reportada abajo.

---

## 1. Matriz de casos de prueba

### 1.1 Flujo 1 — Personal: alta >1 año → ratificación → saldo generado (12/12 PASS)

| Caso | Endpoint / paso | Permiso/Rol requerido | Resultado esperado | Estado (PASS/FAIL) |
|---|---|---|---|---|
| P-01 | `POST /api/auth/login` (admin) | `@Public()` | 200 con `accessToken` | PASS (200) |
| P-02 | `POST /api/auth/login` (`demo.rrhh`) | `@Public()` | 200 con `accessToken` (tiene `personal:create`, `personal:ratify`, `catalogo:manage`) | PASS (200) |
| P-03 | `GET /api/personal/areas` | `catalogo:manage` | 200 y área "Tecnología" activa | PASS (13 áreas; `00000000-0000-4000-8000-000000000003`) |
| P-04 | `GET /api/personal/cargos` | `catalogo:manage` | 200 con ≥1 cargo activo | PASS (8 cargos activos) |
| P-05 | `POST /api/personal/employees` (multipart `datos`+`firma`, `fechaIngreso=2023-06-01`, `diasPrueba=90`) | `personal:create` | 201 `EN_PRUEBA` con `id` | PASS (201 `EN_PRUEBA`, id `11da6b9d-…`, CI `QA33287899434`) |
| P-06 | `GET /api/personal/employees/:id` antes de ratificar | `personal:read` | `EN_PRUEBA` | PASS (`EN_PRUEBA`) |
| P-07 | `POST /api/personal/employees/:id/ratificar` (`fechaRatificacion`=hoy) → re-lectura | `personal:ratify` | 2xx y estado `RATIFICADO` | PASS (ratificar → 201; detalle → `RATIFICADO`) |
| P-08 | `GET /api/auth/roles` | `usuario:assign_role` | 200 con id del rol `FUNCIONARIO` | PASS (7 roles; `fc107da0-…`) |
| P-09 | `POST /api/auth/usuarios` (usuario nuevo, rol FUNCIONARIO) | `usuario:create` **y** `usuario:assign_role` | 201 con `id` | PASS (201, `qa332.87899434`) |
| P-10 | `PUT /api/auth/usuarios/:id/empleado` | `usuario:update` | 200 con `empleadoId` vinculado | PASS (vínculo `11da6b9d-…`) |
| P-11 | `POST /api/auth/login` (usuario nuevo) | `@Public()` | 200 con `accessToken` | PASS (200) |
| P-12 | `GET /api/vacaciones/saldo` del usuario nuevo (polling ≤60 s por el evento `EMPLEADO_MODIFICADO`) | `vacaciones:read_own` | `elegible=true` y ≥1 gestión con días asignados (saldo creado por RabbitMQ) | PASS (`elegible=true`; 2 gestiones; 15/15 días) |

### 1.2 Flujo 2 — Vacaciones: solicitud → aprobación jefe → RRHH → saldo + excepción (15/16 PASS)

| Caso | Endpoint / paso | Permiso/Rol requerido | Resultado esperado | Estado (PASS/FAIL) |
|---|---|---|---|---|
| V-01 | `POST /api/auth/login` (`demo.funcionario`) | `@Public()` | 200 con `accessToken` | PASS (200) |
| V-02 | `POST /api/auth/login` (`demo.jefe`) | `@Public()` | 200 con `accessToken` (JEFE_AREA) | PASS (200) |
| V-03 | Token `demo.rrhh` disponible | `vacaciones:approve_rrhh` | token presente | PASS |
| V-04 | `GET /api/vacaciones/saldo` (sonda `demo.funcionario`) | `vacaciones:read_own` | 200 con saldo computable | PASS (`disponible=30`; `elegible=false` → ver V-04b) |
| V-04b | Coherencia `demo.funcionario`: ms-vacaciones ↔ ms-personal | — | `elegible=true` (ms-personal `RATIFICADO`) | **FAIL** (ms-vacaciones `elegible=false`; ms-personal `RATIFICADO` → **DEF-01**) |
| V-04c | `GET /api/vacaciones/saldo` del sujeto efectivo del flujo (`qa332.87899434`, alterno por DEF-01) | `vacaciones:read_own` | 200 `elegible=true` | PASS (`disponible=30`, `elegible=true`) |
| V-05 | `POST /api/vacaciones/solicitudes` (3 días hábiles, 2027-02-15→2027-02-17, sin traslape con ventanas del seed) | `vacaciones:request` | 201 `PENDIENTE_JEFE` con `id` y `diasHabiles` | PASS (`diasHabiles=3`, id `2bc052c8-…`) |
| V-06 | `POST /api/vacaciones/solicitudes/:id/aprobar-jefe` con rol sin permiso (FUNCIONARIO) | `vacaciones:approve_jefe` | 403 del gateway | PASS (403 `FORBIDDEN`) |
| V-07 | `POST /api/vacaciones/solicitudes/:id/aprobar-jefe` (`demo.jefe`, jefe del área del solicitante) | `vacaciones:approve_jefe` | 200 `APROBADO_JEFE` | PASS (`APROBADO_JEFE`) |
| V-08 | `POST /api/vacaciones/solicitudes/:id/aprobar-rrhh` (`demo.rrhh`) | `vacaciones:approve_rrhh` | 200 `APROBADO_FINAL` | PASS (`APROBADO_FINAL`) |
| V-09 | `GET /api/vacaciones/saldo` tras la aprobación final | `vacaciones:read_own` | descuento exacto = `diasHabiles` | PASS (antes 30 → después 27; delta=3) |
| V-10 | `POST /api/vacaciones/solicitudes` con exceso de días + `solicitarExcepcion=true` (40 días hábiles, 2027-05-14→2027-07-08) | `vacaciones:request` | 201 `PENDIENTE_JEFE` con excepción `PENDIENTE` | PASS (`diasHabiles=40`; excepción `PENDIENTE`) |
| V-11 | `GET /api/vacaciones/solicitudes/:id` (detalle) | `vacaciones:read_own` | excepción presente en `PENDIENTE` con `diasExcedentes` | PASS (`PENDIENTE`; excedentes=13) |
| V-12 | `POST /api/vacaciones/excepciones/:id/resolver` con rol sin permiso (FUNCIONARIO) | `vacaciones:excepcion_resolve` | 403 del gateway | PASS (403 `FORBIDDEN`) |
| V-13 | `POST /api/vacaciones/excepciones/:id/resolver` (`demo.rrhh`, `decision=RECHAZADA`) → re-lectura | `vacaciones:excepcion_resolve` | 200 y excepción `RECHAZADA` | PASS (200; detalle `RECHAZADA`) |
| V-14 | `POST /api/vacaciones/solicitudes/:id/aprobar-jefe` con excepción rechazada | `vacaciones:approve_jefe` | 409 `VAC_ESTADO_INVALIDO` | PASS (409 `VAC_ESTADO_INVALIDO`) |

### 1.3 Flujo 3 — Contratos: plantilla → contrato → PDF firmado → descarga (7/9 PASS)

| Caso | Endpoint / paso | Permiso/Rol requerido | Resultado esperado | Estado (PASS/FAIL) |
|---|---|---|---|---|
| C-01 | Token `demo.rrhh` disponible | `contrato:generate`, `contrato:template_manage` | token presente | PASS |
| C-02 | `GET /api/contratos/plantillas?q=…` (o `POST` si falta) + `PATCH activa` | `contrato:template_manage` \| `contrato:generate` | plantilla existente y `activa=true` | PASS (id `38c2d2b2-…`, `activa=true`) |
| C-03 | `POST /api/contratos` (empleado del Flujo 1) | `contrato:generate` | 201 `BORRADOR` con `id` | PASS (`BORRADOR`, id `6aa29ee4-…`) |
| C-04 | `GET /api/contratos/:id` antes de generar | `contrato:read` | 200 `BORRADOR` sin versiones | **FAIL** (404 `Cannot GET /contratos/6aa29ee4-…` → **DEF-02**) |
| C-05 | `POST /api/contratos/:id/pdf` (multipart: `datos {incluirFirmas:true}` + 2 firmas PNG) — activación | `contrato:generate` | 201 `EMITIDO` con ambas firmas y `hashSha256` de 64 hex | PASS (`EMITIDO`, v1, firmas `true/true`, `a1dad869…`) |
| C-06 | `GET /api/contratos/:id` después de generar | `contrato:read` | 200 `EMITIDO` con versión vigente firmada | **FAIL** (mismo 404 → **DEF-02**) |
| C-07 | `GET /api/contratos/:id/pdf` → URL firmada | `contrato:read` \| `contrato:download_own` | 200 con `url`, `expiresInSeconds`, `versionId` | PASS (Cloudinary firmada, `expires=300`) |
| C-08 | Descarga real de la URL (bytes) | URL firmada (sin JWT) | 200 con magia `%PDF` y >1 KB | PASS (200; `%PDF-`; 13 502 bytes) |
| C-09 | SHA-256 del PDF descargado vs `hashSha256` de la versión | — | coincidencia exacta | PASS (coincide) |

---

## 2. Contexto y datos de la corrida

### 2.1 Identidades usadas

| Usuario | Rol | Uso en la corrida |
|---|---|---|
| `admin` (`SEED_ADMIN_*`) | ADMIN_GENERAL | Creación de usuario y vínculo (P-01, P-08 a P-10) |
| `demo.rrhh` | RRHH_OPERATIVO | Altas/ratificación, catálogos, aprobación final, contratos |
| `demo.jefe` | JEFE_AREA | Aprobación de nivel 1 (jefe del área Tecnología) |
| `demo.funcionario` | FUNCIONARIO | Sonda de saldo (V-04) y pruebas 403 (no elegible → DEF-01) |
| `qa332.87899434` | FUNCIONARIO (creado) | Sujeto efectivo del Flujo 2 y 3 (vinculado al empleado nuevo) |

### 2.2 Entidades creadas por la corrida (no purgar; entorno de QA local)

| Corrida | Entidad | Id / detalle |
|---|---|---|
| 1.ª (00:00Z) | Empleado | `93cb6e03-311c-49d4-8356-eddd84ee47bf` (CI `QA33287254127`, ratificado) |
| 1.ª | Usuario | `qa332.87254127` (FUNCIONARIO, vinculado) |
| 1.ª | Contrato | `d9d6efd1-312a-46c1-ad23-abb60c5dfba8` (EMITIDO, v1) |
| 2.ª (00:11Z) | Empleado | `11da6b9d-d3c1-49a1-a14b-48988490b37b` (CI `QA33287899434`, ingreso 2023-06-01, ratificado) |
| 2.ª | Usuario | `qa332.87899434` (FUNCIONARIO, vinculado) |
| 2.ª | Solicitud A | `2bc052c8-e85c-48ef-aaa8-3c08b4a57117` — `APROBADO_FINAL` (3 días, 2027-02-15→17) |
| 2.ª | Solicitud B | `cf092188-5122-49ea-a1b5-01136c6a6ce0` — `PENDIENTE_JEFE` con excepción `RECHAZADA` (intencional: no se aprobó tras rechazar la excepción) |
| 2.ª | Contrato | `6aa29ee4-1eb0-4d85-a270-5a820b45ed63` (EMITIDO, v1) |
| ambas | Plantilla | `38c2d2b2-1876-4aa1-ba5b-e824465efe51` (preexistente del seed, reutilizada) |

### 2.3 Verificación de eventos (mensajería RabbitMQ)

- **P-12 PASS:** el alta + ratificación del empleado nuevo generó `EMPLEADO_CREADO`/`EMPLEADO_MODIFICADO`, ms-vacaciones creó 2 gestiones de 15 días vía `vacation-balance.sync.ts` → el pipeline de eventos funciona para eventos emitidos durante la corrida.
- **DEF-01:** en cambio, el empleado del seed (`caf378f2-…`) quedó con estado incoherente entre servicios (ver defecto).

---

## 3. Plantilla de reporte de defectos

> **Instancias generadas por la ejecución del 2026-11-16: 2 (DEF-01 y DEF-02), que corresponden a 3 casos FAIL (V-04b, C-04, C-06).**

### Defecto #1 — Desincronización de estado entre ms-personal y ms-vacaciones (V-04b / V-05)

| Campo | Valor |
|---|---|
| **ID** | TSK-QA-332-DEF-01 |
| **Fecha de detección** | 2026-11-16 |
| **Detectado por** | QA — corrida automatizada `tmp-qa-332.mjs` contra `http://localhost:4000` |
| **Módulo** | ☑ Vacaciones (cruce con Personal) |
| **Endpoint / ruta** | `GET /api/vacaciones/saldo`, `POST /api/vacaciones/solicitudes` |
| **Caso de prueba asociado** | V-04b, V-05 (1.ª corrida) |
| **Severidad** | ☑ Alta |
| **Prioridad** | ☑ Inmediata |
| **Ambiente** | ☑ local — URL: http://localhost:4000 |
| **Rol/permiso con el que se reprodujo** | `FUNCIONARIO` (`demo.funcionario`, `vacaciones:request` + `vacaciones:read_own`) |

**Pasos para reproducir**
1. Login `POST /api/auth/login` con `demo.funcionario`.
2. `GET /api/vacaciones/saldo` → observar `elegible`.
3. `GET /api/personal/employees/caf378f2-142c-4137-b4a1-9f0e6d67de40` (token `demo.rrhh`) → observar `estado`.
4. `POST /api/vacaciones/solicitudes` con `{fechaInicio:"2027-02-15", fechaFin:"2027-02-17"}`.

**Datos de entrada**
- Usuario/rol: `demo.funcionario` (FUNCIONARIO) — empleado vinculado `caf378f2-142c-4137-b4a1-9f0e6d67de40` ("Funcionario Demo ARCA").
- Payload: `{"fechaInicio":"2027-02-15","fechaFin":"2027-02-17"}`.

**Resultado esperado**
- `elegible=true` (ms-personal reporta `estado=RATIFICADO`, `fechaIngreso=2024-01-15` → ≥1 año completo) y `POST /api/vacaciones/solicitudes` → 201 `PENDIENTE_JEFE`.

**Resultado obtenido**
- `GET /api/vacaciones/saldo`: `200 {"empleadoId":"caf378f2-…","elegible":false,"gestiones":[{gestion:1,diasAsignados:15,diasTomados:0},{gestion:2,diasAsignados:15,diasTomados:0}],"advertencias":["GESTION_BLOQUEADA"]}`.
- `GET /api/personal/employees/caf378f2-…`: `200 {"estado":"RATIFICADO","fechaIngreso":"2024-01-15","fechaRatificacion":"2026-11-14",…}`.
- `POST /api/vacaciones/solicitudes` (1.ª corrida, 00:00:54Z): `422 {"code":"VAC_NO_ELEGIBLE","message":"El funcionario debe estar ratificado y tener al menos un año completo."}`.

**Evidencia**
- [x] Respuestas HTTP completas (arriba)
- [x] Cruce de ambos servicios en el mismo instante (V-04/V-04b)
- [ ] Captura de pantalla

**Análisis tentativo** (controlador/archivo responsable)
- `vacation-eligibility.ts` exige `estado === 'RATIFICADO'` **sobre `empleado_ref` de ms-vacaciones**; con `fechaIngreso=2024-01-15` el único motivo del `false` es que el estado reflejado en ms-vacaciones **no** es `RATIFICADO`, mientras ms-personal sí lo es → desincronización por evento.
- `personal-events.handler.ts` aplica `EMPLEADO_MODIFICADO` con guarda `ultimo_evento_en >=` (`ON CONFLICT … WHERE EXCLUDED.ultimo_evento_en >= empleado_ref.ultimo_evento_en`): la ratificación del seed (fechaRatificacion 2026-11-14) no quedó aplicada, u otro evento posterior con estado distinto sobrescribió el estado. Los saldos sí existen (se crearon cuando el estado era `RATIFICADO`), por lo que el empleado quedó "con saldo pero no elegible"; `diasTomados=0` indica además que el flujo de vacaciones del seed no pudo completarse por esta misma causa.
- El mecanismo **sí** funciona para eventos emitidos durante la corrida (P-12 PASS) → foco en la entrega/consumo del evento de ratificación del seed (outbox/consumer de ms-vacaciones: reintentos, DLQ, orden de mensajes).

**Comportamiento en otros endpoints/módulos** (¿se reproduce también en …?)
- Empleado creado vía API en esta corrida (`11da6b9d-…`): **no** se reproduce (`elegible=true`, P-12/V-04c PASS).
- `demo.jefe`/`demo.rrhh`: no evaluado (no dependen de elegibilidad propia).

**Impacto / workaround en la corrida**
- El usuario `demo.funcionario` no puede solicitar vacaciones (422 `VAC_NO_ELEGIBLE` permanente) hasta resincronizar. Para completar el Flujo 2 se utilizó un sujeto alterno (`qa332.87899434`), dejando constancia en V-04c/V-05.

**Notas de regresión / criterio de cierre**

| | |
|---|---|
| Estado | ☑ Abierto |
| Asignado a | |
| Versión/commit de corrección | |
| Re-test por | — fecha: — resultado: |

### Defecto #2 — `GET /api/contratos/:id` declarado en el gateway pero no implementado en ms-contratos (C-04/C-06)

| Campo | Valor |
|---|---|
| **ID** | TSK-QA-332-DEF-02 |
| **Fecha de detección** | 2026-11-16 |
| **Detectado por** | QA — corrida automatizada `tmp-qa-332.mjs` contra `http://localhost:4000` |
| **Módulo** | ☑ Contratos |
| **Endpoint / ruta** | `GET /api/contratos/:id` |
| **Caso de prueba asociado** | C-04, C-06 |
| **Severidad** | ☑ Media |
| **Prioridad** | ☑ Inmediata |
| **Ambiente** | ☑ local — URL: http://localhost:4000 |
| **Rol/permiso con el que se reprodujo** | `RRHH_OPERATIVO` (`contrato:read`, `contrato:generate`) |

**Pasos para reproducir**
1. Login `POST /api/auth/login` con `demo.rrhh`.
2. `POST /api/contratos` (o usar cualquier contrato existente) → obtener `id`.
3. `GET /api/contratos/<id>` (antes o después de generar el PDF).

**Datos de entrada**
- Usuario/rol: `demo.rrhh` (RRHH_OPERATIVO).
- `id` de contrato: `6aa29ee4-1eb0-4d85-a270-5a820b45ed63` (corrida 2) / `d9d6efd1-312a-46c1-ad23-abb60c5dfba8` (corrida 1) — ambos reproducen.

**Resultado esperado**
- `200` con el detalle del contrato (estado `BORRADOR`/`EMITIDO`, `versiones`, `versionVigente`), según `ContratoEmpleadoItemResponseDto` y la ruta declarada en el gateway.

**Resultado obtenido**
- `404 Cannot GET /contratos/6aa29ee4-1eb0-4d85-a270-5a820b45ed63` — body en texto plano del handler por defecto de Express **sin** el envelope `{statusCode, code, message, details?, traceId}` exigido por `docs/api/errores.md`. Idéntico resultado en ambas corridas y antes/después de generar el PDF.

**Evidencia**
- [x] Respuesta HTTP completa (arriba)
- [x] Reproducido 4 veces (2 contratos × 2 momentos)
- [ ] Captura de pantalla

**Análisis tentativo** (controlador/archivo responsable)
- `apps/api-gateway/src/rbac/routes/contratos.routes.ts:62-65` **declara** `GET /api/contratos/:id` (`access: contrato:read | contrato:download_own`).
- `services/ms-contratos/src/application/contracts/contracts.controller.ts` **no expone** `@Get(':id')`: solo existen `@Get('empleado/:empleadoId')`, `@Get('por-empleado/:empleadoId')`, `@Get(':id/pdf')` y `@Get(':id/versiones/:versionId/descarga')`. El gateway reenvía (con `/api` strippeado) y el servicio responde el 404 por defecto de Express — mismo patrón inverso al DEF-01 de TSK-QA-331 (rutas declaradas/no expuestas).

**Comportamiento en otros endpoints/módulos** (¿se reproduce también en …?)
- No: `GET /api/contratos/empleado/:empleadoId`, `GET /api/contratos/:id/pdf` y `POST /api/contratos/:id/pdf` sí funcionan (C-03, C-05, C-07 PASS).
- No se reproduce en plantillas: `GET /api/contratos/plantillas/:id` sí tiene `@Get(':id')` en `templates.controller.ts`.

**Notas de regresión / criterio de cierre**

| | |
|---|---|
| Estado | ☑ Abierto |
| Asignado a | |
| Versión/commit de corrección | |
| Re-test por | — fecha: — resultado: |

---

## 4. Resumen de resultados

| Flujo | Casos | PASS | FAIL | NO EJECUTADO |
|---|---|---|---|---|
| 1 — Personal (alta >1 año → ratificación → saldo) | 12 | 12 | 0 | 0 |
| 2 — Vacaciones (solicitud → aprobaciones → saldo + excepción) | 16 | 15 | 1 (V-04b → DEF-01) | 0 |
| 3 — Contratos (plantilla → contrato → PDF → descarga) | 9 | 7 | 2 (C-04, C-06 → DEF-02) | 0 |
| **Total** | **37** | **34** | **3** | **0** |

**Conclusión:** los tres flujos E2E completan su objetivo funcional — el alta con antigüedad >1 año genera saldo vía eventos (Flujo 1), el ciclo de aprobación en dos niveles descuenta exactamente los días hábiles y las excepciones bloquean/permiten transiciones según corresponde (Flujo 2), y el contrato se emite firmado y el PDF se descarga con integridad verificada por SHA-256 (Flujo 3). Quedan **2 defectos abiertos**: la desincronización de estado de `demo.funcionario` entre ms-personal y ms-vacaciones (DEF-01, bloquea solicitudes de ese usuario) y el detalle de contrato inaccesible vía `GET /api/contratos/:id` (DEF-02).
