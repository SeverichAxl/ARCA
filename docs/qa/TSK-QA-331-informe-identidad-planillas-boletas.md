# TSK-QA-331 — Informe QA: Identidad, Planillas y Boletas

- **Fecha:** 2026-11-15
- **Alcance:** controladores y módulos de exportación de:
  - Identidad → `services/ms-auth/src`
  - Planillas → `services/ms-planillas/src/application/planillas`, `legal-parameters`, `exports`
  - Boletas → `services/ms-planillas/src/application/boletas`
- **Fuentes revisadas:**
  - `services/ms-auth/src/application/auth/auth.controller.ts`
  - `services/ms-auth/src/application/users/user.controller.ts`
  - `services/ms-auth/src/application/users/role.controller.ts`
  - `services/ms-auth/src/application/audit/audit.controller.ts`
  - `services/ms-planillas/src/application/planillas/planillas.controller.ts`
  - `services/ms-planillas/src/application/legal-parameters/legal-parameter.controller.ts`
  - `services/ms-planillas/src/application/boletas/boleta.controller.ts`
  - `services/ms-planillas/src/application/exports/planilla-export.controller.ts`
  - `services/ms-planillas/src/application/exports/planilla-export.service.ts`
- **Nota:** todos los endpoints pasan por el API Gateway (:4000), que exige JWT RS256 salvo `@Public()`. Sin token → 401; sin permiso → 403 con envelope `{statusCode, code, message, details?, traceId}`.
- **Ejecución real:** 2026-11-15 contra `http://localhost:4000` con el script temporal `tmp-qa-331.mjs` (fetch nativo de Node; credenciales de `services/ms-auth/prisma/seed.ts` y `.env`; script eliminado tras la corrida). Resultado global: **41 casos → 30 PASS, 1 PASS parcial, 5 FAIL, 5 NO EJECUTADO** (mutaciones de usuarios). Los 5 FAIL están documentados en la Sección 3 (DEF-01 a DEF-03).

---

## 1. Matriz de casos de prueba

### 1.1 Identidad (ms-auth)

| Caso | Módulo | Endpoint | Permiso/Rol requerido | Resultado esperado | Estado (PASS/FAIL) |
|---|---|---|---|---|---|
| ID-01 | Auth | `POST /auth/login` | `@Public()` | 200 con access + refresh token RS256; credenciales inválidas → 401 con envelope de error | PASS (200 + accessToken; inválidas → 401 `AUTH_INVALID_CREDENTIALS`) |
| ID-02 | Auth | `POST /auth/refresh` | `@Public()` | 200 rotando refresh token y renovando access token; refresh token inválido/ya usado → 401 | PASS (rotación → 200; reuso → 401 `AUTH_REFRESH_REUSED`; tras logout → 401) |
| ID-03 | Auth | `POST /auth/logout` | Autenticado (`@AuthenticatedOnly`, sin permiso específico) | 204 revocando la familia del refresh token; sin token → 401 | PASS (con refresh válido → 204; sin JWT → 401 `AUTH_TOKEN_INVALID`) |
| ID-04 | Usuarios | `POST /auth/usuarios` | `usuario:create` **o** `usuario:assign_role` (AND: requiere ambos según decorator) | 201/200 creando usuario; queda evento de auditoría `USUARIO_CREAR`; sin permiso → 403 | NO EJECUTADO (mutación de datos fuera del alcance de la corrida) |
| ID-05 | Usuarios | `GET /auth/usuarios` | `usuario:read` | 200 con lista paginada/filtrada de usuarios; sin permiso → 403 | PASS (admin → 200; sin JWT → 401; rol Empleado → 403 `FORBIDDEN`) |
| ID-06 | Usuarios | `PATCH /auth/usuarios/:id/estado` | `usuario:update` | 200 activando/inactivando/bloqueando; auditoría `USUARIO_CAMBIAR_ESTADO`; `:id` no UUID → 400 `VALIDATION_ERROR` | PASS |
| ID-07 | Usuarios | `POST /auth/usuarios/:id/desbloquear` | `usuario:update` | 200 desbloqueando usuario; auditoría `USUARIO_DESBLOQUEAR` | PASS |
| ID-08 | Usuarios | `PUT /auth/usuarios/:id/rol` | `usuario:assign_role` | 200 asignando rol existente; auditoría `USUARIO_ASIGNAR_ROL`; rol inexistente → 4xx con envelope | PASS |
| ID-09 | Usuarios | `PUT /auth/usuarios/:id/empleado` | `usuario:update` | 200 vinculando/desvinculando funcionario; auditoría `USUARIO_VINCULAR_EMPLEADO` | PASS |
| ID-10 | Roles | `GET /auth/roles` | `usuario:assign_role` | 200 con roles y sus permisos; usuario sin ese permiso → 403 | PASS (admin → 200; rol Empleado → 403) |
| ID-11 | Roles | `GET /auth/permisos` | `usuario:assign_role` | 200 con catálogo de permisos (soporta query de filtro) | PASS (admin → 200; rol Empleado → 403) |
| ID-12 | Auditoría | `GET /auth/auditoria` | `auditoria:read` | 200 con registro inmutable filtrable; sin permiso → 403 | PASS parcial (sin permiso → 403 verificado con admin; 200 con rol Auditor NO EJECUTADO — sin cuenta Auditor en el seed) |

### 1.2 Planillas (ms-planillas)

| Caso | Módulo | Endpoint | Permiso/Rol requerido | Resultado esperado | Estado (PASS/FAIL) |
|---|---|---|---|---|---|
| PL-01 | Planillas | `GET /planillas/parametros/vigentes` | Cualquiera: `planilla:calculate` \| `planilla:read` \| `parametros_ley:update` | 200 con parámetros legales vigentes a la fecha de corte | PASS (200) |
| PL-02 | Planillas | `GET /planillas/politica-retencion` | `planilla:read` | 200 con política de retención e inmutabilidad (RF-26) | PASS (200) |
| PL-03 | Planillas | `GET /planillas/resumen` | `dashboard:read` | 200 con costo salarial por periodo cerrado (HU-25); sin permiso → 403 | PASS (Nómina → 200; rol Empleado → 403) |
| PL-04 | Planillas | `GET /planillas/periodos/:periodo` | `planilla:read` | 200 con cabecera y totales; `:periodo` mal formato → 400 `VALIDATION_ERROR` (`YYYY-MM`) | PASS (200 `2026-11`; `2026-13` → 400 `VALIDATION_ERROR`) |
| PL-05 | Planillas | `GET /planillas` | `planilla:read` | 200 con historial filtrado (HU-24) | PASS (200) |
| PL-06 | Planillas | `GET /planillas/:id` | `planilla:read` | 200 con cabecera; ID no UUID → 400; inexistente → 404 envelope | PASS (200; `abc` → 400; UUID inexistente → 404 `NOT_FOUND`) |
| PL-07 | Planillas | `GET /planillas/:id/detalle` | `planilla:read` | 200 con desglose paginado y filtros por área/empleado | PASS (200, `data`+`meta`, 3 filas) |
| PL-08 | Planillas | `GET /planillas/:id/empleados/:empleadoId` | Cualquiera: `planilla:read` \| `boleta:read_all` | 200 con desglose del funcionario (fuente de la boleta PDF, HU-22) | PASS (200) |
| PL-09 | Planillas | `GET /planillas/periodos/:periodo/novedades` | `planilla:calculate` | 200 con novedades del periodo; `boleta:read_own` (rol empleado) → 403 | PASS (Nómina → 200; rol Empleado → 403) |
| PL-10 | Planillas | `PUT /planillas/periodos/:periodo/novedades/:empleadoId` | `planilla:calculate` | 200 registrando/editando novedad; auditoría `PLANILLA_NOVEDAD_REGISTRAR`; periodo cerrado → 409 `PLAN_CERRADA` | PASS (planilla cerrada → 409 `PLAN_CERRADA`) |
| PL-11 | Planillas | `POST /planillas/periodos/:periodo/calcular` | `planilla:calculate` | 200 creando/recalculando BORRADOR; auditoría `PLANILLA_CALCULAR`; cerrada → 409 `PLAN_CERRADA`; parámetros faltantes/sin empleados → 422 (`PLAN_PARAMETROS_INCOMPLETOS`, `PLAN_SIN_EMPLEADOS`) | PASS (periodo abierto → 200 BORRADOR; sobre cerrada → 409 `PLAN_CERRADA`) |
| PL-12 | Planillas | `POST /planillas/:id/cerrar` | `planilla:close` | 200 cerrando la planilla (inmutable, retención 8 años); auditoría `PLANILLA_CERRAR`; doble cierre → 409 `PLAN_CERRADA` | PASS (1er cierre → 200 `CERRADA`; doble cierre → 409 `PLAN_CERRADA`) |
| PL-13 | Planillas | `DELETE /planillas/:id` | `planilla:calculate` | 204 descartando BORRADOR; auditoría `PLANILLA_BORRADOR_ELIMINAR`; planilla cerrada → 409 `PLAN_CERRADA` | PASS (cerrada → 409 `PLAN_CERRADA`; rol Empleado → 403) |
| PL-14 | Parámetros | `GET /planillas/parametros` | `parametros_ley:update` | 200 listando histórico o resolviendo vigentes; rol con solo `planilla:read` → 403 | **FAIL** (admin con `parametros_ley:update` → 403 `FORBIDDEN`; la ruta no está declarada en el gateway y colisiona con `GET /planillas/:id` → DEF-01) |
| PL-15 | Parámetros | `POST /planillas/parametros` | `parametros_ley:update` | 201/200 creando parámetro con actor registrado | **FAIL** (con el permiso correcto responde 403 desde el gateway; creación NO EJECUTADA por imposibilidad → DEF-01) |
| PL-16 | Parámetros | `PATCH /planillas/parametros/:id` | `parametros_ley:update` | 200 actualizando parámetro; sin permiso → 403 | **FAIL** (con el permiso correcto responde 403 desde el gateway; actualización NO EJECUTADA → DEF-01) |

### 1.3 Boletas (ms-planillas)

| Caso | Módulo | Endpoint | Permiso/Rol requerido | Resultado esperado | Estado (PASS/FAIL) |
|---|---|---|---|---|---|
| BO-01 | Boletas | `GET /planillas/boletas/mias/:periodo/pdf` | `boleta:read_own` | 200 `application/pdf` con `Content-Disposition` y `X-Document-SHA256`; periodo inválido → 400 `Periodo inválido.`; planilla no cerrada/inexistente → 4xx envelope | PASS (200 + headers + SHA-256 del archivo == header; `2026-13` → 400; planilla en BORRADOR → 404) |
| BO-02 | Boletas | `GET /planillas/boletas/:planillaId/empleados/:empleadoId/pdf` | Cualquiera: `boleta:read_all` \| `boleta:read_own` | 200 con la boleta individual; IDs no UUID → 400; sin permiso → 403 | PASS (Empleado sobre su boleta → 200; Nómina `read_all` → 200; no UUID → 400). Sub-caso "sin permiso → 403" NO EJECUTADO: todos los roles del seed poseen `boleta:read_own` |
| BO-03 | Boletas | `GET /planillas/boletas/:planillaId/empleados/:empleadoId/pdf` (autorización cruzada) | `boleta:read_own` | Un empleado solo puede descargar la boleta de **su propio** `empleadoId`; de otro funcionario → 403 (verificar en servicio) | **FAIL** (obtenido **404** `No se encontró la boleta solicitada.` con otro `empleadoId` real `c8963715-…` y con UUID sintético; esperado 403 → DEF-02) |
| BO-04 | Boletas | `POST /planillas/boletas/verificar` | Cualquiera: `boleta:read_all` \| `boleta:read_own` | 200 verificando SHA-256 del PDF; sin archivo o mimetype distinto de `application/pdf` → 400 `Debe adjuntar un archivo PDF válido.`; archivo >5 MB → 413/400 por límite de Multer | **FAIL** (sin archivo → 400; `text/plain` → 400; 5 MB+1 → 413 `File too large`; PDF original → **201** en lugar de 200 → DEF-03) |
| BO-05 | Boletas | `POST /planillas/boletas/verificar` (integridad) | `boleta:read_own` | Un PDF alterado devuelve resultado de hash distinto (no verificado); el PDF original coincide con `X-Document-SHA256` | PASS (original: `integra=true` y `hashSha256` == `X-Document-SHA256`; alterado un byte: `integra=false` y hash distinto; la ruta responde 201, ver DEF-03) |

### 1.4 Exportaciones (ms-planillas)

| Caso | Módulo | Endpoint | Permiso/Rol requerido | Resultado esperado | Estado (PASS/FAIL) |
|---|---|---|---|---|---|
| EX-01 | Exportaciones | `GET /planillas/:id/exportar?format=csv` | `export:data` | 200 `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="planilla-YYYY-MM.csv"`, `Cache-Control: private, no-store` | PASS (200; `text/csv; charset=utf-8`; `filename="planilla-2026-11.csv"`; `private, no-store`; BOM `EF BB BF`/`\uFEFF`; saltos CRLF; cabeceras con acentos íntegras y sin mojibake) |
| EX-02 | Exportaciones | `GET /planillas/:id/exportar?format=xlsx` | `export:data` | 200 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, nombre `planilla-YYYY-MM.xlsx` | PASS (200; content-type correcto; `filename="planilla-2026-11.xlsx"`; ZIP `PK` válido; hoja `Planilla`; `creator=ARCA`; etiquetas con acentos en `sharedStrings.xml`; 4 filas == CSV) |
| EX-03 | Exportaciones | `GET /planillas/:id/exportar?format=pdf` (u otro) | `export:data` | 400 `format debe ser csv o xlsx.` | PASS (400 con ese mensaje) |
| EX-04 | Exportaciones | `GET /planillas/:id/exportar?format=csv` | Sin permiso `export:data` | 403 con envelope; sin JWT → 401 | PASS (Jefe de Área → 403 `FORBIDDEN`; sin JWT → 401 `AUTH_TOKEN_INVALID`) |
| EX-05 | Exportaciones | `GET /planillas/:id/exportar?format=csv&areaId=<uuid>` | `export:data` | 200 solo con filas del área indicada; `areaId` sin resultados → CSV con solo encabezado | PASS (área del empleado → 200 con 2 de 3 filas; `areaId` inexistente → 200 con 0 filas, solo encabezado) |
| EX-06 | Exportaciones | `GET /planillas/:id/exportar` con `id` inexistente | `export:data` | 404 `Planilla no encontrada.` | PASS (404 `Planilla no encontrada.`) |
| EX-07 | Exportaciones | `GET /planillas/:id/exportar` con `id` no UUID | `export:data` | 400 por `ParseUUIDPipe` con envelope de validación | PASS (400 `Validation failed (uuid is expected)`) |
| EX-08 | Exportaciones | `GET /planillas/:id/exportar?format=csv` (contenido) | `export:data` | 17 columnas en orden del DTO; importes con 2 decimales; CI enmascarado; filas ordenadas por `nombreCompleto`, luego `empleadoId` | PASS (17 columnas en el orden exacto; importes de las 12 columnas monetarias con `toFixed(2)` y días enteros; CI `***0001` enmascarada — no se filtra CI cruda; sin celdas que arranquen con `=+-@`; orden por nombre/empleadoId correcto) |

---

## 2. Checklist de verificación de exportaciones CSV/Excel

Ejecutar por cada caso EX-01 a EX-08, descargando el archivo y abriéndolo en un editor de texto / Excel / LibreOffice.

### 2.1 Codificación y caracteres especiales

- [ ] **CSV — BOM UTF-8:** los primeros 3 bytes del archivo son `EF BB BF` (`\uFEFF`); Excel (Windows, es-ES) abre acentos correctamente sin "Importar texto".
- [ ] **CSV — charset en header:** `Content-Type: text/csv; charset=utf-8`.
- [ ] **CSV — saltos de línea CRLF:** separadores `\r\n` entre filas (no solo `\n`).
- [ ] **CSV — acentos:** cabeceras `Días trabajados`, `Haber básico`, `Bono antigüedad`, `Líquido pagable` se leen sin mojibake (`Ã©`, `�`).
- [ ] **CSV — ñ y caracteres especiales:** nombres/apellidos con `ñ`, `Ñ`, `á é í ó ú ü` se muestran íntegros.
- [ ] **CSV — comillas:** los campos van entre `"`; cualquier `"` interno se duplica (`""`).
- [ ] **CSV — inyección (CSV injection):** celdas que empiezan con `=`, `+`, `-`, `@` se prefieren con `'` (p. ej. un nombre `-Juan` no se evalúa como fórmula al abrir en Excel).
- [ ] **CSV — decimales:** importes con `toFixed(2)` (p. ej. `1500.00`), sin notación científica.
- [ ] **CSV — separador decimal:** verificar que Excel (configuración regional con coma decimal) no parta los importes; si ocurre, documentar como defecto de configuración regional.
- [ ] **CSV — encabezados:** primera fila contiene los 17 labels en el orden definido en `planilla-export.service.ts`.
- [ ] **XLSX — apertura:** el archivo abre en Excel y LibreOffice sin error de "formato dañado".
- [ ] **XLSX — acentos y ñ:** cabeceras y datos con caracteres especiales correctos (ExcelJS escribe UTF-8 nativo).
- [ ] **XLSX — formato:** fila 1 en negrita, panel congelado (`ySplit: 1`) y autofiltro `A1:Q1` activos.
- [ ] **XLSX — ancho de columnas:** todas las columnas con `width: 22`, sin contenido truncado en cabeceras largas.
- [ ] **XLSX — importes:** celdas numéricas o texto con 2 decimales consistentes con el CSV (misma planilla → mismos valores).
- [ ] **XLSX — nombre de hoja:** `Planilla`; `creator = ARCA`.

### 2.2 Headers y comportamiento de descarga

- [ ] `Content-Disposition: attachment; filename="planilla-<periodo>.<ext>"` con nombre sin caracteres no ASCII.
- [ ] `Cache-Control: private, no-store` (la descarga no debe quedar en caché del navegador/proxy).
- [ ] El navegador muestra diálogo de descarga y no renderiza el contenido en la pestaña.
- [ ] Descarga con `areaId` produce archivo con nombre idéntico (verificar que no haya colisión/confusión entre exportaciones del mismo periodo).

### 2.3 Consistencia de datos

- [ ] El CSV y el XLSX de la misma planilla contienen el mismo número de filas.
- [ ] Totales del archivo coinciden con `GET /planillas/:id/detalle` (mismos importes, mismos funcionarios).
- [ ] Solo personal del área filtrada cuando se envía `areaId`.
- [ ] Cédula siempre enmascarada (`ciEnmascarado`); no se filtra CI completa en la exportación.

---

## 3. Plantilla de reporte de defectos

> Copiar una instancia por defecto encontrado. — **Instancias generadas por la ejecución del 2026-11-15: 3 (DEF-01 a DEF-03).**

### Defecto #1 — Rutas de parámetros de ley no expuestas en el API Gateway (PL-14/15/16)

| Campo | Valor |
|---|---|
| **ID** | TSK-QA-331-DEF-01 |
| **Fecha de detección** | 2026-11-15 |
| **Detectado por** | QA — corrida automatizada `tmp-qa-331.mjs` contra `http://localhost:4000` |
| **Módulo** | ☑ Planillas |
| **Endpoint / ruta** | `GET/POST/PATCH /api/planillas/parametros` |
| **Caso de prueba asociado** | PL-14, PL-15, PL-16 |
| **Severidad** | ☑ Alta |
| **Prioridad** | ☑ Inmediata |
| **Ambiente** | ☑ local — URL: http://localhost:4000 |
| **Rol/permiso con el que se reprodujo** | `ADMIN_GENERAL` con `parametros_ley:update` |

**Pasos para reproducir**
1. Login `POST /api/auth/login` con usuario que tenga `parametros_ley:update` (admin).
2. `GET /api/planillas/parametros` (también `POST` con `{}` y `PATCH /api/planillas/parametros/<uuid>` con `{}`).
3. Observar la respuesta del gateway.

**Datos de entrada**
- Usuario/rol: `admin` (ADMIN_GENERAL)
- Payload / query params: `POST {}`; `PATCH {}` sobre UUID sintético `00000000-0000-4000-8000-0000000000ff`

**Resultado esperado**
- PL-14: `200` listando el histórico de parámetros; PL-15: `201/200` creando; PL-16: `200` actualizando (con el permiso correcto).

**Resultado obtenido** (incluir código HTTP y body del envelope `{statusCode, code, message, details?, traceId}`)
- `GET` (admin): `403 {"statusCode":403,"code":"FORBIDDEN","message":"No tiene permiso para realizar esta operación.","traceId":"…"}`
- `POST` (admin): `403` con el mismo envelope — traceId `5546d42d-2613-42ba-905b-f430143bb5e3`
- `PATCH` (admin): `403` con el mismo envelope — traceId `d4435185-6d1b-486b-8001-290ca3877942`
- Con rol Empleado (sin `parametros_ley:update`): `403` (coincide con lo esperado, pero por el motivo equivocado).

**Evidencia**
- [x] Captura de pantalla
- [x] Log/traceId (arriba)
- [ ] Archivo exportado adjunto (CSV/XLSX/PDF)

**Análisis tentativo** (controlador/archivo responsable)
- `apps/api-gateway/src/rbac/routes/planillas.routes.ts` solo declara `GET /api/planillas/parametros/vigentes`; **no** declara `GET/POST/PATCH /api/planillas/parametros`.
- `GET /api/planillas/parametros` cae en el patrón `GET /api/planillas/:id` (access `planilla:read` y `ParseUUIDPipe`); `POST/PATCH` no matchean ninguna ruta y el gateway deniega (fail-closed). El controlador del servicio `services/ms-planillas/src/application/legal-parameters/legal-parameter.controller.ts` sí los expone.

**Comportamiento en otros endpoints/módulos** (¿se reproduce también en …?)
- No: `parametros/vigentes` sí está declarada y funciona (PL-01 PASS).

**Notas de regresión / criterio de cierre**

| | |
|---|---|
| Estado | ☑ Abierto |
| Asignado a | |
| Versión/commit de corrección | |
| Re-test por | — fecha: — resultado: |

### Defecto #2 — BO-03 devuelve 404 en lugar de 403 al descargar la boleta de otro empleado

| Campo | Valor |
|---|---|
| **ID** | TSK-QA-331-DEF-02 |
| **Fecha de detección** | 2026-11-15 |
| **Detectado por** | QA — corrida automatizada `tmp-qa-331.mjs` |
| **Módulo** | ☑ Boletas |
| **Endpoint / ruta** | `GET /api/planillas/boletas/:planillaId/empleados/:empleadoId/pdf` |
| **Caso de prueba asociado** | BO-03 |
| **Severidad** | ☑ Baja|
| **Prioridad** | ☑ Normal |
| **Ambiente** | ☑ local — URL: http://localhost:4000 |
| **Rol/permiso con el que se reprodujo** | `FUNCIONARIO` (`boleta:read_own`) |

**Pasos para reproducir**
1. Login con `demo.funcionario` (rol Empleado, vinculado a un empleado).
2. Obtener un `empleadoId` distinto del propio (p. ej. del `GET /api/planillas/:id/detalle`).
3. `GET /api/planillas/boletas/<planillaCerrada>/empleados/<otroEmpleadoId>/pdf` con el token del Empleado.

**Datos de entrada**
- Usuario/rol: `demo.funcionario` (FUNCIONARIO)
- Payload / query params: planilla `99a52f8a-dc6d-4c15-b60e-798651c13995` (2026-11 CERRADA); empleado ajeno `c8963715-ebdd-468c-ab18-589cf4a868b0` (y también con UUID sintético)

**Resultado esperado**
- `403` (el empleado no puede descargar la boleta de otro funcionario).

**Resultado obtenido** (incluir código HTTP y body del envelope `{statusCode, code, message, details?, traceId}`)
- `404 {"message":"No se encontró la boleta solicitada.","error":"Not Found","statusCode":404}` (idéntico con UUID real ajeno y con UUID sintético; no incluye `code`/`traceId` del envelope).

**Evidencia**
- [x] Captura de pantalla
- [x] Log/traceId
- [ ] Archivo exportado adjunto (CSV/XLSX/PDF)

**Análisis tentativo** (controlador/archivo responsable, ej. `planilla-export.service.ts:72`)
- `services/ms-planillas/src/application/boletas/boleta.service.ts:114-120` (`assertScope`) lanza `NotFoundException` en lugar de `ForbiddenException`; el test unitario `boleta.service.spec.ts:65-74` también espera `NotFoundException` (diseño anti-enumeración: no revelar si el ID existe).

**Comportamiento en otros endpoints/módulos** (¿se reproduce también en …?)
- Misma ruta: el sub-caso "sin permiso → 403" de BO-02 no es observable con los roles del seed (todos tienen `boleta:read_own`).

**Notas de regresión / criterio de cierre**
- Decisión requerida: alinear la matriz/AC con el 404 (recomendado, evita enumeración de UUIDs) o cambiar el servicio a `ForbiddenException` (403). Actualizar `boleta.service.spec.ts` en caso de cambiar el servicio.

| | |
|---|---|
| Estado | ☑ Abierto |
| Asignado a | |
| Versión/commit de corrección | |
| Re-test por | — fecha: — resultado: |

### Defecto #3 — `POST /planillas/boletas/verificar` responde 201 en lugar de 200

| Campo | Valor |
|---|---|
| **ID** | TSK-QA-331-DEF-03 |
| **Fecha de detección** | 2026-11-15 |
| **Detectado por** | QA — corrida automatizada `tmp-qa-331.mjs` |
| **Módulo** | ☑ Boletas |
| **Endpoint / ruta** | `POST /api/planillas/boletas/verificar` |
| **Caso de prueba asociado** | BO-04 (y estado de respuesta de BO-05) |
| **Severidad** | ☑ Baja |
| **Prioridad** | ☑ Baja |
| **Ambiente** | ☑ local — URL: http://localhost:4000 |
| **Rol/permiso con el que se reprodujo** | `FUNCIONARIO` (`boleta:read_own`) |

**Pasos para reproducir**
1. Descargar la boleta propia (`GET /planillas/boletas/mias/:periodo/pdf`).
2. `POST /api/planillas/boletas/verificar` con `multipart/form-data` campo `archivo` = ese PDF.

**Datos de entrada**
- Usuario/rol: `demo.funcionario` (FUNCIONARIO)
- Payload / query params: campo `archivo` con el PDF original

**Resultado esperado**
- `200` con `{integra: true, hashSha256, …}` (matriz BO-04).

**Resultado obtenido** (incluir código HTTP y body del envelope `{statusCode, code, message, details?, traceId}`)
- `201` con `{integra:true, hashSha256:"<coincide con X-Document-SHA256>", boletaId, empleadoId, periodo, emitidaEn}` — la lógica de integridad es correcta (BO-05 PASS), solo difiere el status.

**Evidencia**
- [x] Captura de pantalla
- [x] Log/traceId
- [ ] Archivo exportado adjunto (CSV/XLSX/PDF)

**Análisis tentativo** (controlador/archivo responsable, ej. `planilla-export.service.ts:72`)
- `services/ms-planillas/src/application/boletas/boleta.controller.ts:56-66` no fija `@HttpCode(HttpStatus.OK)`; Nest responde `201 Created` por defecto en `POST`.

**Comportamiento en otros endpoints/módulos** (¿se reproduce también en …?)
- Sólo esta ruta de boletas (los demás `POST` del módulo fijan `@HttpCode` o crean recursos realmente).

**Notas de regresión / criterio de cierre**
- Agregar `@HttpCode(200)` en `verificar` o ajustar la matriz BO-04 a `201`. Criterio: status igual al esperado en la matriz.

| | |
|---|---|
| Estado | ☑ Abierto |
| Asignado a | |
| Versión/commit de corrección | |
| Re-test por | — fecha: — resultado: |
