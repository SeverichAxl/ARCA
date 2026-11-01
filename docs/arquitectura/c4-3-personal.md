# C4 nivel 3 - Componentes de ms-personal

Este diagrama descompone `ms-personal` en las capas de la arquitectura hexagonal
ligera. La infraestructura ya contiene Prisma, el guard JWT, `OutboxService` y
`OutboxPublisher` de `@arca/messaging`. La aplicación solo tiene salud y el
controlador de prueba de eventos, disponible fuera de producción. Los
controladores de negocio, casos de uso, entidades y reglas de CI, extranjeros,
inamovilidad y ratificación están planificados. El adaptador de Cloudinary
también está planificado. `ms-personal` no registra consumidores en el Sprint 1;
la idempotencia de `@arca/messaging` se usa en `ms-vacaciones` y `ms-auth`.

## Diagrama

```mermaid
flowchart TB
    classDef implemented fill:#ecfdf5,stroke:#047857,stroke-width:2px,color:#064e3b
    classDef planned fill:#fff7ed,stroke:#c2410c,stroke-width:2px,stroke-dasharray: 6 4,color:#7c2d12
    classDef external fill:#f8fafc,stroke:#475569,stroke-width:2px,color:#0f172a
    classDef externalPlanned fill:#fff7ed,stroke:#c2410c,stroke-width:2px,stroke-dasharray: 6 4,color:#7c2d12
    classDef data fill:#eff6ff,stroke:#1d4ed8,stroke-width:2px,color:#1e3a8a

    subgraph APP["Application"]
        HEALTH["HealthController<br/>implementado"]
        TEST["MessagingTestController<br/>implementado solo fuera de producción"]
        CTRL["Controladores de negocio<br/>Empleados, Áreas, Cargos, Inamovilidad y Bajas<br/>planificados"]
        UC["Casos de uso<br/>CrearEmpleado, ModificarEmpleado, Ratificar,<br/>Baja, Inamovilidad, Áreas y Cargos<br/>planificados"]
        VAL["Validaciones de aplicación<br/>CI única, límite de extranjeros,<br/>fechas y archivos<br/>planificadas"]
        AUD["Publicador de auditoría<br/>planificado"]
    end

    subgraph DOM["Domain"]
        ENT["Entidades<br/>Empleado, Área, Cargo, HistorialLaboral,<br/>InamovilidadLaboral y Baja<br/>planificadas"]
        RULES["Reglas de dominio<br/>CI única, límite de extranjeros,<br/>inamovilidad activa y ratificación anticipada<br/>planificadas"]
    end

    subgraph INFRA["Infrastructure"]
        PRISMA["PrismaService y PrismaModule<br/>implementado"]
        REPO["Repositorios Prisma<br/>Empleado, Área, Cargo, Historial y Baja<br/>planificados"]
        OUTBOX["OutboxService<br/>implementado en @arca/messaging"]
        PUB["OutboxPublisher<br/>implementado en @arca/messaging"]
        JWT["JwtAuthGuard<br/>implementado"]
        HMAC["InternalHmacGuard<br/>planificado"]
        CLOUDAD["CloudinaryAdapter<br/>planificado"]
        CONSUMER["EventConsumer<br/>disponible en @arca/messaging<br/>no registrado en ms-personal"]
    end

    subgraph DATA["Datos y mensajería"]
        DB[("db_personal<br/>schema Prisma implementado")]
        MQ["RabbitMQ<br/>exchange arca.events"]
    end

    subgraph EXT["Externo"]
        CLOUD["Cloudinary<br/>planificado"]
    end

    TEST -->|"escribe evento de prueba"| OUTBOX
    CTRL -.-> UC
    UC -.-> VAL
    UC -.-> ENT
    UC -.-> RULES
    UC -.-> REPO
    UC -.-> OUTBOX
    UC -.-> CLOUDAD
    UC -.-> AUD
    REPO -.-> PRISMA
    PRISMA --> DB
    OUTBOX --> PRISMA
    PUB --> PRISMA
    PUB --> MQ
    AUD -.-> OUTBOX
    CLOUDAD -.-> CLOUD
    JWT -.->|"protege"| CTRL
    HMAC -.->|"protege"| CTRL
    MQ -.->|"sin consumidor registrado"| CONSUMER

    subgraph LEG["Leyenda"]
        L1["Implementado"]
        L2["Planificado"]
        L3["Externo"]
        L4["Base de datos"]
    end

    class HEALTH,TEST,PRISMA,OUTBOX,PUB,JWT implemented
    class CTRL,UC,VAL,AUD,ENT,RULES,REPO,HMAC,CLOUDAD,CONSUMER planned
    class CLOUD externalPlanned
    class DB,MQ data
    class L1 implemented
    class L2 planned
    class L3 external
    class L4 data
```

## Decisiones relacionadas

- [ADR-001 - Microservicios y arquitectura hexagonal](../adr/ADR-001-microservicios-y-hexagonal.md)
- [ADR-002 - Mensajería con RabbitMQ y Outbox](../adr/ADR-002-mensajeria.md)
- [ADR-003 - Autenticación, RBAC y auditoría](../adr/ADR-003-autenticacion-rbac-auditoria.md)
- [ADR-006 - Protección de datos sensibles](../adr/ADR-006-proteccion-de-datos-sensibles.md)
- [ADR-007 - Privilegios mínimos y refuerzos de BD](../adr/ADR-007-privilegios-minimos-y-refuerzos-de-bd.md)

## Estado

**Implementado:** `PrismaService`, `PrismaModule`, el esquema `db_personal`,
`JwtAuthGuard`, `HealthController`, `MessagingTestController` no productivo,
`OutboxService` y `OutboxPublisher` con publicación habilitada. El cifrado
AES-256-GCM y el HMAC de CI están disponibles en `@arca/crypto-utils`.

**Planificado:** controladores y casos de uso de negocio, entidades y reglas
de dominio, repositorios Prisma de negocio, `InternalHmacGuard`, adaptador de
Cloudinary y publicador de auditoría. La lógica de alta, modificación,
ratificación, baja e inamovilidad no existe todavía.

**Consumidores:** `ms-personal` no registra consumidores en el Sprint 1. La
idempotencia con `EventoProcesado` se documenta en el diagrama de
`ms-vacaciones` y en el consumidor de auditoría de `ms-auth`.
