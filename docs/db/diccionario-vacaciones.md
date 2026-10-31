# Diccionario de datos — db_vacaciones

Generado desde el DMMF del cliente Prisma. Las columnas muestran el nombre físico y los campos escalares; las relaciones se documentan aparte para distinguir las relaciones entre modelos.

## Tabla `empleado_ref` (`EmpleadoRef`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `empleado_id` | `String` | No | — | PK | — |
| `nombre_completo` | `String` | No | — | — | — |
| `area_id` | `String` | No | — | — | — |
| `jefe_empleado_id` | `String` | Sí | — | — | — |
| `estado` | `EstadoEmpleadoRef` | No | — | — | — |
| `fecha_ingreso` | `DateTime` | No | — | — | — |
| `fecha_baja` | `DateTime` | Sí | — | — | — |
| `ultimo_evento_en` | `DateTime` | No | — | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |
| — | — | — | — | — | `saldos`: EmpleadoRefToSaldoVacaciones (relación inversa → —) |
| — | — | — | — | — | `solicitudes`: EmpleadoRefToSolicitudVacacion (relación inversa → —) |
| — | — | — | — | — | `licencias`: EmpleadoRefToLicencia (relación inversa → —) |

## Tabla `saldo_vacaciones` (`SaldoVacaciones`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `empleado_id` | `String` | No | — | — | — |
| `gestion` | `Int` | No | — | — | — |
| `dias_asignados` | `Int` | No | — | — | — |
| `dias_tomados` | `Int` | No | `0` | — | — |
| `congelado` | `Boolean` | No | `false` | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `empleado`: EmpleadoRefToSaldoVacaciones (empleadoId → empleadoId) |
| — | — | — | — | — | `descuentos`: DescuentoSaldoToSaldoVacaciones (relación inversa → —) |

Restricciones únicas compuestas: `(empleadoId, gestion)`.

## Tabla `solicitud_vacacion` (`SolicitudVacacion`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `empleado_id` | `String` | No | — | — | — |
| `fecha_inicio` | `DateTime` | No | — | — | — |
| `fecha_fin` | `DateTime` | No | — | — | — |
| `dias_habiles` | `Int` | No | — | — | — |
| `estado` | `EstadoSolicitud` | No | `PENDIENTE_JEFE` | — | — |
| `jefe_empleado_id` | `String` | Sí | — | — | — |
| `aprobado_jefe_por` | `String` | Sí | — | — | — |
| `aprobado_jefe_en` | `DateTime` | Sí | — | — | — |
| `aprobado_rrhh_por` | `String` | Sí | — | — | — |
| `aprobado_rrhh_en` | `DateTime` | Sí | — | — | — |
| `motivo_rechazo` | `String` | Sí | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |
| — | — | — | — | — | `empleado`: EmpleadoRefToSolicitudVacacion (empleadoId → empleadoId) |
| — | — | — | — | — | `excepcion`: SolicitudExcepcionToSolicitudVacacion (relación inversa → —) |
| — | — | — | — | — | `descuentos`: DescuentoSaldoToSolicitudVacacion (relación inversa → —) |
| — | — | — | — | — | `historial`: HistorialSolicitudToSolicitudVacacion (relación inversa → —) |

## Tabla `descuento_saldo` (`DescuentoSaldo`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `solicitud_id` | `String` | No | — | — | — |
| `saldo_id` | `String` | No | — | — | — |
| `dias` | `Int` | No | — | — | — |
| — | — | — | — | — | `solicitud`: DescuentoSaldoToSolicitudVacacion (solicitudId → id) |
| — | — | — | — | — | `saldo`: DescuentoSaldoToSaldoVacaciones (saldoId → id) |

## Tabla `historial_solicitud` (`HistorialSolicitud`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `solicitud_id` | `String` | No | — | — | — |
| `desde` | `EstadoSolicitud` | Sí | — | — | — |
| `hacia` | `EstadoSolicitud` | No | — | — | — |
| `actor_usuario_id` | `String` | No | — | — | — |
| `comentario` | `String` | Sí | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `solicitud`: HistorialSolicitudToSolicitudVacacion (solicitudId → id) |

## Tabla `solicitud_excepcion` (`SolicitudExcepcion`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `solicitud_id` | `String` | No | — | UNIQUE | — |
| `dias_excedentes` | `Int` | No | — | — | — |
| `justificacion` | `String` | No | — | — | — |
| `estado` | `EstadoExcepcion` | No | `PENDIENTE` | — | — |
| `resuelto_por` | `String` | Sí | — | — | — |
| `resuelto_en` | `DateTime` | Sí | — | — | — |
| `comentario` | `String` | Sí | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `solicitud`: SolicitudExcepcionToSolicitudVacacion (solicitudId → id) |

## Tabla `licencia` (`Licencia`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `empleado_id` | `String` | No | — | — | — |
| `tipo` | `TipoLicencia` | No | — | — | — |
| `fecha_inicio` | `DateTime` | No | — | — | — |
| `fecha_fin` | `DateTime` | No | — | — | — |
| `estado` | `EstadoLicencia` | No | `PENDIENTE` | — | — |
| `respaldo_public_id` | `String` | Sí | — | — | — |
| `autorizado_por` | `String` | Sí | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `empleado`: EmpleadoRefToLicencia (empleadoId → empleadoId) |

## Tabla `feriado` (`Feriado`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `fecha` | `DateTime` | No | — | — | — |
| `nombre` | `String` | No | — | — | — |
| `ambito` | `AmbitoFeriado` | No | `NACIONAL` | — | — |
| `departamento` | `String` | No | `` | — | — |

Restricciones únicas compuestas: `(fecha, ambito, departamento)`.

## Tabla `configuracion_vacaciones` (`ConfiguracionVacaciones`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `clave` | `String` | No | — | PK | — |
| `valor` | `String` | No | — | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |

## Tabla `evento_procesado` (`EventoProcesado`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `event_id` | `String` | No | — | PK | — |
| `event_name` | `String` | No | — | — | — |
| `procesado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |

## Tabla `outbox_evento` (`OutboxEvento`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | — | PK | — |
| `event_name` | `String` | No | — | — | — |
| `payload` | `Json` | No | — | — | — |
| `occurred_on` | `DateTime` | No | — | — | — |
| `publicado_en` | `DateTime` | Sí | — | — | — |
| `intentos` | `Int` | No | `0` | — | — |

## Notas

- EmpleadoRef es una copia local mínima recibida por eventos; no almacena CI ni sueldo.
- empleadoId de EmpleadoRef no es una FK entre bases; jefeEmpleadoId y actores son UUID referenciales.
- OutboxEvento se escribe junto al cambio local; EventoProcesado aporta idempotencia.
