# Diccionario de datos — db_auth

Generado desde el DMMF del cliente Prisma. Las columnas muestran el nombre físico y los campos escalares; las relaciones se documentan aparte para distinguir las relaciones entre modelos.

## Tabla `usuario` (`Usuario`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `username` | `String` | No | — | UNIQUE | — |
| `email` | `String` | Sí | — | UNIQUE | — |
| `password_hash` | `String` | No | — | — | — |
| `estado` | `EstadoUsuario` | No | `ACTIVO` | — | — |
| `intentos_fallidos` | `Int` | No | `0` | — | — |
| `bloqueado_hasta` | `DateTime` | Sí | — | — | — |
| `debe_cambiar_password` | `Boolean` | No | `false` | — | — |
| `empleado_id` | `String` | Sí | — | UNIQUE | — |
| `rol_id` | `String` | No | — | — | — |
| `ultimo_login_en` | `DateTime` | Sí | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |
| — | — | — | — | — | `rol`: RolToUsuario (rolId → id) |
| — | — | — | — | — | `refreshTokens`: RefreshTokenToUsuario (relación inversa → —) |

## Tabla `rol` (`Rol`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `codigo` | `String` | No | — | UNIQUE | — |
| `nombre` | `String` | No | — | — | — |
| `descripcion` | `String` | Sí | — | — | — |
| — | — | — | — | — | `usuarios`: RolToUsuario (relación inversa → —) |
| — | — | — | — | — | `permisos`: RolToRolPermiso (relación inversa → —) |

## Tabla `permiso` (`Permiso`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `codigo` | `String` | No | — | UNIQUE | — |
| `modulo` | `String` | No | — | — | — |
| `descripcion` | `String` | No | — | — | — |
| — | — | — | — | — | `roles`: PermisoToRolPermiso (relación inversa → —) |

## Tabla `rol_permiso` (`RolPermiso`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `rol_id` | `String` | No | — | PK | — |
| `permiso_id` | `String` | No | — | PK | — |
| — | — | — | — | — | `rol`: RolToRolPermiso (rolId → id) |
| — | — | — | — | — | `permiso`: PermisoToRolPermiso (permisoId → id) |

## Tabla `refresh_token` (`RefreshToken`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `usuario_id` | `String` | No | — | — | — |
| `token_hash` | `String` | No | — | UNIQUE | — |
| `family_id` | `String` | No | — | — | — |
| `reemplazado_por` | `String` | Sí | — | — | — |
| `expira_en` | `DateTime` | No | — | — | — |
| `revocado_en` | `DateTime` | Sí | — | — | — |
| `ip_origen` | `String` | Sí | — | — | — |
| `user_agent` | `String` | Sí | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `usuario`: RefreshTokenToUsuario (usuarioId → id) |

## Tabla `auditoria_log` (`AuditoriaLog`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `BigInt` | No | `{"name":"autoincrement","args":[]}` | PK | — |
| `event_id` | `String` | No | — | UNIQUE | — |
| `usuario_id` | `String` | Sí | — | — | — |
| `ip_origen` | `String` | Sí | — | — | — |
| `modulo` | `String` | No | — | — | — |
| `accion` | `String` | No | — | — | — |
| `metodo` | `String` | Sí | — | — | — |
| `recurso` | `String` | Sí | — | — | — |
| `resultado` | `ResultadoAuditoria` | No | `EXITO` | — | — |
| `payload_json` | `Json` | Sí | — | — | — |
| `ocurrido_en` | `DateTime` | No | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |

## Tabla `configuracion_sistema` (`ConfiguracionSistema`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `clave` | `String` | No | — | PK | — |
| `valor` | `String` | No | — | — | — |
| `descripcion` | `String` | Sí | — | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |

## Notas

- Usuario.empleadoId es una referencia UUID sin FK a db_personal.empleado.
- passwordHash almacena hashes Argon2id, nunca contraseñas.
- RefreshToken.tokenHash almacena SHA-256 del token opaco; familyId se conserva solo en esta tabla.
- AuditoriaLog es solo inserción; el payload debe llegar con CI/sueldos enmascarados.
