# Diccionario de datos — db_contratos

Generado desde el DMMF del cliente Prisma. Las columnas muestran el nombre físico y los campos escalares; las relaciones se documentan aparte para distinguir las relaciones entre modelos.

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

- Esquema stub de Sprint 1: contiene únicamente infraestructura de eventos.
- EventoProcesado y OutboxEvento son locales a esta base; no hay FKs entre servicios.
