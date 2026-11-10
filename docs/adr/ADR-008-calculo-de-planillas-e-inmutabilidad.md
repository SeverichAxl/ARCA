# ADR-008: Cálculo de planillas e inmutabilidad

Estado: Aceptado · Fecha: 2026-11-02 · Responsable: Arquitecto de Software

## 1. Contexto

El cálculo mensual puede depender de datos de personal y de parámetros legales
vigentes, y debe producir un desglose reproducible. Una respuesta HTTP no debe
mantener abierta la conexión hasta completar un cálculo potencialmente largo.
Una vez revisada y cerrada la nómina, los importes y su trazabilidad deben
permanecer inmutables.

## 2. Decisión

- Al aceptar un proceso, crear la planilla en `EN_PROCESO` y responder `202`
  con su identificador, periodo y hora de inicio; no incluir importes en esa
  respuesta.
- Calcular en segundo plano y persistir el resultado completo y los parámetros
  aplicados antes de pasar a `CALCULADA`. Los errores se registran como
  `ERROR`, con un código y un mensaje seguros que no exponen SQL, stack traces
  ni datos internos.
- Permitir el cierre únicamente desde `CALCULADA`. El estado `CERRADA` y sus
  detalles no se modifican ni eliminan por las operaciones ordinarias de la
  aplicación; la retención se calcula desde la fecha de cierre.
- Serializar las operaciones que modifican una planilla por periodo para evitar
  procesos concurrentes o transiciones incompatibles.
- Mantener los parámetros de cálculo y sus vigencias como snapshot asociado al
  resultado para permitir su revisión posterior.

## 3. Consecuencias

- El cliente consulta `GET /api/planillas/:id` para observar el estado final;
  debe admitir `EN_PROCESO`, `CALCULADA`, `ERROR` y `CERRADA`.
- Un proceso interrumpido puede requerir reintento; solo procesos obsoletos
  pueden reiniciarse en estado `EN_PROCESO`.
- Los triggers y privilegios de base de datos complementan las validaciones
  del servicio para proteger los registros cerrados.
- Boletas, exportaciones y publicación de eventos requieren decisiones e
  implementaciones separadas; este ADR no las declara implementadas.
