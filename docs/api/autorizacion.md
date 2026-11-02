# Autorización, RBAC y cabeceras internas firmadas

Este documento describe la implementación de TSK-DEV2-103. El API Gateway es
el único punto de entrada externo: valida el JWT, aplica la matriz RBAC por
permisos y firma las cabeceras de identidad que consumen los microservicios.
Los servicios vuelven a verificar la firma y aplican denegación por defecto.

El gateway no consulta `db_auth.rol_permiso` en cada petición. La autorización
se resuelve con el claim `permisos` del access token. La matriz del seed sigue
siendo la fuente de verdad para emitir ese claim, pero un cambio de permisos o
de rol no revoca tokens ya emitidos: rige desde el siguiente token. No hay
revocación anticipada de access tokens en este alcance.

## 1. Contrato del access token

El gateway solo acepta tokens firmados con **RS256**. Se rechaza `alg=none`,
`HS256` y cualquier otro algoritmo, incluso si se intenta usar la clave
pública como secreto.

| Elemento | Regla |
|---|---|
| Header `alg` | Debe ser exactamente `RS256`. |
| Header `kid` | Obligatorio, no vacío y presente en la configuración de claves públicas. |
| `iss` | Debe coincidir exactamente con `JWT_ISSUER`. |
| `aud` | Debe coincidir exactamente con `JWT_AUDIENCE`. |
| `exp` | Obligatorio, numérico y vigente. El gateway tolera 5 segundos de desfase al verificar. |
| `sub` | String no vacío; identifica al usuario. |
| `rol` | String no vacío con el código del rol. |
| `permisos` | Array de strings. Puede estar vacío. |
| `empleadoId` | String o `null`. Se usa `null` en cuentas técnicas. |
| `familyId` | Prohibido como claim del access token; solo existe en el refresh token. |

Un token vencido responde `401 AUTH_TOKEN_EXPIRED`; cualquier otro fallo de
autenticación responde `401 AUTH_TOKEN_INVALID`. La sesión no se renueva en el
gateway: el refresh token es un mecanismo separado.

## 2. Configuración fail-closed

El gateway no arranca si falta cualquiera de estas variables:

| Variable | Uso |
|---|---|
| `JWT_ISSUER` | Issuer esperado. |
| `JWT_AUDIENCE` | Audience esperada. |
| `JWT_PUBLIC_KEYS` | JSON `{ "kid": "-----BEGIN PUBLIC KEY-----..." }` con una o más claves. |
| `JWT_PUBLIC_KEY` + `JWT_KID` | Alternativa a `JWT_PUBLIC_KEYS` para una sola clave. |
| `INTERNAL_HMAC_KEY` | Secreto compartido para firmar y verificar las cabeceras internas. |

Cada microservicio también exige `INTERNAL_HMAC_KEY`. Si la variable no está
definida, el guard responde `401 AUTH_INTERNAL_SIGNATURE_INVALID` en lugar de
aceptar la petición sin firma.

Para desarrollo local, `scripts/dev-token.ts` exige además
`DEV_JWT_ENABLED=true` y `DEV_JWT_PRIVATE_KEY`; se niega a emitir tokens si
`NODE_ENV=production`.

## 3. Flujo de autorización del gateway

Todas las peticiones, excepto `GET /health`, pasan por un único middleware
antes del proxy:

1. Normaliza y valida la ruta solicitada.
2. Identifica el servicio por el prefijo `/api/<servicio>/`.
3. Busca la ruta y el método en la tabla RBAC del servicio.
4. Si la ruta es pública, elimina las cabeceras sensibles y reenvía.
5. Si la ruta no es pública, exige `Authorization: Bearer <token>` y verifica
   el JWT localmente.
6. Evalúa los permisos requeridos por la ruta.
7. Elimina `Authorization`, las cabeceras de identidad entrantes y cualquier
   `X-Internal-*`.
8. Firma las cabeceras internas con `INTERNAL_HMAC_KEY` y recién entonces
   reenvía al servicio destino.

Decisiones de respuesta:

| Situación | Respuesta |
|---|---|
| Ruta válida y pública | Se reenvía sin JWT. |
| Sin token en ruta protegida | `401 AUTH_TOKEN_INVALID`. |
| Token vencido | `401 AUTH_TOKEN_EXPIRED`. |
| Token inválido, algoritmo o `kid` incorrecto | `401 AUTH_TOKEN_INVALID`. |
| Token válido sin el permiso requerido | `403 FORBIDDEN`. |
| Ruta no declarada con token válido | `403 FORBIDDEN` (denegación por defecto). |
| Ruta no declarada sin token | `401 AUTH_TOKEN_INVALID`. |
| Ruta fuera de `/api/<servicio>/` | `404 NOT_FOUND`. |
| Ruta con intento de evasión | `400 VALIDATION_ERROR`. |
| Servicio destino sin URL configurada | `502 INTERNAL_ERROR`. |

La tabla no usa el nombre del rol para decidir. Cada entrada declara `anyOf`
(basta un permiso) o `allOf` (todos los permisos). El único caso `allOf` es
`POST /api/auth/usuarios`, que exige `usuario:create` y
`usuario:assign_role` a la vez.

## 4. Validación y normalización de ruta

La ruta se valida antes de decidir o reenviar. Se rechaza con
`400 VALIDATION_ERROR` cuando:

- La ruta está vacía, es relativa o supera 2048 caracteres.
- Contiene `..` (path traversal).
- Contiene `//` (doble barra).
- Contiene `\` (barra invertida).
- Contiene cualquier `%`, incluidos `%2e`, `%2f` y `%5c`. No se decodifica.
- Contiene byte nulo o caracteres de control.

Las barras finales se eliminan para la decisión y para el proxy. El query
string no participa de la autorización, pero se reenvía al servicio.

Si el primer segmento no es `api` o el segundo no es uno de `auth`, `personal`,
`vacaciones`, `contratos` o `planillas`, la respuesta es `404 NOT_FOUND`. No
existe un camino alternativo al proxy.

Las cabeceras de override de método (`X-HTTP-Method-Override`,
`X-Method-Override`, `X-HTTP-Method`) se descartan: se autoriza y reenvía el
método HTTP real. Tampoco se aceptan cabeceras de identidad enviadas por el
cliente; el gateway las elimina y las reconstruye desde el JWT.

## 5. Matriz de rutas por servicio

Las tablas viven en un archivo por servicio, junto al gateway:

- `apps/api-gateway/src/rbac/routes/auth.routes.ts`
- `apps/api-gateway/src/rbac/routes/personal.routes.ts`
- `apps/api-gateway/src/rbac/routes/vacaciones.routes.ts`
- `apps/api-gateway/src/rbac/routes/contratos.routes.ts`
- `apps/api-gateway/src/rbac/routes/planillas.routes.ts`

Cualquier endpoint nuevo debe declararse en el archivo de su servicio y, en el
controlador correspondiente, con `@RequirePermission(...)`. Una ruta ausente de
la tabla queda denegada por defecto.

### Auth

| Método | Ruta pública | Permisos |
|---|---|---|
| POST | `/api/auth/login` | público |
| POST | `/api/auth/refresh` | público |
| POST | `/api/auth/logout` | autenticado |
| POST | `/api/auth/usuarios` | `usuario:create` **y** `usuario:assign_role` |
| GET | `/api/auth/usuarios` | `usuario:read` |
| PATCH | `/api/auth/usuarios/:id/estado` | `usuario:update` |
| POST | `/api/auth/usuarios/:id/desbloquear` | `usuario:update` |
| PUT | `/api/auth/usuarios/:id/rol` | `usuario:assign_role` |
| PUT | `/api/auth/usuarios/:id/empleado` | `usuario:update` |
| GET | `/api/auth/auditoria` | `auditoria:read` |
| GET | `/api/auth/roles` | `usuario:assign_role` |
| GET | `/api/auth/permisos` | `usuario:assign_role` |
| GET | `/api/auth/configuracion` | `sistema:config` |
| PATCH | `/api/auth/configuracion/:clave` | `sistema:config` |

### Personal

| Método | Ruta pública | Permisos |
|---|---|---|
| POST | `/api/personal/employees` | `personal:create` |
| GET | `/api/personal/employees` | `personal:read` |
| GET | `/api/personal/employees/:id` | `personal:read` |
| GET | `/api/personal/employees/:id/historial` | `personal:read` |
| PATCH | `/api/personal/employees/:id` | `personal:update` |
| POST | `/api/personal/employees/:id/ratificar` | `personal:ratify` |
| POST | `/api/personal/employees/:id/baja` | `personal:baja` |
| GET | `/api/personal/employees/:id/inamovilidades` | `personal:read` |
| POST | `/api/personal/employees/:id/inamovilidades` | `personal:inamovilidad` |
| PATCH | `/api/personal/employees/:id/inamovilidades/:inamovilidadId/cerrar` | `personal:inamovilidad` |
| GET | `/api/personal/areas` | `catalogo:manage` |
| POST | `/api/personal/areas` | `catalogo:manage` |
| PATCH | `/api/personal/areas/:id` | `catalogo:manage` |
| DELETE | `/api/personal/areas/:id` | `catalogo:manage` |
| GET | `/api/personal/areas/tree` | `organigrama:read` |
| GET | `/api/personal/cargos` | `catalogo:manage` |
| POST | `/api/personal/cargos` | `catalogo:manage` |
| PATCH | `/api/personal/cargos/:id` | `catalogo:manage` |
| DELETE | `/api/personal/cargos/:id` | `catalogo:manage` |

### Vacaciones

| Método | Ruta pública | Permisos |
|---|---|---|
| GET | `/api/vacaciones/saldo` | `vacaciones:read_own`, `vacaciones:read_area` o `vacaciones:read_all` |
| POST | `/api/vacaciones/solicitudes` | `vacaciones:request` |
| GET | `/api/vacaciones/solicitudes` | `vacaciones:read_own`, `vacaciones:approve_jefe` o `vacaciones:approve_rrhh` |
| GET | `/api/vacaciones/solicitudes/:id` | `vacaciones:read_own`, `vacaciones:read_area` o `vacaciones:read_all` |
| POST | `/api/vacaciones/solicitudes/:id/aprobar-jefe` | `vacaciones:approve_jefe` |
| POST | `/api/vacaciones/solicitudes/:id/aprobar-rrhh` | `vacaciones:approve_rrhh` |
| POST | `/api/vacaciones/solicitudes/:id/rechazar` | `vacaciones:approve_jefe` o `vacaciones:approve_rrhh` |
| POST | `/api/vacaciones/solicitudes/:id/cancelar` | `vacaciones:request` |
| POST | `/api/vacaciones/solicitudes/:id/excepcion` | `vacaciones:request` |
| POST | `/api/vacaciones/excepciones/:id/resolver` | `vacaciones:excepcion_resolve` |
| GET | `/api/vacaciones/licencias` | `licencias:manage` |
| POST | `/api/vacaciones/licencias` | `licencias:manage` |
| POST | `/api/vacaciones/licencias/:id/autorizar` | `licencias:manage` |
| POST | `/api/vacaciones/licencias/:id/rechazar` | `licencias:manage` |
| GET | `/api/vacaciones/feriados` | `vacaciones:config` |
| POST | `/api/vacaciones/feriados` | `vacaciones:config` |
| PATCH | `/api/vacaciones/feriados/:id` | `vacaciones:config` |
| DELETE | `/api/vacaciones/feriados/:id` | `vacaciones:config` |
| GET | `/api/vacaciones/configuracion` | `vacaciones:config` |
| PATCH | `/api/vacaciones/configuracion/:clave` | `vacaciones:config` |
| GET | `/api/vacaciones/calendario` | `vacaciones:read_own`, `vacaciones:read_area` o `vacaciones:read_all` |

`GET /api/vacaciones/solicitudes` y `GET /api/vacaciones/solicitudes/:id`
admiten varios ámbitos porque el gateway no conoce la propiedad del recurso.
El servicio decide la vista y, cuando corresponde, valida que la solicitud
pertenezca al empleado o al área del token.

### Contratos y planillas

`docs/api` todavía no publica endpoints de negocio de estos servicios (Sprint
2). Sus tablas están vacías a propósito: cualquier ruta bajo
`/api/contratos/` o `/api/planillas/` responde `403` con token válido y `401`
sin token. Cuando exista contrato, se agrega la entrada con su permiso del
seed.

## 6. Cabeceras internas firmadas

El gateway envía al servicio destino:

| Cabecera | Contenido |
|---|---|
| `X-User-Id` | `sub` del JWT. |
| `X-Empleado-Id` | `empleadoId`; `-` cuando es `null`. |
| `X-Rol` | Código del rol. |
| `X-Permisos` | Permisos sin duplicados, ordenados lexicográficamente y separados por coma. |
| `X-Timestamp` | Epoch en milisegundos del momento de firma. |
| `X-Internal-Signature` | HMAC-SHA256 en hexadecimal sobre la cadena canónica. |

Antes de firmar se eliminan `Authorization`, `X-User-Id`, `X-Empleado-Id`,
`X-Rol`, `X-Permisos`, `X-Timestamp` y todas las cabeceras `X-Internal-*`
entrantes. Un cliente no puede imponer su identidad ni reutilizar una firma
para otra ruta o método.

### Cadena canónica

La cadena firmada es exactamente:

```text
["v1", METHOD, rutaDestinoSinQuery, userId, empleadoId|"-", rol, permisos, timestamp].join("\n")
```

Equivalentemente, ocho líneas separadas por `\n`:

```text
v1
<METHOD en mayúsculas>
<ruta destino sin query>
<userId>
<empleadoId o ->
<rol>
<permisos ordenados separados por coma>
<timestamp epoch ms>
```

La ruta destino es la que ve el servicio, sin query y sin el prefijo público
`/api`:

| Ruta pública | Ruta firmada |
|---|---|
| `/api/auth/login` | `/auth/login` |
| `/api/vacaciones/saldo` | `/vacaciones/saldo` |
| `/api/personal/employees/1` | `/employees/1` |

El caso de `personal` conserva la regla especial de su contrato interno: el
segmento `personal` no forma parte de la ruta del servicio. La misma función
`internalRoutePath()` de `@arca/internal-auth` se usa en gateway y servicios
para evitar divergencias.

La firma se calcula con:

```text
hex(HMAC-SHA256(INTERNAL_HMAC_KEY, cadenaCanonica))
```

## 7. Verificación en microservicios

Cada servicio registra `InternalAuthGuard` como `APP_GUARD`. Los archivos
`src/common/guards/jwt-auth.guard.ts` reexportan el guard del paquete común
para conservar las rutas de import existentes.

El guard:

1. Deja pasar handlers o controladores marcados con `@Public()`.
2. Exige `INTERNAL_HMAC_KEY`; si falta, responde `401`.
3. Reconstruye la cadena canónica con el método, la ruta y las cabeceras.
4. Verifica la firma con comparación de tiempo constante.
5. Exige que `X-Timestamp` esté dentro de una tolerancia de ±60 segundos.
6. Expone el principal verificado en `request.internalPrincipal` y en el
   decorador `@CurrentPrincipal()`.
7. Exige `@RequirePermission(...)`; si el handler no declara permisos,
   responde `403` (denegación por defecto).
8. Responde `403 FORBIDDEN` si el principal no tiene todos los permisos
   declarados.

Sin firma válida la respuesta es `401 AUTH_INTERNAL_SIGNATURE_INVALID`. Una
firma válida sin permiso, o un handler sin `@RequirePermission`, produce
`403 FORBIDDEN`. `GET /health` y los placeholders `POST /auth/login` y
`POST /auth/refresh` están marcados `@Public()`.

La autorización del gateway no sustituye la comprobación del servicio: el
servicio no confía en cabeceras de identidad sin firma ni en la sola validación
del gateway. Además, cada servicio debe validar la propiedad del recurso y
responder `404` cuando el recurso pertenece a otro actor o ámbito.

## 8. Herramientas de desarrollo

### Exportar la matriz

```bash
corepack pnpm rbac:export
```

Genera `apps/api-gateway/test/fixtures/rbac-matrix.json` desde `PERMISOS` y
`ROLES` del seed de `ms-auth`. La prueba `services/ms-auth/test/rbac-fixture.spec.ts`
falla si el fixture no coincide con el seed. El fixture es además la fuente de
los permisos que usa `dev-token`.

### Emitir un token de desarrollo

Con `DEV_JWT_ENABLED=true` y `DEV_JWT_PRIVATE_KEY` configurados:

```bash
corepack pnpm dev:token -- --rol JEFE_AREA
corepack pnpm dev:token -- --rol FUNCIONARIO --empleado 22222222-2222-4222-8222-222222222222
```

El script firma RS256, incluye `kid`, `iss`, `aud` y los permisos del rol según
el fixture. Se niega a ejecutarse con `NODE_ENV=production`, si falta
`DEV_JWT_ENABLED=true` o si intenta usar la misma clave que `JWT_PRIVATE_KEY`
de `ms-auth`.

## 9. Pruebas

La suite del gateway cubre:

- Verificación JWT: algoritmo, `kid`, `iss`, `aud`, `exp`, claims y `familyId`.
- Arranque fail-closed por variables faltantes o claves inválidas.
- Validación de rutas y ataques (`..`, `//`, `\`, `%2e`, `%2f`, `%5c`, nulos y
  longitud excesiva).
- Matriz completa de 7 roles por cada ruta declarada.
- Casos críticos escritos a mano y consistencia contra el fixture del seed.
- Cabeceras internas, spoofing y eliminación de identidad entrante.
- Prueba end-to-end con un destino HTTP simulado.

El paquete `@arca/internal-auth` prueba firma, verificación, canonical,
tolerancia temporal, permisos y guard.

## 10. Límites conocidos de este alcance

- `POST /auth/login`, `POST /auth/refresh` y `POST /auth/logout` siguen siendo
  placeholders en `ms-auth`; no emiten ni rotan tokens todavía.
- No hay revocación anticipada de access tokens. Un cambio de rol o permisos
  aplica al siguiente token emitido.
- `contratos` y `planillas` no tienen rutas de negocio declaradas ni contratos
  en `docs/api`.
- Los controladores de negocio de los servicios aún deben declarar
  `@RequirePermission(...)` en cada handler. Mientras no lo hagan, el guard
  deny-by-default responde `403`, aunque el gateway haya autorizado la ruta.
- La mediación de propiedad (propio, área, empresa) se valida en cada servicio;
  el gateway solo conoce permisos.
