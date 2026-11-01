# ADR de ARCA

Índice de decisiones de arquitectura. Los documentos distinguen el diseño
acordado de lo que ya está implementado en el código.

| ADR                                                           | Título                                                                        | Estado de decisión        | Estado de implementación                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| [ADR-001](./ADR-001-microservicios-y-hexagonal.md)            | Microservicios con base de datos por servicio y arquitectura hexagonal ligera | Aceptado                  | Parcial; servicios y bases separados, lógica aún incompleta             |
| [ADR-002](./ADR-002-mensajeria.md)                            | Mensajería asíncrona con RabbitMQ y Outbox                                    | Propuesto para aprobación | Parcial; ver ADR                                                        |
| [ADR-003](./ADR-003-autenticacion-rbac-auditoria.md)          | Autenticación, autorización RBAC y auditoría                                  | Propuesto                 | Parcial; seed y hardening existen, endpoints y autorización pendientes  |
| [ADR-004](./ADR-004-reglas-de-vacaciones-e-inamovilidad.md)   | Reglas de vacaciones e inamovilidad                                           | Propuesto                 | Parcial; esquemas y configuración existen, flujos de negocio pendientes |
| [ADR-005](./ADR-005-tls-en-transito.md)                       | TLS en tránsito                                                               | Propuesto                 | Pendiente en producción; RNF-04 no se cumple en local                   |
| [ADR-006](./ADR-006-proteccion-de-datos-sensibles.md)         | Protección de datos sensibles                                                 | Aceptado                  | Parcial; utilidades y esquemas existen, flujos de negocio incompletos   |
| [ADR-007](./ADR-007-privilegios-minimos-y-refuerzos-de-bd.md) | Privilegios mínimos y refuerzos de base de datos                              | Aceptado                  | Implementado en scripts y migraciones revisadas                         |

**Alcance del Sprint 1:** ADR-001 a ADR-004 son los exigidos por el Sprint
Backlog para TSK-ARQ-107. ADR-005 a ADR-007 son decisiones adicionales.
