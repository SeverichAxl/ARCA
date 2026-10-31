# Diccionario de datos — db_personal

Generado desde el DMMF del cliente Prisma. Las columnas muestran el nombre físico y los campos escalares; las relaciones se documentan aparte para distinguir las relaciones entre modelos.

## Tabla `area` (`Area`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `nombre` | `String` | No | — | — | — |
| `padre_id` | `String` | Sí | — | — | — |
| `jefe_id` | `String` | Sí | — | — | — |
| `activa` | `Boolean` | No | `true` | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `padre`: AreaArbol (padreId → id) |
| — | — | — | — | — | `hijas`: AreaArbol (relación inversa → —) |
| — | — | — | — | — | `jefe`: AreaJefe (jefeId → id) |
| — | — | — | — | — | `empleados`: AreaEmpleados (relación inversa → —) |

Restricciones únicas compuestas: `(nombre, padreId)`.

## Tabla `cargo` (`Cargo`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `nombre` | `String` | No | — | UNIQUE | — |
| `descripcion` | `String` | Sí | — | — | — |
| `activo` | `Boolean` | No | `true` | — | — |
| — | — | — | — | — | `empleados`: CargoToEmpleado (relación inversa → —) |

## Tabla `empleado` (`Empleado`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `nombres` | `String` | No | — | — | — |
| `apellidos` | `String` | No | — | — | — |
| `ci_cifrado` | `String` | No | — | — | — |
| `ci_hash` | `String` | No | — | UNIQUE | — |
| `ci_expedido` | `String` | Sí | — | — | — |
| `fecha_nacimiento` | `DateTime` | Sí | — | — | — |
| `es_extranjero` | `Boolean` | No | `false` | — | — |
| `email` | `String` | Sí | — | — | — |
| `telefono` | `String` | Sí | — | — | — |
| `direccion` | `String` | Sí | — | — | — |
| `area_id` | `String` | No | — | — | — |
| `cargo_id` | `String` | No | — | — | — |
| `remuneracion_cifrada` | `String` | No | — | — | — |
| `fecha_ingreso` | `DateTime` | No | — | — | — |
| `dias_prueba` | `Int` | No | `90` | — | — |
| `estado` | `EstadoEmpleado` | No | `EN_PRUEBA` | — | — |
| `fecha_ratificacion` | `DateTime` | Sí | — | — | — |
| `firma_public_id` | `String` | No | — | — | — |
| `creado_por` | `String` | No | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |
| — | — | — | — | — | `area`: AreaEmpleados (areaId → id) |
| — | — | — | — | — | `cargo`: CargoToEmpleado (cargoId → id) |
| — | — | — | — | — | `areasQueJefatura`: AreaJefe (relación inversa → —) |
| — | — | — | — | — | `historial`: EmpleadoToHistorialLaboral (relación inversa → —) |
| — | — | — | — | — | `inamovilidades`: EmpleadoToInamovilidadLaboral (relación inversa → —) |
| — | — | — | — | — | `baja`: BajaToEmpleado (relación inversa → —) |

## Tabla `historial_laboral` (`HistorialLaboral`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `empleado_id` | `String` | No | — | — | — |
| `tipo` | `TipoMovimiento` | No | — | — | — |
| `fecha_efectiva` | `DateTime` | No | — | — | — |
| `motivo` | `String` | Sí | — | — | — |
| `area_anterior_id` | `String` | Sí | — | — | — |
| `area_nueva_id` | `String` | Sí | — | — | — |
| `cargo_anterior_id` | `String` | Sí | — | — | — |
| `cargo_nuevo_id` | `String` | Sí | — | — | — |
| `remuneracion_anterior_cifrada` | `String` | Sí | — | — | — |
| `remuneracion_nueva_cifrada` | `String` | Sí | — | — | — |
| `registrado_por` | `String` | No | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `empleado`: EmpleadoToHistorialLaboral (empleadoId → id) |

## Tabla `inamovilidad_laboral` (`InamovilidadLaboral`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `empleado_id` | `String` | No | — | — | — |
| `tipo` | `TipoInamovilidad` | No | — | — | — |
| `fecha_inicio` | `DateTime` | No | — | — | — |
| `fecha_fin` | `DateTime` | Sí | — | — | — |
| `estado_activo` | `Boolean` | No | `true` | — | — |
| `respaldo_public_id` | `String` | Sí | — | — | — |
| `observacion` | `String` | Sí | — | — | — |
| `registrado_por` | `String` | No | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `empleado`: EmpleadoToInamovilidadLaboral (empleadoId → id) |

## Tabla `baja` (`Baja`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `empleado_id` | `String` | No | — | UNIQUE | — |
| `fecha_baja` | `DateTime` | No | — | — | — |
| `motivo` | `String` | No | — | — | — |
| `aplica_desahucio` | `Boolean` | No | `false` | — | — |
| `autorizacion_mt_public_id` | `String` | Sí | — | — | — |
| `sueldo_promedio_cifrado` | `String` | No | — | — | — |
| `finiquito_total_cifrado` | `String` | No | — | — | — |
| `finiquito_detalle_cifrado` | `String` | No | — | — | — |
| `registrado_por` | `String` | No | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `empleado`: BajaToEmpleado (empleadoId → id) |

## Tabla `outbox_evento` (`OutboxEvento`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | — | PK | — |
| `event_name` | `String` | No | — | — | — |
| `payload` | `Json` | No | — | — | — |
| `occurred_on` | `DateTime` | No | — | — | — |
| `publicado_en` | `DateTime` | Sí | — | — | — |
| `intentos` | `Int` | No | `0` | — | — |

## Tabla `configuracion_personal` (`ConfiguracionPersonal`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `clave` | `String` | No | — | PK | — |
| `valor` | `String` | No | — | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |

## Notas

- CI y remuneraciones se cifran con AES-256-GCM; ciHash es HMAC-SHA256 para igualdad exacta.
- creadoPor, registradoPor y Area.jefeId son UUID de otros agregados/cuentas; no deben interpretarse como FKs entre bases.
- firmaPublicId y los IDs de respaldo son referencias a almacenamiento externo, no URLs firmadas.
- OutboxEvento se escribe en la misma transacción del cambio de negocio.
