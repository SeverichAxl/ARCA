# ADR-004: Reglas de vacaciones e inamovilidad

Estado: Propuesto · Fecha: 2026-11-01 · Responsable: Arquitecto de Software

## 1. Contexto

HU-12 a HU-14 / RF-14 a RF-19 cubren elegibilidad, saldo, solicitud,
aprobaciones, excepciones, licencias y feriados. El MVP necesita una regla
operable sin sustituir la escala de vacaciones prevista por la LGT. También
debe impedir autoaprobaciones, dobles descuentos por concurrencia y bajas
laborales mientras exista una inamovilidad sin autorización ministerial.

## 2. Decisión

- Para el MVP, reconocer 15 días por cada gestión completada; solo es elegible
  quien esté `RATIFICADO` y tenga al menos un año de antigüedad. La escala LGT
  queda como modo parametrizable distinto del modo MVP.
- Limitar a dos las gestiones pendientes/acumuladas.
- Mantener dos niveles de aprobación de vacaciones: jefe y RRHH. La excepción
  por exceso de saldo es un flujo asociado, no reemplaza esos dos niveles.
- Prohibir que alguien apruebe o resuelva su propia solicitud o excepción.
- Ejecutar la aprobación final, el cambio de estado, los descuentos y su
  registro en una transacción atómica y condicionada al estado previo
  `APROBADO_JEFE`.
- Parametrizar los feriados nacionales y departamentales; cargar el calendario
  nacional 2026 que las fuentes de requisitos atribuyen al Decreto Supremo
  5521 de 2026.
- Bloquear la baja de una persona con inamovilidad activa hasta que se cargue
  una autorización válida del Ministerio de Trabajo.
- **Supuesto a confirmar:** el jefe de un empleado es el jefe de su área; si
  el propio empleado es jefe, la aprobación corresponde al jefe del área
  padre y, si no existe, la solicitud pasa directamente a RRHH.

## 3. Alternativas consideradas

1. **Aplicar desde el MVP la escala LGT sin una opción simple:** descartada
   porque el MVP necesita una asignación inicial explícita y los parámetros
   legales deben poder evolucionar sin codificar una escala fija.
2. **Permitir una sola aprobación o que el flujo de excepción sustituya una
   aprobación:** descartadas porque reducen la separación de revisión
   especificada para la solicitud y dejan la excepción como bypass.
3. **Descontar saldo al solicitar o al aprobar el primer nivel:** descartada
   porque una solicitud que aún puede ser rechazada consumiría saldo y una
   concurrencia podría producir descuentos inconsistentes.
4. **Permitir la baja y revisar después la inamovilidad:** descartada porque
   permitiría ejecutar una baja sin la autorización ministerial exigida por
   el contrato.

## 4. Consecuencias

**Positivas**

- La elegibilidad y el tope de acumulación son reglas explícitas y
  parametrizables.
- El descuento final condicionado y atómico evita cobrar dos veces una
  solicitud en aprobaciones concurrentes.
- La prohibición de autoaprobación y el bloqueo de baja protegen las
  separaciones de responsabilidad previstas.
- La configuración de feriados permite distinguir días nacionales y
  departamentales.

**Negativas**

- La copia local `EmpleadoRef` debe estar actualizada para decidir elegibilidad
  y jefatura; la propagación por eventos es eventual.
- La ruta del jefe del área padre aún depende de confirmar un supuesto de
  negocio.
- Mantener modo MVP y escala LGT parametrizable añade configuración y requiere
  pruebas de transición entre modos.
- La autorización ministerial debe cargarse y validarse antes de tramitar la
  baja; el expediente no puede completarse si falta.

## 5. Estado de implementación

**Implementado:**

- El esquema de vacaciones modela los estados de solicitud de dos niveles,
  excepción, feriados con ámbito nacional/departamental y parámetros
  `DIAS_POR_GESTION`, `MAX_GESTIONES_ACUMULADAS` y `MODO_ESCALA`.
- El seed fija 15 días, máximo dos gestiones y modo `MVP`, y carga feriados
  nacionales de 2026.
- El esquema de personal contiene la referencia de autorización ministerial
  para la baja. Hay restricciones de base de datos y un trigger para impedir
  que se resuelva una excepción por su solicitante.

**Planificado / pendiente:**

- Los servicios de vacaciones y personal aún no implementan los flujos de
  elegibilidad, solicitudes, aprobaciones, cálculo de días ni validación de
  autorización de baja; los controladores de negocio del contrato son
  planificados.
- La aprobación final atómica y los descuentos están especificados en la API,
  pero no están implementados en un servicio de negocio.
- La escala LGT configurable, la administración de feriados en ejecución y la
  regla de jefatura del área padre requieren completar y confirmar su
  implementación.

## 6. Trazabilidad

- **RF / HU:** HU-05 a HU-07 / RF-14; HU-12 / RF-15 y RF-16; HU-13 / RF-17;
  HU-14 / RF-18; RF-19.
- **RNF:** consistencia transaccional y trazabilidad de operaciones de
  vacaciones.
- **API:** [vacaciones](../api/vacaciones.md),
  [personal](../api/personal.md), [errores](../api/errores.md),
  [supuestos del contrato](../api/README.md).
- **BD:** [schema de vacaciones](../../services/ms-vacaciones/prisma/schema.prisma),
  [seed de vacaciones](../../services/ms-vacaciones/prisma/seed.ts),
  [schema de personal](../../services/ms-personal/prisma/schema.prisma),
  [mejoras pendientes](../db/mejoras-pendientes.md).
- **Otros ADR:** [ADR-001](./ADR-001-microservicios-y-hexagonal.md),
  [ADR-002](./ADR-002-mensajeria.md),
  [ADR-007](./ADR-007-privilegios-minimos-y-refuerzos-de-bd.md).
- **Backlog:** [Sprint Backlog 1](../backlog/Sprint_Backlog_1_ARCA.docx.pdf),
  [Product Backlog](../backlog/Product_Backlog_ARCA.docx.pdf).
