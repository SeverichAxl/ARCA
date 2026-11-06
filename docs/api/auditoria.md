# Auditoría de operaciones (TSK-DEV2-104)

La auditoría se compone de tres piezas:

1. `@arca/audit` enmascara el payload, intercepta las escrituras y entrega un
   registro al grabador configurado.
2. Un grabador persistente: `PrismaAuditLogRecorder` (ms-auth, misma base) u
   `OutboxAuditRecorder` (demás servicios, evento `AUDITORIA_REGISTRADA`).
3. El consumidor de `auth.auditoria` en ms-auth, que inserta la fila inmutable
   en `auditoria_log` y deduplica por `eventId`.

## Activación en un servicio

El paquete es global y registra el interceptor como `APP_INTERCEPTOR`. Basta
agregar una entrada al arreglo `imports` del `app.module.ts`:

```ts
// ms-auth: escribe directo en auditoria_log (misma base)
AuditModule.register({ recorder: 'prisma', prismaToken: PrismaService })

// ms-personal: inserta AUDITORIA_REGISTRADA en su outbox_evento
AuditModule.register({
  recorder: 'outbox',
  prismaToken: PrismaService,
  producer: 'ms-personal',
})
```

Requisitos del adaptador Outbox:

- El servicio debe tener `outbox_evento` y un `OutboxPublisher` habilitado
  (`publishEnabled: true`). En ms-personal ya está habilitado.
- `routingKeyFor('AUDITORIA_REGISTRADA')` devuelve `auditoria.registrada`.
  ms-auth consume la cola `auth.auditoria` con binding `auditoria.#`.
- El publicador agrega `eventId` (UUID), `version` y `producer` al sobre.

`ms-vacaciones`, `ms-contratos` y `ms-planillas` **no** están cableados en este
cambio; sus dueños deben agregar la misma línea de `AuditModule.register(...)`
cuando habiliten su publicador. Hasta entonces sus escrituras no se auditan.

## `@Audit` y acción derivada

```ts
@Post()
@Audit({ modulo: 'personal', accion: 'AREA_CREAR' })
@RequirePermission('catalogo:manage')
create(@Body() dto: CreateAreaDto) { ... }
```

Toda escritura (`POST`, `PUT`, `PATCH`, `DELETE`) se audita aunque no lleve el
decorador. En ese caso el módulo se deriva del primer segmento de la ruta y la
acción es `METODO + " " + ruta normalizada`, por ejemplo `POST /areas/:id`.
`GET` nunca se audita.

## `AuditContext` (antes/después)

El controlador o el caso de uso inyecta `AuditContext` y captura el estado:

```ts
const antes = await this.get(id);
this.auditContext.captureBefore({ estado: antes.estado });
const despues = await this.repository.updateStatus(id, dto.estado);
this.auditContext.captureAfter({ estado: despues.estado });
```

Si no se llama a `captureAfter`, el interceptor usa el body de respuesta como
`despues`. Si no se llama a `captureBefore`, `antes` queda en `null`. En las
respuestas 204 el body es vacío y `despues` queda en `null`.

Ejemplos cubiertos:

- ms-personal: crear, actualizar y eliminar áreas y cargos.
- ms-auth: crear usuario, cambiar estado, desbloquear, asignar rol y vincular
  empleado. El cambio de estado ajusta la acción a `USUARIO_ACTIVAR`,
  `USUARIO_INACTIVAR` o `USUARIO_BLOQUEAR`.

## Enmascarado

`maskSensitive()` recorre objetos, arreglos, fechas, Buffers y referencias
circulares con profundidad máxima. Las claves se comparan sin distinguir
mayúsculas ni separadores:

- `ci`: `"***"` + últimos cuatro caracteres.
- `documento*`, `remuneracion*`, `sueldo`, `salario`, `haber*`, `password*`,
  `contrasena*`, `token*`, `refresh*`, `secret*`, `authorization*`, `hash*`,
  `firma*`, `adjunt*`, `archivo*`: `"***"`.
- Cualquier Buffer/Uint8Array se reemplaza por `"***"`: nunca se incluyen bytes
  de firma o adjuntos.
- Payloads mayores a 16 KB se truncan y se devuelve
  `{ truncated: true, preview }`.

El interceptor enmascara antes de entregar al grabador; el grabador Outbox
vuelve a enmascarar antes de persistir/publicar y el consumidor de ms-auth
aplica el mismo criterio. Es defensa en profundidad.

## Resultado y errores

- `EXITO`: el handler terminó correctamente.
- `FALLIDO`: el handler lanzó una excepción. Se guardan `statusCode` y `code`
  del error; nunca el stack ni datos de entrada sensibles.

## Eventos de seguridad directos de ms-auth

`AuthService` registra directamente, sin pasar por el interceptor:

| Acción | Cuándo | usuarioId |
|---|---|---|
| `LOGIN` | login exitoso | usuario autenticado |
| `LOGIN_FALLIDO` | credenciales inválidas o rate limit | usuario si existe; `null` si no existe |
| `CUENTA_BLOQUEADA` | estado no activo o bloqueo temporal | usuario |
| `LOGOUT` | logout con o sin refresh token | principal firmado |
| `AUTH_REFRESH_REUSED` | refresh ya reemplazado/revocado o carrera de rotación | usuario de la sesión |
| `REFRESH_TOKEN_ROTAR` | rotación exitosa | usuario de la sesión |

En `LOGIN_FALLIDO` de usuario inexistente **no se guarda el nombre intentado**:
la gente suele teclear la contraseña en el campo de usuario. Por eso estos
endpoints usan `@SkipAudit()` y su registro es explícito, sin volcar el body.

## Política de fallo y limitación conocida

El interceptor audita **después** del handler, cuando el cambio de negocio ya se
confirmó. Si el registro de auditoría falla (base caída, outbox no disponible),
se emite un log de nivel `ERROR` con `eventId`, módulo, acción, método y ruta —
sin datos sensibles — y **la respuesta al cliente no se altera**.

Limitación: en una caída del grabador el cambio de negocio queda sin fila de
auditoría. La mejora futura es auditar dentro de la misma transacción en los
casos críticos (cambio de sueldo y baja), de modo que el cambio y su auditoría
se confirmen o reviertan juntos.

## Límite de alcance: 403 del gateway

Los rechazos de autorización que produce el API Gateway (`403 FORBIDDEN`, ruta
no declarada, etc.) **no** los audita este interceptor: el gateway no usa
`@arca/audit` ni se conecta a base de datos. Quedan en el `AuditSink` de solo
log del gateway y su publicación real corresponde al arquitecto, según
ADR-003.
