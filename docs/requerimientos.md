# Requerimientos y matriz de trazabilidad

**Versión:** 1.0 · **Alcance:** Sprint 1, requisitos RF-01 a RF-17 y RF-30 · **Responsable de mantenimiento:** Scrum Master; validar cambios funcionales con Product Owner y cambios técnicos con Arquitectura.

## Fuente y estado

Este catálogo sintetiza los contratos de API, las decisiones de arquitectura y las tareas identificadas en el repositorio. Los archivos fuente del Product Backlog y del Sprint Backlog no están versionados aquí; por ello, las descripciones RF no se presentan como transcripción literal. Antes de cerrar la trazabilidad del sprint, reconciliar esta matriz con esos backlogs y completar los códigos de tareas que no aparecen en los artefactos disponibles.

La matriz vincula requisitos funcionales con historias y tareas conocidas. Una celda marcada **por confirmar** indica que falta el código exacto en el Sprint Backlog; no debe interpretarse como una asignación aprobada.

## Requisitos funcionales

| ID    | Requisito resumido                                                                                                 | Historia relacionada                                                                                          | Contrato / evidencia                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| RF-01 | Iniciar sesión con credenciales y emitir una sesión autenticada.                                                   | HU-01                                                                                                         | [API de autenticación](./api/auth.md)                              |
| RF-02 | Renovar y cerrar sesiones mediante refresh token, incluyendo rotación y revocación según el contrato.              | HU-01                                                                                                         | [API de autenticación](./api/auth.md)                              |
| RF-03 | Autorizar operaciones mediante permisos explícitos y denegar por defecto rutas no autorizadas.                     | HU-01                                                                                                         | [Autorización y RBAC](./api/autorizacion.md)                       |
| RF-04 | Administrar usuarios, roles y vínculo de usuario con empleado.                                                     | HU-03                                                                                                         | [API de autenticación](./api/auth.md)                              |
| RF-05 | Registrar y consultar auditoría de acciones relevantes, protegiendo su integridad y enmascarando datos sensibles.  | HU-02                                                                                                         | [API de autenticación](./api/auth.md), [eventos](./api/eventos.md) |
| RF-06 | Registrar expedientes de empleados y sus datos laborales con controles de privacidad.                              | HU-04                                                                                                         | [API de personal](./api/personal.md)                               |
| RF-07 | Consultar y ratificar el expediente del empleado conforme a su estado y antigüedad.                                | HU-05                                                                                                         | [API de personal](./api/personal.md)                               |
| RF-08 | Tramitar la baja de un empleado, respetando la inamovilidad y la autorización ministerial aplicable.               | HU-06                                                                                                         | [API de personal](./api/personal.md)                               |
| RF-09 | Consultar y actualizar información laboral dentro del ámbito autorizado, conservando el historial correspondiente. | HU-07                                                                                                         | [API de personal](./api/personal.md)                               |
| RF-10 | Administrar áreas y cargos de la organización.                                                                     | HU-08                                                                                                         | [API de personal](./api/personal.md)                               |
| RF-11 | Consultar el historial laboral de un empleado dentro del ámbito autorizado.                                        | HU-11                                                                                                         | [API de personal](./api/personal.md)                               |
| RF-12 | Consultar la estructura organizacional y sus relaciones jerárquicas.                                               | HU-09                                                                                                         | [API de personal](./api/personal.md)                               |
| RF-13 | Publicar y consumir cambios de empleados mediante eventos para mantener las referencias locales actualizadas.      | HU-10                                                                                                         | [Eventos](./api/eventos.md)                                        |
| RF-14 | Determinar la elegibilidad para vacaciones usando estado laboral y antigüedad.                                     | HU-05 a HU-07                                                                                                 | [API de vacaciones](./api/vacaciones.md)                           |
| RF-15 | Consultar y mantener saldos de vacaciones por gestión, incluidos días asignados, tomados y excepcionales.          | HU-12                                                                                                         | [API de vacaciones](./api/vacaciones.md)                           |
| RF-16 | Crear solicitudes de vacaciones validando fechas, días hábiles, saldo, traslapes y jefe inmediato.                 | HU-12                                                                                                         | [API de vacaciones](./api/vacaciones.md)                           |
| RF-17 | Aprobar o rechazar solicitudes en niveles de jefatura y RRHH, con flujo separado para excepciones.                 | HU-13 según el Product Backlog; HU-14 aparece en la etiqueta de TSK-VAC-103 del Sprint Backlog, por confirmar | [API de vacaciones](./api/vacaciones.md)                           |
| RF-30 | Propagar cambios de área y jefatura mediante eventos para actualizar referencias y propiedad de solicitudes.       | HU-10                                                                                                         | [Eventos](./api/eventos.md)                                        |

RF-18 y RF-19 no están dentro del alcance RF solicitado para este entregable. Sus rutas y contratos se mantienen documentados en [API de vacaciones](./api/vacaciones.md).

## Requisitos no funcionales

| ID / categoría            | Requisito resumido                                                                                                                                      | Fuente                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| RNF-04                    | TLS 1.3 es obligatorio para el transporte; la configuración local HTTP no cumple este requisito.                                                        | [ADR-005](./adr/ADR-005-tls-en-transito.md)                                                                               |
| RNF-05                    | La solución debe operar con el volumen aproximado de 200 empleados considerado para el MVP; las decisiones de cifrado no deben exponer datos sensibles. | [ADR-006](./adr/ADR-006-proteccion-de-datos-sensibles.md)                                                                 |
| RNF-08                    | Mantener separación entre dominio e infraestructura y propiedad de datos por microservicio.                                                             | [ADR-001](./adr/ADR-001-microservicios-y-hexagonal.md), [ADR-007](./adr/ADR-007-privilegios-minimos-y-refuerzos-de-bd.md) |
| Seguridad transversal     | Validar JWT RS256, autorización por permisos, firma HMAC entre gateway y servicios, propiedad del recurso y denegación por defecto.                     | [Autorización y RBAC](./api/autorizacion.md)                                                                              |
| Privacidad transversal    | Cifrar CI y remuneración, excluirlos de eventos cuando no sean necesarios y enmascarar datos sensibles en auditoría.                                    | [ADR-006](./adr/ADR-006-proteccion-de-datos-sensibles.md)                                                                 |
| Integridad y trazabilidad | Aplicar transiciones y descuentos de saldo atómicamente; conservar idempotencia de eventos y auditoría.                                                 | [ADR-002](./adr/ADR-002-mensajeria.md), [API de vacaciones](./api/vacaciones.md)                                          |

Los identificadores y textos normativos RNF deben cotejarse con el Product Backlog fuente, que no está disponible en el repositorio. Las categorías sin ID se conservan como restricciones transversales documentadas, no como nuevos identificadores del backlog.

## Reglas de negocio

1. Solo un empleado ratificado con al menos un año completo de antigüedad es elegible para vacaciones.
2. En modo MVP se asignan 15 días por gestión completada. Se permiten como máximo dos gestiones con saldo pendiente, sujeto a la configuración del servicio.
3. El cálculo de días solicitados excluye fines de semana y feriados aplicables; una solicitud no puede cruzarse con otra solicitud o licencia activa.
4. El saldo se descuenta solo con la aprobación final de RRHH. El cambio de estado, los descuentos y su registro deben ocurrir en la misma transacción.
5. Una solicitud que requiere días excepcionales necesita justificación y aprobación de la excepción; resolverla no sustituye las aprobaciones de jefatura y RRHH.
6. Ningún actor puede aprobar su propia solicitud ni resolver su propia excepción.
7. El jefe aprobador debe corresponder al jefe inmediato registrado para el empleado. Si la relación local no está actualizada, el flujo depende de la sincronización de eventos.
8. Un evento de personal repetido con el mismo `eventId` no debe repetir sus efectos. La referencia local se actualiza en una transacción con el registro del evento procesado.
9. Los eventos de empleado contienen solo los datos mínimos requeridos; no deben incluir CI ni remuneración.
10. Una baja no se completa mientras exista inamovilidad activa sin la autorización ministerial exigida por el contrato.

Fuente detallada y estado de las reglas: [ADR-004](./adr/ADR-004-reglas-de-vacaciones-e-inamovilidad.md), [API de personal](./api/personal.md) y [API de vacaciones](./api/vacaciones.md).

## Matriz de trazabilidad del sprint

| Tarea conocida                     | Historia                                                             | Requisito(s)                                                                                                 | Entregable / evidencia                                                                                                    | Estado y observaciones                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| TSK-VAC-101                        | HU-05 a HU-07, HU-10 y HU-12                                         | RF-13, RF-14, RF-15 y RF-30                                                                                  | Sincronización idempotente de eventos, elegibilidad, saldo y `GET /api/vacaciones/saldo`; [contrato](./api/vacaciones.md) | Implementada en el branch de trabajo                                                                              |
| TSK-VAC-102                        | HU-12                                                                | RF-14 y RF-16                                                                                                | `POST /api/vacaciones/solicitudes` y validaciones de fechas, saldo y traslape; [contrato](./api/vacaciones.md)            | Implementada en el branch de trabajo                                                                              |
| TSK-VAC-103                        | HU-13 según Product Backlog; HU-14 según etiqueta del Sprint Backlog | RF-17                                                                                                        | Aprobación, rechazo, excepciones y descuento final; [contrato](./api/vacaciones.md)                                       | Implementada en el branch de trabajo; confirmar discrepancia HU-13/HU-14                                          |
| TSK-SCRUM-103                      | Historias asociadas a RF-01 a RF-17 y RF-30                          | RF-01 a RF-17 y RF-30                                                                                        | Este catálogo y matriz RF → HU → tarea                                                                                    | Entregable Scrum; reconciliar los códigos de tareas con el Sprint Backlog fuente                                  |
| TSK-SCRUM-104                      | HU-01, HU-04 a HU-13 y HU-10                                         | RF-01 a RF-17 y RF-30 cubiertos por las operaciones de auth, personal y vacaciones incluidas en la colección | [Colección Postman y entornos](../postman/README.md)                                                                      | Artefacto compartido; revisar disponibilidad real de cada ruta antes de usarla como prueba de aceptación          |
| Tareas adicionales no recuperables | Por confirmar                                                        | RF-01 a RF-17 y RF-30 según alcance de cada historia                                                         | Añadir filas al recibir el Sprint Backlog completo                                                                        | No se puede afirmar que la matriz enumere todas las tareas del sprint: el archivo fuente no está en este checkout |

### Discrepancias que requieren decisión

- El contrato de API indica HU-13 / RF-17 para aprobaciones, mientras la etiqueta de TSK-VAC-103 en el Sprint Backlog se reportó como HU-14 / RF-17. La matriz conserva ambas referencias; Product Owner debe confirmar la historia oficial.
- El contrato identifica HU-09 / RF-12 para organigrama, aunque el resumen de historias comprometidas del Sprint Backlog no la incluye. Confirmar si pertenece al sprint o solo al Product Backlog.
- Antes de declarar completa la matriz, incorporar el archivo fuente del Sprint Backlog y reemplazar la fila “Tareas adicionales no recuperables” por todas las tareas reales, con sus HU y RF.

## Mantenimiento por sprint

Al iniciar cada sprint, revisar RF/RNF y reglas con Product Owner y Arquitectura; incorporar cada ID de historia y tarea del Sprint Backlog; asociar evidencia contractual, de código o prueba; registrar discrepancias sin resolverlas por suposición; y actualizar esta matriz antes del día de entrega acordado. Mantener el Product Backlog como fuente para RF/HU y el Sprint Backlog como fuente para las tareas comprometidas.
