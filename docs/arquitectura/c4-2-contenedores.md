# C4 nivel 2 - Contenedores

Este diagrama muestra los contenedores desplegables y su ubicación de red. Solo
el frontend Next.js en 3000 y el API Gateway en 4000 se publican al host. Los
cinco microservicios en 4001 a 4005 y sus bases PostgreSQL son internos a
`arca-net`; PostgreSQL y RabbitMQ se exponen solo en loopback para desarrollo.
Todo acceso externo entra por el gateway con REST y el prefijo `/api`. La
integración entre servicios es asíncrona con AMQP sobre `arca.events`.
`ms-contratos` y `ms-planillas` siguen como stubs. Cloudinary está planificado y
el Core de ARCA no se integra en el MVP.

## Diagrama

```mermaid
flowchart TB
    classDef implemented fill:#ecfdf5,stroke:#047857,stroke-width:2px,color:#064e3b
    classDef planned fill:#fff7ed,stroke:#c2410c,stroke-width:2px,stroke-dasharray: 6 4,color:#7c2d12
    classDef external fill:#f8fafc,stroke:#475569,stroke-width:2px,color:#0f172a
    classDef externalPlanned fill:#fff7ed,stroke:#c2410c,stroke-width:2px,stroke-dasharray: 6 4,color:#7c2d12
    classDef data fill:#eff6ff,stroke:#1d4ed8,stroke-width:2px,color:#1e3a8a

    subgraph HOST["Publicado al host"]
        WEB["Frontend Next.js<br/>:3000<br/>App Router"]
        GW["API Gateway NestJS<br/>:4000<br/>JWT, proxy y rate limit"]
    end

    subgraph INTERNAL["Red interna arca-net - solo interno"]
        AUTH["ms-auth<br/>:4001<br/>login y refresh responden 501"]
        PERSONAL["ms-personal<br/>:4002<br/>esqueleto y Outbox"]
        VAC["ms-vacaciones<br/>:4003<br/>consumidor de personal"]
        CONTRATOS["ms-contratos<br/>:4004<br/>stub de eventos"]
        PLANILLAS["ms-planillas<br/>:4005<br/>stub de eventos"]
        MQ["RabbitMQ 3<br/>exchange arca.events<br/>colas vacaciones.personal-events y auth.auditoria<br/>127.0.0.1:5672 y 15672 solo desarrollo"]
        DBA[("db_auth<br/>PostgreSQL 16")]
        DBP[("db_personal<br/>PostgreSQL 16")]
        DBV[("db_vacaciones<br/>PostgreSQL 16")]
        DBC[("db_contratos<br/>PostgreSQL 16")]
        DBPN[("db_planillas<br/>PostgreSQL 16")]
    end

    subgraph EXT["Sistemas externos"]
        CLOUD["Cloudinary<br/>firmas y respaldos"]
        CORE["Core de ARCA<br/>sin integración en el MVP - supuesto"]
    end

    WEB -->|"REST - HTTP en local y HTTPS en producción"| GW
    GW -->|"REST"| AUTH
    GW -->|"REST"| PERSONAL
    GW -->|"REST"| VAC
    GW -->|"REST"| CONTRATOS
    GW -->|"REST"| PLANILLAS

    AUTH -->|"Prisma"| DBA
    PERSONAL -->|"Prisma"| DBP
    VAC -->|"Prisma"| DBV
    CONTRATOS -->|"Prisma"| DBC
    PLANILLAS -->|"Prisma"| DBPN

    AUTH -->|"AMQP - consume auditoría y publicación planificada"| MQ
    PERSONAL -->|"AMQP - publica Outbox"| MQ
    MQ -->|"AMQP - consume"| VAC
    VAC -.->|"AMQP - auditoría planificada"| MQ

    PERSONAL -.->|"HTTPS - integración planificada"| CLOUD
    GW -.->|"sin integración en el MVP - supuesto"| CORE

    subgraph LEG["Leyenda"]
        L1["Implementado"]
        L2["Planificado o stub"]
        L3["Externo o supuesto"]
        L4["Base de datos"]
    end

    class WEB,GW,AUTH,PERSONAL,VAC,MQ implemented
    class CONTRATOS,PLANILLAS planned
    class CLOUD planned
    class CORE externalPlanned
    class DBA,DBP,DBV,DBC,DBPN data
    class L1 implemented
    class L2 planned
    class L3 external
    class L4 data
```

## Decisiones relacionadas

- [ADR-001 - Microservicios y arquitectura hexagonal](../adr/ADR-001-microservicios-y-hexagonal.md)
- [ADR-002 - Mensajería con RabbitMQ y Outbox](../adr/ADR-002-mensajeria.md)
- [ADR-003 - Autenticación, RBAC y auditoría](../adr/ADR-003-autenticacion-rbac-auditoria.md)
- [ADR-005 - TLS en tránsito](../adr/ADR-005-tls-en-transito.md)
- [ADR-006 - Protección de datos sensibles](../adr/ADR-006-proteccion-de-datos-sensibles.md)
- [ADR-007 - Privilegios mínimos y refuerzos de BD](../adr/ADR-007-privilegios-minimos-y-refuerzos-de-bd.md)

## Estado

**Implementado:** frontend y gateway publicados en 3000 y 4000; los cinco
servicios y sus cinco bases en la red interna; exchange `arca.events`, colas
durables, reintentos y DLQ; publicador Outbox en `ms-personal`; consumidores de
`ms-vacaciones` y `ms-auth`.

**Planificado:** la lógica de negocio de los cinco servicios, la firma HMAC de
cabeceras internas, la verificación efectiva de permisos, la integración con
Cloudinary y la integración con el Core de ARCA. `ms-contratos` y
`ms-planillas` solo tienen los modelos `EventoProcesado` y `OutboxEvento`.

**Publicación al host:** solo `web-frontend:3000` y `api-gateway:4000`.
PostgreSQL en `127.0.0.1:5432` y RabbitMQ en `127.0.0.1:5672` y `15672` son
puertos de desarrollo en loopback, no exposición pública de los servicios.
