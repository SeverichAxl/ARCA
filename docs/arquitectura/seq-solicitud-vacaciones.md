# Secuencia - Solicitud y aprobación de vacaciones

Esta secuencia cubre el ciclo de una solicitud de vacaciones con dos niveles de
aprobación. Al crear la solicitud, `ms-vacaciones` valida elegibilidad, saldo,
días hábiles con feriados, traslape y que `dias_habiles` sea mayor que cero.
La solicitud nace en `PENDIENTE_JEFE`; el jefe la pasa a `APROBADO_JEFE` y RRHH
la cierra en `APROBADO_FINAL` con una transacción que usa `updateMany`
condicionado al estado y escribe `descuento_saldo`. La excepción se activa
cuando los días superan el saldo y solo la resuelve Gerencia o RRHH, nunca el
solicitante. La regla del jefe del área padre es un supuesto y el flujo está planificado.

## Diagrama

```mermaid
sequenceDiagram
    autonumber
    actor FUN as Funcionario
    participant FE as Frontend Next.js
    participant GW as API Gateway
    participant VAC as ms-vacaciones
    actor JEF as Jefe de Área
    actor RRH as RRHH
    actor GER as Gerencia o Directorio

    Note over FE,VAC: Los controladores, casos de uso y reglas de ms-vacaciones están planificados. El esquema Prisma, el consumidor de personal y el guard JWT existen.

    FUN->>FE: Solicita vacaciones
    FE->>GW: POST /api/vacaciones/solicitudes
    GW->>GW: Verifica JWT RS256
    Note over GW: Permiso vacaciones:request - planificado
    GW->>VAC: POST /vacaciones/solicitudes
    Note over VAC: Firma HMAC y propiedad del objeto - planificado
    VAC->>VAC: Verifica elegibilidad RATIFICADO y un año de antigüedad
    VAC->>VAC: Consulta saldo y valida días disponibles
    VAC->>VAC: Calcula días hábiles con feriados nacionales y departamentales
    VAC->>VAC: Exige dias_habiles mayor que cero
    VAC->>VAC: Verifica traslape con solicitudes y licencias
    alt No elegible, sin días hábiles o con traslape
        VAC-->>GW: 422 VAC_NO_ELEGIBLE o 409 VAC_TRASLAPE o 400 VAC_FECHAS_INVALIDAS
        GW-->>FE: Error de validación
        FE-->>FUN: Muestra el error
    else Solicitud válida con saldo suficiente
        VAC->>VAC: BEGIN
        VAC->>VAC: INSERT SolicitudVacacion PENDIENTE_JEFE
        VAC->>VAC: INSERT HistorialSolicitud
        VAC->>VAC: COMMIT
        VAC-->>GW: 201 Created con estado PENDIENTE_JEFE
        GW-->>FE: 201 Created
        FE-->>FUN: Solicitud en PENDIENTE_JEFE
    end

    JEF->>FE: Abre la bandeja de jefe
    FE->>GW: POST /api/vacaciones/solicitudes/:id/aprobar-jefe
    GW->>VAC: POST /vacaciones/solicitudes/:id/aprobar-jefe
    VAC->>VAC: Verifica jefe_empleado_id igual a empleadoId del token
    alt Jefe ajeno o recurso fuera de ámbito
        VAC-->>GW: 404 NOT_FOUND
        GW-->>FE: 404 NOT_FOUND
    else Jefe correcto y estado PENDIENTE_JEFE
        VAC->>VAC: BEGIN
        VAC->>VAC: UPDATE estado a APROBADO_JEFE
        VAC->>VAC: INSERT HistorialSolicitud
        VAC->>VAC: COMMIT
        VAC-->>GW: 200 APROBADO_JEFE
        GW-->>FE: 200 APROBADO_JEFE
        FE-->>JEF: Aprobación de jefe registrada
    end

    RRH->>FE: Abre la bandeja de RRHH
    FE->>GW: POST /api/vacaciones/solicitudes/:id/aprobar-rrhh
    GW->>VAC: POST /vacaciones/solicitudes/:id/aprobar-rrhh
    VAC->>VAC: Verifica que el actor no sea el solicitante
    alt El actor es el solicitante
        VAC-->>GW: 403 VAC_AUTOAPROBACION
        GW-->>FE: 403 VAC_AUTOAPROBACION
    else Actor autorizado
        VAC->>VAC: BEGIN
        VAC->>VAC: updateMany con id y estado APROBADO_JEFE
        alt count distinto de 1
            VAC->>VAC: ROLLBACK
            VAC-->>GW: 409 VAC_ESTADO_INVALIDO
            GW-->>FE: 409 VAC_ESTADO_INVALIDO
        else count igual a 1
            VAC->>VAC: INSERT DescuentoSaldo y actualiza SaldoVacaciones
            VAC->>VAC: INSERT HistorialSolicitud APROBADO_FINAL
            VAC->>VAC: COMMIT
            VAC-->>GW: 200 APROBADO_FINAL
            GW-->>FE: 200 APROBADO_FINAL
            FE-->>RRH: Aprobación final registrada
        end
    end

    Note over VAC,JEF: Supuesto a confirmar: si el solicitante es jefe de su área, aprueba el jefe del área padre. Si no existe, la solicitud pasa directamente a RRHH.

    Note over VAC: Ruta de excepción cuando los días superan el saldo.
    alt Los días solicitados superan el saldo disponible
        VAC-->>GW: 409 VAC_SALDO_INSUFICIENTE
        GW-->>FE: 409 VAC_SALDO_INSUFICIENTE
        FE-->>FUN: Ofrece la ruta de excepción
        FUN->>FE: Envía justificación y solicita excepción
        FE->>GW: POST /api/vacaciones/solicitudes/:id/excepcion
        GW->>VAC: POST /vacaciones/solicitudes/:id/excepcion
        VAC->>VAC: Crea SolicitudExcepcion PENDIENTE con días excedentes
        VAC-->>GW: 201 Created
        GW-->>FE: 201 Created
        Note over GER,RRH: La resolución puede hacerla Gerencia o RRHH, nunca el solicitante.
        GER->>FE: Revisa la excepción
        FE->>GW: POST /api/vacaciones/excepciones/:id/resolver
        GW->>VAC: POST /vacaciones/excepciones/:id/resolver
        VAC->>VAC: Verifica que el actor no sea el solicitante
        alt El actor es el solicitante
            VAC-->>GW: 403 VAC_AUTOAPROBACION
            GW-->>FE: 403 VAC_AUTOAPROBACION
        else Gerencia o RRHH autorizado
            VAC->>VAC: UPDATE excepción a APROBADA o RECHAZADA
            VAC-->>GW: 200 Resolución registrada
            GW-->>FE: 200 Resolución registrada
        end
    end
```

## Decisiones relacionadas

- [ADR-002 - Mensajería con RabbitMQ y Outbox](../adr/ADR-002-mensajeria.md)
- [ADR-003 - Autenticación, RBAC y auditoría](../adr/ADR-003-autenticacion-rbac-auditoria.md)
- [ADR-004 - Reglas de vacaciones e inamovilidad](../adr/ADR-004-reglas-de-vacaciones-e-inamovilidad.md)
- [ADR-006 - Protección de datos sensibles](../adr/ADR-006-proteccion-de-datos-sensibles.md)
- [ADR-007 - Privilegios mínimos y refuerzos de BD](../adr/ADR-007-privilegios-minimos-y-refuerzos-de-bd.md)

## Estado

**Implementado:** esquema `db_vacaciones` con estados, saldos, descuentos,
historial, excepciones, licencias, feriados y configuración; `EventConsumer` y
`EventoProcesado`; guard JWT en el servicio.

**Planificado:** todos los controladores y casos de uso de solicitud,
aprobación, rechazo, cancelación, excepción, licencias, feriados y calendario;
las políticas de elegibilidad, días hábiles, saldo, jefatura y autoaprobación;
la transacción final con `updateMany` y `descuento_saldo`; el permiso efectivo
en gateway y servicio; y la firma HMAC de cabeceras internas.

**Supuesto:** la aprobación del jefe del área padre cuando el solicitante es
jefe de su propia área. Si no existe área padre, la solicitud pasa a RRHH.

**Leyenda:** los pasos con la marca `planificado` no existen todavía en el
código; los demás se apoyan en el esquema o en componentes actuales. La
validación visual de este diagrama se hará en mermaid.live.
