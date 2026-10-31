# Contrato de eventos

RabbitMQ transporta eventos de integración entre bases de datos aisladas. Los
eventos se publican desde Outbox y se consumen al menos una vez; consumidores
idempotentes hacen que la repetición no replique el efecto.

## Sobre

```json
{
  "eventId": "7ef67a4d-6d80-4701-902b-72c86f9d1c5f",
  "eventName": "EMPLEADO_CREADO",
  "version": 1,
  "occurredOn": "2026-10-30T14:30:00.000Z",
  "producer": "ms-personal",
  "payload": {}
}
```

| Campo | Tipo | Regla |
|---|---|---|
| `eventId` | UUID | Identificador estable; coincide con `OutboxEvento.id` |
| `eventName` | string | Nombre de evento de la tabla siguiente |
| `version` | integer | Versión del contrato; inicia en 1 |
| `occurredOn` | ISO 8601 UTC | Instante del cambio de negocio, no del consumo |
| `producer` | string | Servicio productor: `ms-personal` o servicio que registra auditoría |
| `payload` | object | Datos mínimos tipados por evento; no secretos ni sueldo/CI en eventos de empleado |

`version` y `producer` son campos nuevos respecto al backlog. `EventEnvelope`
de `packages/common-dtos` hoy no los declara.

## Exchange, routing keys y colas

- Exchange durable tipo `topic`: `arca.events`.
- Routing keys minúsculas, segmentos separados por punto:
  `personal.empleado.creado`, `personal.empleado.modificado`,
  `personal.empleado.baja`, `personal.area.actualizada`,
  `auditoria.registrada`.
- Colas durables por consumidor:

| Cola principal | Binding | Consumidor |
|---|---|---|
| `vacaciones.personal-events` | `personal.#` | ms-vacaciones |
| `auth.auditoria` | `auditoria.#` | ms-auth |

- Para cada cola `Q`, crear `Q.retry` durable con TTL y dead-letter exchange/
  routing configurado de vuelta a `Q`. Al fallar el consumo se incrementa
  `x-retry-count`; se permiten como máximo 3 intentos totales. Agotados los
  intentos, publicar en `Q.dlq` durable y alertar/inspeccionar sin descartar
  silenciosamente.
- Entrega at-least-once. Confirmar publicación solo tras persistir Outbox; el
  consumidor confirma el mensaje tras completar en una misma transacción el
  registro idempotente y su efecto.

## Eventos, payload y consumidor

Todos los eventos de empleado llevan lo mínimo para refrescar `EmpleadoRef`:
`empleadoId`, `nombreCompleto`, `areaId`, `jefeEmpleadoId`, `estado`,
`fechaIngreso`, `fechaBaja`. Nunca llevan CI, `documento`, remuneración,
finiquito ni otro sueldo. `fechaBaja` es `null` mientras no haya baja. Los
valores de estado siguen el enum del esquema (`EN_PRUEBA`, `RATIFICADO`,
`INACTIVO`).

| Nombre | Routing key | Publica | Consume / efecto |
|---|---|---|---|
| `EMPLEADO_CREADO` | `personal.empleado.creado` | ms-personal al dar de alta | ms-vacaciones crea/actualiza `EmpleadoRef` y el saldo inicial aplicable |
| `EMPLEADO_MODIFICADO` | `personal.empleado.modificado` | ms-personal al cambiar datos que afectan a `EmpleadoRef` (nombre, área, jefe, estado, ingreso) | ms-vacaciones refresca su copia local; no recibe cambios salariales |
| `EMPLEADO_DADO_DE_BAJA` | `personal.empleado.baja` | ms-personal en la misma transacción de baja | ms-vacaciones marca `EmpleadoRef` inactivo, pone `fechaBaja` y congela saldos |
| `AREA_ACTUALIZADA` | `personal.area.actualizada` | ms-personal cuando cambia nombre, padre o jefe de área | ms-vacaciones actualiza `jefeEmpleadoId` de empleados con ese `areaId`; nuevo evento, necesario para reflejar cambio de jefe |
| `AUDITORIA_REGISTRADA` | `auditoria.registrada` | Cada servicio al registrar una acción auditada | ms-auth inserta una fila inmutable en `AuditoriaLog`, deduplicando por `eventId` |

### `EMPLEADO_CREADO`

```json
{
  "empleadoId": "ec7fb95f-8ae6-48df-8a48-6a88784bef18",
  "nombreCompleto": "Ana María Rojas",
  "areaId": "a3823e8b-b25b-4835-909a-2b9c9b4e2188",
  "jefeEmpleadoId": "a340b607-44bd-44b9-9d6a-4b39080570d9",
  "estado": "EN_PRUEBA",
  "fechaIngreso": "2026-10-30",
  "fechaBaja": null
}
```

### `EMPLEADO_MODIFICADO`

```json
{
  "empleadoId": "ec7fb95f-8ae6-48df-8a48-6a88784bef18",
  "nombreCompleto": "Ana María Rojas",
  "areaId": "a3823e8b-b25b-4835-909a-2b9c9b4e2188",
  "jefeEmpleadoId": "a340b607-44bd-44b9-9d6a-4b39080570d9",
  "estado": "RATIFICADO",
  "fechaIngreso": "2025-01-15",
  "fechaBaja": null,
  "camposModificados": ["estado"]
}
```

### `EMPLEADO_DADO_DE_BAJA`

```json
{
  "empleadoId": "ec7fb95f-8ae6-48df-8a48-6a88784bef18",
  "nombreCompleto": "Ana María Rojas",
  "areaId": "a3823e8b-b25b-4835-909a-2b9c9b4e2188",
  "jefeEmpleadoId": "a340b607-44bd-44b9-9d6a-4b39080570d9",
  "estado": "INACTIVO",
  "fechaIngreso": "2025-01-15",
  "fechaBaja": "2026-10-30"
}
```

### `AREA_ACTUALIZADA`

```json
{
  "areaId": "a3823e8b-b25b-4835-909a-2b9c9b4e2188",
  "nombre": "Operaciones",
  "padreId": null,
  "jefeEmpleadoId": "a340b607-44bd-44b9-9d6a-4b39080570d9"
}
```

### `AUDITORIA_REGISTRADA`

```json
{
  "usuarioId": "b9e11067-b5f1-435f-8a82-652f747742c1",
  "accion": "EMPLEADO_MODIFICAR",
  "modulo": "personal",
  "entidad": "Empleado",
  "entidadId": "ec7fb95f-8ae6-48df-8a48-6a88784bef18",
  "datos": {
    "ci": "***1234",
    "remuneracionAnterior": "***",
    "remuneracionNueva": "***"
  }
}
```

`datos` aplica enmascarado recursivo antes de insertarse en Outbox: CI como
`"***1234"` y toda clave `remuneracion*`, `password*` o `token*` como `"***"`.
Nunca se incluyen hashes de contraseñas, ciphertexts ni tokens.

## Campos de payload

| Evento | Campos y tipo |
|---|---|
| `EMPLEADO_CREADO` | `empleadoId: uuid`, `nombreCompleto: string`, `areaId: uuid`, `jefeEmpleadoId: uuid|null`, `estado: EstadoEmpleadoRef`, `fechaIngreso: YYYY-MM-DD`, `fechaBaja: YYYY-MM-DD|null` |
| `EMPLEADO_MODIFICADO` | Los siete campos comunes de empleado y `camposModificados: string[]` (nombres lógicos permitidos; nunca valor salarial) |
| `EMPLEADO_DADO_DE_BAJA` | Los siete campos comunes de empleado; estado `INACTIVO` y fecha de baja efectiva |
| `AREA_ACTUALIZADA` | `areaId: uuid`, `nombre: string`, `padreId: uuid|null`, `jefeEmpleadoId: uuid|null` |
| `AUDITORIA_REGISTRADA` | `usuarioId: uuid|null`, `accion: string`, `modulo: string`, `entidad: string`, `entidadId: string`, `datos?: object` enmascarado; coincide con campos del DTO común |

## Orden, Outbox e idempotencia

ms-vacaciones descarta el contenido de un evento de empleado si
`occurredOn < empleado_ref.ultimo_evento_en`; no sobrescribe la copia con datos
antiguos. Si el mismo instante llega con diferente `eventId`, la deduplicación
por `eventId` se mantiene y la política de empate queda por confirmar.

El productor inserta el cambio de negocio y `OutboxEvento` en una misma
transacción (`id=eventId`, `eventName`, `payload`, `occurredOn`). El publicador
lee pendientes (`publicadoEn=null`), publica el sobre y marca fecha/intentos
según confirmación del broker. Un fallo de publicación no confirma el evento.

ms-vacaciones inserta `EventoProcesado(eventId)` y aplica el cambio de
`EmpleadoRef`/saldo en una sola transacción. Un `eventId` repetido no repite el
efecto. ms-auth inserta el evento de auditoría directamente con
`AuditoriaLog.eventId` único; el conflicto unique significa ya procesado y no
crea segunda fila. Si un consumidor falla antes del commit, no confirma el
mensaje.

`AREA_ACTUALIZADA` refresca el `jefeEmpleadoId` de todas las filas
`EmpleadoRef` asociadas al área afectada. El payload no sustituye el evento
individual de empleado cuando cambia su área o estado.
