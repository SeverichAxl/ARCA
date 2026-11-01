# C4 nivel 3 - Componentes de ms-vacaciones

Este diagrama descompone `ms-vacaciones` en las capas de la arquitectura
hexagonal ligera. La infraestructura ya tiene Prisma, el guard JWT, el
`EventConsumer` de `@arca/messaging` y `consumePersonalEvent`, que inserta
`EventoProcesado` y actualiza `EmpleadoRef` en una sola transacción. La
aplicación solo tiene salud y ese consumidor; los controladores, casos de uso y
reglas de saldo, elegibilidad, días hábiles, jefatura y transiciones están
planificados. `OutboxService` y `OutboxPublisher` existen, pero la publicación
está deshabilitada; elegibilidad y saldos son de TSK-VAC-101 y siguen planificados.

## Diagrama

```mermaid
flowchart TB
    classDef implemented fill:#ecfdf5,stroke:#047857,stroke-width:2px,color:#064e3b
    classDef planned fill:#fff7ed,stroke:#c2410c,stroke-width:2px,stroke-dasharray: 6 4,color:#7c2d12
    classDef external fill:#f8fafc,stroke:#475569,stroke-width:2px,color:#0f172a
    classDef data fill:#eff6ff,stroke:#1d4ed8,stroke-width:2px,color:#1e3a8a

    subgraph APP["Application"]
        HEALTH["HealthController<br/>implementado"]
        CONS["ConsumidorPersonalEvents<br/>implementado"]
        CTRL["Controladores de negocio<br/>Saldo, Solicitudes, Aprobaciones,<br/>Excepciones, Licencias, Feriados y Calendario<br/>planificados"]
        UC["Casos de uso<br/>ConsultarSaldo, CrearSolicitud, AprobarJefe,<br/>AprobarRrhh, Rechazar, Cancelar, Excepción,<br/>Licencias, Feriados y Calendario<br/>planificados"]
        VAL["Validaciones de aplicación<br/>elegibilidad, saldo, días hábiles, traslape,<br/>propiedad y autoaprobación<br/>planificadas"]
        AUD["Publicador de auditoría<br/>planificado"]
    end

    subgraph DOM["Domain"]
        ENT["Entidades<br/>EmpleadoRef, SaldoVacaciones, SolicitudVacacion,<br/>DescuentoSaldo, HistorialSolicitud,<br/>SolicitudExcepcion, Licencia y Feriado<br/>planificadas"]
        POL["Políticas de dominio<br/>elegibilidad, cálculo de días hábiles, saldo,<br/>jefatura, autoaprobación y transición de estado<br/>planificadas"]
    end

    subgraph INFRA["Infrastructure"]
        PRISMA["PrismaService y PrismaModule<br/>implementado"]
        CONSUMER["EventConsumer<br/>implementado en @arca/messaging"]
        IDEM["EventoProcesado<br/>implementado en el esquema"]
        REPO["Repositorios Prisma<br/>Solicitud, Saldo, Licencia y Feriado<br/>planificados"]
        OUTBOX["OutboxService<br/>disponible en @arca/messaging"]
        PUB["OutboxPublisher<br/>disponible con publicación deshabilitada"]
        JWT["JwtAuthGuard<br/>implementado"]
        HMAC["InternalHmacGuard<br/>planificado"]
    end

    subgraph DATA["Datos y mensajería"]
        DB[("db_vacaciones<br/>schema Prisma implementado")]
        MQ["RabbitMQ<br/>exchange arca.events<br/>cola vacaciones.personal-events"]
    end

    MQ -->|"AMQP"| CONSUMER
    CONSUMER --> CONS
    CONS -->|"misma transacción"| IDEM
    CONS -->|"UPSERT empleado_ref"| DB
    CONS -.->|"usa entidad de dominio planificada"| ENT
    CTRL -.-> UC
    UC -.-> VAL
    UC -.-> ENT
    UC -.-> POL
    UC -.-> REPO
    UC -.-> OUTBOX
    UC -.-> AUD
    REPO -.-> PRISMA
    PRISMA --> DB
    OUTBOX -.-> PRISMA
    PUB -.-> PRISMA
    PUB -.-> MQ
    AUD -.-> OUTBOX
    JWT -.->|"protege"| CTRL
    HMAC -.->|"protege"| CTRL

    subgraph LEG["Leyenda"]
        L1["Implementado"]
        L2["Planificado"]
        L3["Base de datos"]
    end

    class HEALTH,CONS,PRISMA,CONSUMER,IDEM,JWT,OUTBOX,PUB implemented
    class CTRL,UC,VAL,AUD,ENT,POL,REPO,HMAC planned
    class DB,MQ data
    class L1 implemented
    class L2 planned
    class L3 data
```

## Decisiones relacionadas

- [ADR-001 - Microservicios y arquitectura hexagonal](../adr/ADR-001-microservicios-y-hexagonal.md)
- [ADR-002 - Mensajería con RabbitMQ y Outbox](../adr/ADR-002-mensajeria.md)
- [ADR-003 - Autenticación, RBAC y auditoría](../adr/ADR-003-autenticacion-rbac-auditoria.md)
- [ADR-004 - Reglas de vacaciones e inamovilidad](../adr/ADR-004-reglas-de-vacaciones-e-inamovilidad.md)
- [ADR-006 - Protección de datos sensibles](../adr/ADR-006-proteccion-de-datos-sensibles.md)
- [ADR-007 - Privilegios mínimos y refuerzos de BD](../adr/ADR-007-privilegios-minimos-y-refuerzos-de-bd.md)

## Estado

**Implementado:** `PrismaService`, `PrismaModule`, el esquema `db_vacaciones`,
`JwtAuthGuard`, `HealthController`, `EventConsumer`, `consumePersonalEvent` y
`EventoProcesado`. El consumidor actualiza `EmpleadoRef` con `ultimoEventoEn` y
no crea saldos ni calcula elegibilidad.

**Planificado:** controladores y casos de uso de negocio, entidades y políticas
de dominio, repositorios Prisma de negocio, `InternalHmacGuard`, publicación
Outbox de auditoría y el cálculo de elegibilidad y saldos de TSK-VAC-101. La
aprobación final atómica con `updateMany` y `descuento_saldo` está especificada
en [docs/api/vacaciones.md](../api/vacaciones.md), pero no implementada.

**Idempotencia:** `EventConsumer` inserta `EventoProcesado` y ejecuta el
handler en la misma transacción. Un `eventId` repetido se confirma sin repetir
el efecto. `EmpleadoRef` descarta eventos con `occurredOn` anterior a
`ultimo_evento_en`.
