# Errores HTTP comunes

Todas las respuestas de error usan esta forma:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Uno o más campos no son válidos.",
  "details": { "fields": { "fechaFin": "Debe ser igual o posterior a fechaInicio." } },
  "traceId": "..."
}
```

`details` es opcional y no incluye secretos. `traceId` es obligatorio y permite
correlacionar gateway, servicio y auditoría. Errores de propiedad sobre un
recurso ajeno se responden como `404 NOT_FOUND`, no revelan su existencia con 403. La autorización se comprueba también en el servicio.

| Código                            | HTTP | Cuándo ocurre                                                                                                        | Mensaje contractual                                              |
| --------------------------------- | ---: | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `VALIDATION_ERROR`                |  400 | Body, query, formato, tipo, whitelist o validación de campos no válido                                               | `Uno o más campos no son válidos.`                               |
| `PERS_FIRMA_REQUERIDA`            |  400 | Alta de empleado sin firma PNG/JPEG                                                                                  | `La firma digitalizada es obligatoria.`                          |
| `PERS_ARCHIVO_INVALIDO`           |  400 | Extensión, MIME y firma mágica no coinciden o archivo supera el límite                                               | `El archivo no es válido o supera el tamaño permitido.`          |
| `VAC_FECHAS_INVALIDAS`            |  400 | Fechas mal formadas o `fechaFin` anterior a `fechaInicio`                                                            | `El rango de fechas no es válido.`                               |
| `AUTH_INVALID_CREDENTIALS`        |  401 | Usuario/contraseña incorrectos; mensaje genérico, también para usuario inexistente                                   | `Credenciales inválidas.`                                        |
| `AUTH_TOKEN_EXPIRED`              |  401 | Access token expirado                                                                                                | `La sesión expiró.`                                              |
| `AUTH_TOKEN_INVALID`              |  401 | Token mal formado, firma, issuer o audience no válidos                                                               | `La autenticación no es válida.`                                 |
| `AUTH_REFRESH_REUSED`             |  401 | Se presenta un refresh token ya rotado/revocado; se revoca su familia                                                | `La sesión debe iniciarse nuevamente.`                           |
| `AUTH_REFRESH_INVALID`            |  401 | Refresh token inexistente, vencido o revocado sin detección de reuso                                                 | `El refresh token no es válido.`                                 |
| `AUTH_INTERNAL_SIGNATURE_INVALID` |  401 | Firma interna incorrecta, cabecera ausente o timestamp fuera de tolerancia                                           | `La solicitud interna no pudo autenticarse.`                     |
| `AUTH_ACCOUNT_LOCKED`             |  423 | Bloqueo temporal vigente o bloqueo manual; incluye `details.retryAfter` (segundos para temporal, `null` para manual) | `La cuenta está bloqueada temporalmente.`                        |
| `FORBIDDEN`                       |  403 | Permiso requerido ausente                                                                                            | `No tiene permiso para realizar esta operación.`                 |
| `VAC_AUTOAPROBACION`              |  403 | Actor intenta aprobar o resolver su propia solicitud/excepción                                                       | `No puede aprobar ni resolver su propia solicitud.`              |
| `NOT_FOUND`                       |  404 | Recurso inexistente o fuera del ámbito de propiedad del actor                                                        | `El recurso solicitado no existe.`                               |
| `CONFLICT`                        |  409 | Conflicto genérico de unicidad o estado de recurso                                                                   | `La operación entra en conflicto con el estado actual.`          |
| `PERS_CI_DUPLICADA`               |  409 | CI normalizada ya existe (`ci_hash` único)                                                                           | `Ya existe un funcionario con ese CI.`                           |
| `PERS_LIMITE_EXTRANJEROS`         |  409 | Alta superaría el límite configurable de extranjeros                                                                 | `La operación superaría el límite de funcionarios extranjeros.`  |
| `PERS_RATIFICACION_ANTICIPADA`    |  409 | Fecha de ratificación anterior al fin del periodo de prueba                                                          | `No se puede ratificar antes de completar el periodo de prueba.` |
| `PERS_INAMOVILIDAD_ACTIVA`        |  409 | Baja con inamovilidad activa y sin autorización ministerial válida                                                   | `La baja está bloqueada por inamovilidad laboral.`               |
| `PERS_AREA_CON_EMPLEADOS`         |  409 | Intento de eliminar área con empleados asignados                                                                     | `No se puede eliminar un área con empleados.`                    |
| `PERS_AREA_CON_HIJAS`             |  409 | Intento de eliminar área que aún tiene subáreas                                                                      | `No se puede eliminar un área con subáreas.`                     |
| `PERS_CICLO_JERARQUIA`            |  409 | Cambio de `padreId` produciría un ciclo                                                                              | `La jerarquía de áreas no puede contener ciclos.`                |
| `PERS_CARGO_CON_EMPLEADOS`        |  409 | Intento de eliminar cargo asignado                                                                                   | `No se puede eliminar un cargo con empleados asignados.`         |
| `VAC_NO_ELEGIBLE`                 |  422 | Empleado no está `RATIFICADO` o tiene menos de un año de antigüedad                                                  | `El funcionario todavía no es elegible para vacaciones.`         |
| `VAC_JEFE_NO_ASIGNADO`            |  409 | El funcionario elegible no tiene un jefe inmediato distinto asignado                                                 | `El funcionario no tiene un jefe inmediato distinto asignado.`   |
| `VAC_SALDO_INSUFICIENTE`          |  409 | Días solicitados exceden el saldo; `details.excepcionDisponible=true` permite iniciar la vía de excepción            | `El saldo disponible no cubre los días solicitados.`             |
| `VAC_TRASLAPE`                    |  409 | Rango coincide con solicitud existente o licencia                                                                    | `El rango solicitado se traslapa con otra gestión.`              |
| `VAC_ESTADO_INVALIDO`             |  409 | Transición no permitida desde el estado actual                                                                       | `La solicitud no admite esta transición.`                        |
| `VAC_GESTION_BLOQUEADA`           |  409 | El funcionario ya tiene dos gestiones pendientes, el máximo configurable                                             | `No se pueden acumular más de dos gestiones pendientes.`         |
| `VAC_EXCEPCION_ESTADO_INVALIDO`   |  409 | Excepción ya resuelta o no pendiente                                                                                 | `La excepción no admite esta transición.`                        |
| `RATE_LIMITED`                    |  429 | Límite por IP o cuenta superado                                                                                      | `Demasiados intentos. Intente nuevamente más tarde.`             |
| `INTERNAL_ERROR`                  |  500 | Error inesperado; respuesta no expone stack, secretos ni datos personales                                            | `Ocurrió un error interno. Use el traceId para soporte.`         |

`AUTH_ACCOUNT_LOCKED.details.retryAfter` expresa segundos hasta el siguiente
intento permitido; para bloqueo manual vale `null`. `RATE_LIMITED` puede incluir el mismo detalle. Los errores
de autenticación no incluyen si el usuario existe, excepto la respuesta
contractual de bloqueo una vez que la cuenta es conocida.
