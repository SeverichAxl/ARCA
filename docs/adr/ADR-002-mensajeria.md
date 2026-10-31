# ADR-002: Mensajería asíncrona con RabbitMQ y Outbox

- **Estado:** Propuesto para aprobación
- **Fecha:** 2026-10-31

## Contexto

Los servicios mantienen bases PostgreSQL aisladas. Los datos mínimos de
empleados deben propagarse a ms-vacaciones y los eventos de auditoría deben
llegar a ms-auth sin transacciones distribuidas ni pérdida silenciosa ante
interrupciones del broker.

## Decisión

- RabbitMQ usa el exchange topic durable `arca.events` y routing keys
  contractuales definidos en [docs/api/eventos.md](../api/eventos.md).
- El servicio escribe la fila `OutboxEvento` en la misma transacción de su
  cambio local. Un publicador reclama filas pendientes ordenadas por
  `occurred_on` con `FOR UPDATE SKIP LOCKED`, publica en modo persistent y con
  confirmación, y marca `publicado_en` solo tras confirmación.
- Cada consumidor dispone de una cola principal durable, `<cola>.retry` durable
  con TTL (10 segundos por defecto, configurable) y dead-letter hacia la cola
  principal, además de `<cola>.dlq` durable.
- Cada mensaje tiene máximo tres intentos totales. Se registra el contador en
  `x-retry-count`; el mensaje fallido se confirma solo tras confirmar su envío a
  retry o DLQ. La entrega es at-least-once.
- Los consumidores deduplican por `eventId`: `EventoProcesado` y el efecto se
  escriben en la misma transacción. ms-auth usa el unique de
  `AuditoriaLog.eventId`; un duplicado se trata como ya procesado.
- Los clientes se reconectan automáticamente y cierran canales/conexiones al
  detener el servicio.
- RabbitMQ vive en el vhost `arca`. Un inicializador one-shot crea credenciales
  propias por servicio y permisos limitados a exchange/colas asignadas.

## Consecuencias

- Un broker indisponible no elimina filas pendientes de Outbox; la publicación
  puede repetirse tras una caída y los consumidores deben ser idempotentes.
- Mensajes que exceden tres intentos llegan a DLQ para inspección operativa.
- Los contratos de sobre y payload se versionan; datos sensibles no se añaden
  a los eventos de empleado.
- La conexión por servicio requiere configuración independiente de usuario,
  contraseña, host, puerto y vhost en Compose.

## Implementación Sprint 1

`@arca/messaging` ofrece `OutboxService`, publicador Nest, topología,
suscripción e idempotencia. ms-personal publica el evento de prueba desde un
endpoint interno disponible solo fuera de producción; ms-vacaciones mantiene
`EmpleadoRef` respetando `ultimoEventoEn`, sin crear saldos ni calcular
elegibilidad; ms-auth persiste `AUDITORIA_REGISTRADA` sin implementar el
interceptor publicador.
