# ADR-001: Microservicios con base de datos por servicio y arquitectura hexagonal ligera

Estado: Aceptado · Fecha: 2026-11-01 · Responsable: Arquitecto de Software

## 1. Contexto

El Core de ARCA ya está organizado como microservicios NestJS: `ms-auth`,
`ms-personal`, `ms-vacaciones`, `ms-contratos` y `ms-planillas`. Cada uno tiene
un `schema.prisma` y una base PostgreSQL propia; la integración entre contextos
se realiza mediante eventos. El requisito de mantener el dominio separado de
la infraestructura se relaciona con RNF-08. Las HU/RF de autenticación,
personal, vacaciones, contratos y planillas motivan que cada contexto pueda
evolucionar de forma independiente.

Esta separación tiene costes concretos: `EmpleadoRef` duplica en
`ms-vacaciones` los datos mínimos del empleado y puede quedar temporalmente
desactualizado; la propagación de cambios es eventual. Ejecutar localmente
cinco servicios, cinco bases y RabbitMQ hace más compleja la demostración que
ejecutar un único proceso.

## 2. Decisión

- Mantener los límites de servicio actuales y una base de datos propiedad de
  cada servicio. No se consultan tablas de otro servicio ni se crean claves
  foráneas entre bases.
- Intercambiar únicamente los datos mínimos necesarios mediante eventos
  versionados y copias locales justificadas, como `EmpleadoRef`.
- Usar una arquitectura hexagonal ligera: separar aplicación, dominio e
  infraestructura donde exista lógica de negocio, evitando capas ceremoniales
  para los servicios que aún son stubs.
- Mantener el dominio independiente de infraestructura, de acuerdo con RNF-08.

## 3. Alternativas consideradas

1. **Monolito con una base compartida:** descartado porque elimina la autonomía
   de los contextos y acopla los cambios de todos los módulos al mismo esquema.
2. **Microservicios con una base de datos compartida:** descartado porque una
   base común permitiría acoplamiento por tablas y acceso cruzado, contrario a
   la propiedad de datos por servicio.
3. **Arquitectura hexagonal completa en todos los servicios desde Sprint 1:**
   descartada por añadir estructura sin beneficio en `ms-contratos` y
   `ms-planillas`, cuyos esquemas aún son stubs de eventos.

## 4. Consecuencias

**Positivas**

- Los servicios pueden definir y migrar sus datos sin una migración global.
- La comunicación explícita mediante eventos permite separar las escrituras
  entre contextos.
- La estructura deja espacio para aislar reglas de negocio cuando se
  implementen.

**Negativas**

- Los datos duplicados, incluido `EmpleadoRef`, requieren sincronización,
  idempotencia y tratamiento de eventos fuera de orden.
- La consistencia entre servicios es eventual, no una transacción global.
- La demo local requiere configurar y arrancar varios procesos, bases y el
  broker; los errores de configuración son más difíciles de diagnosticar.
- Los servicios stub todavía no justifican ni demuestran todas las capas
  hexagonales.

## 5. Estado de implementación

**Implementado:** cinco servicios, esquemas y bases separados; el esquema de
`ms-vacaciones` mantiene `EmpleadoRef` sin CI ni sueldo y registra
`ultimoEventoEn`. `@arca/messaging` ofrece Outbox y consumo idempotente.

**Planificado / pendiente:** completar la lógica de negocio y sus capas en los
servicios; `ms-contratos` y `ms-planillas` continúan como stubs de Sprint 1.
La réplica y la consistencia eventual dependen de la publicación y consumo
completos de cada evento, no solo de la existencia del esquema.

## 6. Trazabilidad

- **RF / HU:** RF-01 a RF-30 y HU-01 a HU-14 según el mapa contractual; el Sprint
  Backlog identifica TSK-ARQ-107 como entregable de ADRs.
- **RNF:** RNF-08 (separación de dominio e infraestructura).
- **API:** [docs/api/README.md](../api/README.md),
  [docs/api/eventos.md](../api/eventos.md).
- **BD:** [docs/db/decisiones-bd.md](../db/decisiones-bd.md),
  [docs/db/notas-migraciones.md](../db/notas-migraciones.md),
  [schema de ms-vacaciones](../../services/ms-vacaciones/prisma/schema.prisma).
- **Otros ADR:** [ADR-002](./ADR-002-mensajeria.md),
  [ADR-006](./ADR-006-proteccion-de-datos-sensibles.md).
- **Backlog:** [Sprint Backlog 1](../backlog/Sprint_Backlog_1_ARCA.docx.pdf),
  [Kata arquitectónica](../backlog/KATA%20ARQUITECT%C3%93NICO_TercerDesafio_2_2026.pdf).
