# Secuencia - Alta de funcionario

Esta secuencia describe el alta de un funcionario desde RRHH hasta la copia
local de `ms-vacaciones`. El gateway verifica el JWT y debe exigir
`personal:create`; `ms-personal` valida, firma la subida a Cloudinary, cifra CI
y remuneración y calcula `ci_hash`. En una sola transacción escribe `Empleado`,
`HistorialLaboral` y `OutboxEvento`. El publicador lee el Outbox y publica
`EMPLEADO_CREADO` en `arca.events`. `ms-vacaciones` inserta `EventoProcesado` y
hace upsert de `EmpleadoRef`; no crea saldos ni calcula elegibilidad. Esa lógica
es de TSK-VAC-101 y está planificada, igual que la auditoría a `ms-auth`.

## Diagrama

```mermaid
sequenceDiagram
    autonumber
    actor RRHH
    participant FE as Frontend Next.js
    participant GW as API Gateway
    participant PER as ms-personal
    participant CLOUD as Cloudinary
    participant PUB as OutboxPublisher
    participant MQ as RabbitMQ
    participant VAC as ms-vacaciones
    participant AUTH as ms-auth

    Note over FE,PER: El esqueleto, Prisma, Outbox y el publicador existen. Los controladores y casos de uso de negocio están planificados.

    RRHH->>FE: Completa el alta y adjunta la firma
    FE->>GW: POST /api/personal/employees
    GW->>GW: Verifica JWT RS256 con la clave pública local
    Note over GW: Permiso personal:create - planificado, TODO RBAC
    GW->>PER: POST /employees con cabeceras internas
    Note over PER: Firma HMAC y propiedad del objeto - planificado
    PER->>PER: Valida datos, CI, área, cargo, fechas y archivo
    PER->>CLOUD: Solicita firma de subida - planificado
    CLOUD-->>PER: Firma y timestamp - planificado
    PER->>CLOUD: Sube la firma PNG o JPEG - planificado
    CLOUD-->>PER: firmaPublicId - planificado
    PER->>PER: Cifra CI y remuneración con AES-256-GCM
    PER->>PER: Calcula ci_hash con HMAC-SHA256
    PER->>PER: BEGIN
    PER->>PER: INSERT Empleado
    PER->>PER: INSERT HistorialLaboral con movimiento ALTA
    PER->>PER: INSERT OutboxEvento EMPLEADO_CREADO
    PER->>PER: COMMIT
    PER-->>GW: 201 Created
    GW-->>FE: 201 Created
    FE-->>RRHH: Alta registrada

    loop Publicación Outbox
        PUB->>PER: Lee pendientes con FOR UPDATE SKIP LOCKED
        PUB->>MQ: Publica EMPLEADO_CREADO en arca.events
        MQ-->>PUB: Confirmación persistent
        PUB->>PER: Marca publicado_en
    end

    MQ->>VAC: personal.empleado.creado
    VAC->>VAC: BEGIN
    VAC->>VAC: INSERT EventoProcesado con eventId
    VAC->>VAC: UPSERT EmpleadoRef si occurredOn no es anterior a ultimo_evento_en
    VAC->>VAC: COMMIT y ACK
    Note over VAC: EMPLEADO_CREADO solo alimenta EmpleadoRef. No crea saldos ni calcula elegibilidad.
    Note over VAC: Elegibilidad y saldos: TSK-VAC-101 - planificado.

    PER--)MQ: AUDITORIA_REGISTRADA vía Outbox - planificado
    MQ--)AUTH: auditoria.registrada
    AUTH->>AUTH: INSERT AuditoriaLog con eventId único
    AUTH--)MQ: ACK
    Note over PER,AUTH: La publicación de auditoría desde ms-personal está planificada. El consumidor de ms-auth sí existe.
```

## Decisiones relacionadas

- [ADR-002 - Mensajería con RabbitMQ y Outbox](../adr/ADR-002-mensajeria.md)
- [ADR-003 - Autenticación, RBAC y auditoría](../adr/ADR-003-autenticacion-rbac-auditoria.md)
- [ADR-006 - Protección de datos sensibles](../adr/ADR-006-proteccion-de-datos-sensibles.md)
- [ADR-007 - Privilegios mínimos y refuerzos de BD](../adr/ADR-007-privilegios-minimos-y-refuerzos-de-bd.md)

## Estado

**Implementado:** verificación JWT en gateway y servicios, esquema
`db_personal`, cifrado AES-256-GCM y HMAC de `@arca/crypto-utils`,
`OutboxService`, `OutboxPublisher`, `EventConsumer`, `EventoProcesado`, el
consumidor `consumePersonalEvent` y el consumidor de auditoría de `ms-auth`.

**Planificado:** controlador y caso de uso de alta, validaciones de negocio,
firma y carga a Cloudinary, permiso efectivo `personal:create`, firma HMAC de
cabeceras internas, publicación de `AUDITORIA_REGISTRADA` desde `ms-personal`
y cálculo de elegibilidad y saldos de TSK-VAC-101. Hoy `Cloudinary` solo tiene
variables de entorno, no cliente ni llamadas.

**Leyenda:** los pasos con la marca `planificado` no existen todavía en el
código; los demás se apoyan en código o esquema actual. La validación visual
de este diagrama se hará en mermaid.live.
