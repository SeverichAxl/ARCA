# API de autenticación y autorización (ms-auth)

Rutas públicas por gateway: `/api/auth/*`. Rutas internas de ms-auth: `/auth/*`,
sin el prefijo `/api`. Las operaciones protegidas requieren
`Authorization: Bearer <access>` y validación de firma interna. La firma de
cabeceras, propiedad y forma común de error están en [README.md](./README.md).

## JWT y sesión

Access token RS256 con header `kid`; valida `iss=arca-auth`, `aud=arca-salar` y
`exp`. Payload:

```json
{
  "sub": "uuid-usuario",
  "empleadoId": "uuid-empleado",
  "rol": "JEFE_AREA",
  "permisos": ["vacaciones:approve_jefe"],
  "iss": "arca-auth",
  "aud": "arca-salar",
  "exp": 1793450000
}
```

`empleadoId` puede ser `null` para usuarios no vinculados. `familyId` nunca
forma parte del JWT. El refresh token es opaco, se almacena como hash SHA-256,
rota en cada refresh y no se devuelve su hash. Si se presenta un token anterior
ya reemplazado, ms-auth revoca toda la familia y devuelve
`AUTH_REFRESH_REUSED`. Password: mínimo 8 caracteres, al menos 1 mayúscula,
1 número y 1 símbolo; se almacena con Argon2id.

`/auth/login` tiene rate limiting independiente por IP y cuenta. Tras
`MAX_FAILED_LOGIN_ATTEMPTS` fallos, la cuenta se bloquea durante
`LOGIN_LOCK_MINUTES`; los valores iniciales del seed son 3 y 15. Este bloqueo
usa `bloqueadoHasta` y no cambia `estado=BLOQUEADO`, reservado al bloqueo
manual. Credenciales inválidas siempre producen un mensaje genérico. Login
fallido y 403 quedan auditados.

## Endpoints

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `POST /api/auth/login` -> `POST /auth/login` | Público; credenciales como único factor, sin permiso RBAC | Solo crea sesión para la cuenta autenticada por sus credenciales | `{ username: string, password: string }`; ambos obligatorios, contraseña conforme a la política para alta/cambio, no se revela si la cuenta existe | `200 { accessToken, refreshToken, tokenType: "Bearer", expiresIn }` | `VALIDATION_ERROR`, `AUTH_INVALID_CREDENTIALS`, `AUTH_ACCOUNT_LOCKED`, `RATE_LIMITED` | `LOGIN` o `LOGIN_FALLIDO` |
| `POST /api/auth/refresh` -> `POST /auth/refresh` | Público; posesión del refresh token, sin permiso RBAC | Solo rota el token presentado y su familia | `{ refreshToken: string }`; opaco y obligatorio | `200` nuevo access y refresh; el anterior queda reemplazado | `VALIDATION_ERROR`, `AUTH_REFRESH_INVALID`, `AUTH_REFRESH_REUSED`, `RATE_LIMITED` | `REFRESH_TOKEN_ROTAR` o `REFRESH_TOKEN_REUSO` |
| `POST /api/auth/logout` -> `POST /auth/logout` | Sesión propia; requiere access válido, sin permiso RBAC | Revoca el refresh token/familia del usuario autenticado; no acepta revocar sesiones ajenas | `{ refreshToken?: string }`; si se omite, revoca la sesión/familia asociada al contexto autenticado | `204` | `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`, `AUTH_REFRESH_INVALID` | `LOGOUT` |
| `POST /api/auth/usuarios` -> `POST /auth/usuarios` | `usuario:create` y `usuario:assign_role` | Crea una cuenta; nunca asigna empleado ya vinculado a otra cuenta | `{ username, email?, password, rolId }`; username único, email válido/único si existe, contraseña con política, `rolId` UUID de rol existente; whitelist | `201 { id, username, email, estado, empleadoId, rol }`; nunca hash | `VALIDATION_ERROR`, `CONFLICT`, `NOT_FOUND`, `FORBIDDEN` | `USUARIO_CREAR` |
| `GET /api/auth/usuarios` -> `GET /auth/usuarios` | `usuario:read` | Lectura de usuarios autorizada por permiso | Query paginada opcional: `q`, `estado`, `rol`, `page`, `pageSize` | `200 { data, meta }`; omite hashes y tokens | `VALIDATION_ERROR`, `FORBIDDEN` | `USUARIO_LISTAR` |
| `PATCH /api/auth/usuarios/:id/estado` -> `PATCH /auth/usuarios/:id/estado` | `usuario:update` | Solo el usuario objetivo identificado por `:id`; no se modifica otra cuenta a partir de campos del body | `{ estado: "ACTIVO" \| "INACTIVO" \| "BLOQUEADO" }`; `BLOQUEADO` representa bloqueo manual, nunca el temporal | `200 { id, estado, actualizadoEn }` | `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `USUARIO_ACTIVAR`, `USUARIO_INACTIVAR` o `USUARIO_BLOQUEAR` |
| `POST /api/auth/usuarios/:id/desbloquear` -> `POST /auth/usuarios/:id/desbloquear` | `usuario:update` | Solo desbloqueo manual del usuario indicado | Sin body; no transforma una espera temporal en sesión autorizada | `200 { id, estado: "ACTIVO" }` | `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `USUARIO_DESBLOQUEAR` |
| `PUT /api/auth/usuarios/:id/rol` -> `PUT /auth/usuarios/:id/rol` | `usuario:assign_role` | Rol del usuario indicado; rol debe existir | `{ rolId: uuid }`; un único rol existente según el esquema | `200 { id, rol }` | `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN` | `USUARIO_ASIGNAR_ROL` |
| `PUT /api/auth/usuarios/:id/empleado` -> `PUT /auth/usuarios/:id/empleado` | `usuario:update` | Vínculo único de cuenta; la referencia no puede estar asociada a otra cuenta | `{ empleadoId: uuid \| null }`; no crea/actualiza empleado ni tiene FK entre bases | `200 { id, empleadoId }` | `VALIDATION_ERROR`, `CONFLICT`, `NOT_FOUND`, `FORBIDDEN` | `USUARIO_VINCULAR_EMPLEADO` |
| `GET /api/auth/auditoria` -> `GET /auth/auditoria` | `auditoria:read` | Audit Trail solo lectura; el actor no puede cambiar filtros para acceder a otro almacén | Query: `usuarioId?`, `modulo?`, `desde?`, `hasta?` (ISO), `page`, `pageSize` | `200 { data, meta }`, orden descendente por `ocurridoEn`; payload ya enmascarado | `VALIDATION_ERROR`, `FORBIDDEN` | `AUDITORIA_CONSULTAR` |
| `GET /api/auth/roles` -> `GET /auth/roles` | `usuario:assign_role` | Catálogo de roles, solo lectura; este permiso lo tiene `ADMIN_GENERAL` | Sin body; paginación no necesaria para los siete roles | `200 { data: [{ id, codigo, nombre, descripcion, permisos }] }` | `FORBIDDEN`, `INTERNAL_ERROR` | `ROLES_CONSULTAR` |
| `GET /api/auth/permisos` -> `GET /auth/permisos` | `usuario:assign_role` | Catálogo de permisos, solo lectura; este permiso lo tiene `ADMIN_GENERAL` | Sin body; filtro opcional por `modulo` | `200 { data: [{ id, codigo, modulo, descripcion }] }` | `VALIDATION_ERROR`, `FORBIDDEN`, `INTERNAL_ERROR` | `PERMISOS_CONSULTAR` |
| `GET /api/auth/configuracion` -> `GET /auth/configuracion` | `sistema:config` | Solo lectura de parámetros permitidos | Sin body | `200 { data: [{ clave, valor, descripcion, actualizadoEn }] }` | `FORBIDDEN` | `SISTEMA_CONFIG_CONSULTAR` |
| `PATCH /api/auth/configuracion/:clave` -> `PATCH /auth/configuracion/:clave` | `sistema:config` | Modifica solo la clave incluida en la whitelist | `{ valor: string }`; claves: `MAX_FAILED_LOGIN_ATTEMPTS`, `LOGIN_LOCK_MINUTES`, `JWT_ACCESS_TTL_MIN`, `JWT_REFRESH_TTL_H`; número positivo y dentro de límites aprobados | `200 { clave, valor, actualizadoEn }` | `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN` | `SISTEMA_CONFIG_ACTUALIZAR` |

### Auditoría y privacidad

`payload_json` puede contener `{ antes, despues }` con los datos imprescindibles
para la trazabilidad, luego de enmascarar recursivamente: CI como `"***1234"` y
cualquier clave `remuneracion*`, `password*` o `token*` como `"***"`. No se
incluyen contraseñas, hashes, refresh tokens ni access tokens. El mismo
enmascarado se aplica al payload del evento. `AuditoriaLog.eventId` es único:
ms-auth lo usa para deduplicar `AUDITORIA_REGISTRADA`.

### Catálogos de roles y permisos

`GET /roles` y `GET /permisos` requieren `usuario:assign_role`, que ya existe en
el seed y está asignado a `ADMIN_GENERAL`.
