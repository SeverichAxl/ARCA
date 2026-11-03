# C4 nivel 1 - Contexto del Sistema de Gestión Humana

Este diagrama sitúa el Sistema de Gestión Humana de ARCA Ltda. frente a sus
actores y sistemas externos. Los actores corresponden a los siete roles del
seed de `ms-auth`: Funcionario, Jefe de Área, RRHH, Encargado de Nómina,
Gerencia o Directorio, Auditor y Administrador. El sistema agrupa autenticación,
personal, vacaciones, contratos y planillas. El Core de ARCA es externo y no
tiene integración en el MVP. Cloudinary se usa para firmas y respaldos, pero su
integración está planificada y hoy solo existe configuración de entorno.

## Diagrama

```mermaid
flowchart TB
    classDef actor fill:#eef2ff,stroke:#4338ca,stroke-width:2px,color:#1e1b4b
    classDef implemented fill:#ecfdf5,stroke:#047857,stroke-width:2px,color:#064e3b
    classDef planned fill:#fff7ed,stroke:#c2410c,stroke-width:2px,stroke-dasharray: 6 4,color:#7c2d12
    classDef external fill:#f8fafc,stroke:#475569,stroke-width:2px,color:#0f172a
    classDef externalPlanned fill:#fff7ed,stroke:#c2410c,stroke-width:2px,stroke-dasharray: 6 4,color:#7c2d12

    subgraph ACT["Actores"]
        FUN["Funcionario"]
        JEF["Jefe de Área"]
        RRHH["RRHH"]
        NOM["Encargado de Nómina"]
        GER["Gerencia o Directorio"]
        AUD["Auditor"]
        ADM["Administrador"]
    end

    subgraph SGH["Sistema de Gestión Humana ARCA"]
        SIS["Plataforma de Gestión Humana<br/>Autenticación, Personal, Vacaciones, Contratos y Planillas"]
    end

    subgraph EXT["Sistemas externos"]
        CLOUD["Cloudinary<br/>firmas y respaldos"]
        CORE["Core de ARCA<br/>sin integración en el MVP - supuesto"]
    end

    FUN -->|"Consulta sus datos, saldo y solicitudes"| SIS
    JEF -->|"Aprueba vacaciones de su área"| SIS
    RRHH -->|"Gestiona expedientes, altas, bajas y aprobación final"| SIS
    NOM -->|"Consulta personal y procesa planillas"| SIS
    GER -->|"Lectura transversal y resolución de excepciones"| SIS
    AUD -->|"Consulta el Audit Trail"| SIS
    ADM -->|"Administra usuarios, roles y parámetros"| SIS

    SIS -.->|"HTTPS - integración planificada"| CLOUD
    SIS -.->|"sin integración en el MVP - supuesto"| CORE

    subgraph LEG["Leyenda"]
        L1["Implementado"]
        L2["Planificado"]
        L3["Externo o supuesto"]
    end

    class FUN,JEF,RRHH,NOM,GER,AUD,ADM actor
    class SIS implemented
    class CLOUD planned
    class CORE externalPlanned
    class L1 implemented
    class L2 planned
    class L3 external
```

## Decisiones relacionadas

- [ADR-001 - Microservicios y arquitectura hexagonal](../adr/ADR-001-microservicios-y-hexagonal.md)
- [ADR-002 - Mensajería con RabbitMQ y Outbox](../adr/ADR-002-mensajeria.md)
- [ADR-003 - Autenticación, RBAC y auditoría](../adr/ADR-003-autenticacion-rbac-auditoria.md)
- [ADR-004 - Reglas de vacaciones e inamovilidad](../adr/ADR-004-reglas-de-vacaciones-e-inamovilidad.md)
- [ADR-005 - TLS en tránsito](../adr/ADR-005-tls-en-transito.md)
- [ADR-006 - Protección de datos sensibles](../adr/ADR-006-proteccion-de-datos-sensibles.md)

## Estado

**Implementado:** el esqueleto de los cinco servicios, el frontend, el API
Gateway, PostgreSQL con una base por servicio, RabbitMQ y los siete roles del
seed de autenticación.

**Planificado:** la integración con Cloudinary para firmas y respaldos. El Core
de ARCA no tiene integración en el MVP; se mantiene como supuesto y cualquier
sincronización futura requiere una decisión arquitectónica propia.

**Leyenda:** el trazo continuo verde representa lo implementado; el trazo
punteado naranja, lo planificado; el gris, un sistema externo o un supuesto.
