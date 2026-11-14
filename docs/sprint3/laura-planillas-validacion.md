# Sprint 3 — validación de planillas (Laura)

Fecha de ejecución: 2026-11-14. Rama: `feature/laura-sprint3`.

Este documento registra evidencia reproducible para ARCA-118, ARCA-119,
ARCA-121 y ARCA-122. Los datos utilizados son sintéticos, con UUID aleatorios,
y se ejecutaron en una base PostgreSQL desechable separada. Los parámetros son
los definidos por el Product Backlog y el seed del proyecto; esta validación no
reemplaza una revisión normativa externa.

## ARCA-121 / TSK-BACK-324 — cálculo independiente

La suite `calculo.sprint3.spec.ts` contiene expectativas literales calculadas
manualmente. Los esperados no se obtienen mediante otra llamada al motor.

| Caso                  | Datos principales                                      | Resultado manual comprobado                                                   | Estado |
| --------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- | ------ |
| Antigüedad            | Básico Bs 5.000; 6 años                                | bono 1.089; ganado 6.089; laboral 773,91; patronal 1.017,47; líquido 5.315,09 | PASS   |
| ANS y RC-IVA          | Básico Bs 20.000; 1 año                                | ANS 70; RC-IVA 544,44; líquido 16.843,56                                      | PASS   |
| Tres tramos ANS       | Básico Bs 40.000; facturas Bs 10.000; descuento Bs 250 | ANS 1.520; RC-IVA 1.325,48; líquido 31.820,52                                 | PASS   |
| Prorrateo             | Básico Bs 3.333,33; 17/30 días                         | ganado 1.888,89; laboral 240,08; patronal 315,63; líquido 1.648,81            | PASS   |
| Límites de antigüedad | 2, 5 y 25 años                                         | bonos 495; 1.089 y 4.950                                                      | PASS   |

Se comprobaron haber básico/ganado, bono de antigüedad, total ganado, aportes
laboral y patronal, ANS, RC-IVA, otros descuentos, total de descuentos, líquido,
redondeo half-up y límites de antigüedad. Finiquito/indemnización no forma parte
del motor mensual de `ms-planillas`; queda fuera del alcance de estos casos y no
se inventó una regla.

Comando:

```bash
corepack pnpm --filter ms-planillas test -- --runInBand calculo.sprint3.spec.ts
```

## ARCA-118 / TSK-BACK-321 — rendimiento e historial

El verificador persistió y recalculó una planilla de exactamente 200 empleados.
Cinco muestras secuenciales: **49, 45, 33, 34 y 37 ms**; p95: **49 ms**. El
objetivo es menor a 30.000 ms, por lo que el resultado es PASS con margen amplio.

También se verificó que:

- existen 200 detalles y su suma coincide con la cabecera;
- dos cálculos concurrentes no crean cabeceras ni detalles duplicados;
- solo uno de dos cierres concurrentes prospera;
- una planilla cerrada no se recalcula ni se elimina;
- PostgreSQL bloquea `UPDATE` y `DELETE` de cabecera/detalle y el rol runtime no
  puede truncar el detalle;
- después de los intentos, los 200 detalles permanecen intactos.

## ARCA-122 / TSK-BACK-325 — flujo integrado real

Flujo ejecutado contra PostgreSQL real y desechable:

1. persistencia y lectura de parámetros legales vigentes;
2. cálculo de 200 empleados y cierre de planilla;
3. autoconsulta disponible únicamente después del cierre;
4. generación de PDF (cabecera `%PDF`);
5. SHA-256 recalculado sobre los bytes y cotejado con el persistido;
6. segunda descarga con bytes y hash idénticos;
7. rechazo de un empleado distinto mediante respuesta no reveladora;
8. rechazo por PostgreSQL de `UPDATE` y `DELETE` de la boleta emitida.

Resultado: PASS en integración servicio + base. Observación: `ms-personal` se
sustituye por el puerto determinista del verificador para crear exactamente 200
empleados sintéticos; no se usaron datos reales ni los contenedores de otra rama.

## ARCA-119 / TSK-BACK-322 — defectos confirmados y regresión

| Defecto confirmado                                                                                                   | Corrección                                                                                   | Regresión                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| El verificador consultaba `planilla_detalle`, tabla heredada, aunque el motor persiste en `planilla_detalle_nomina`. | Todas las comprobaciones y el manejo controlado de triggers apuntan ahora a la tabla actual. | El flujo real confirma 200 filas y bloqueos sobre la tabla correcta.                         |
| Los fixtures del verificador omitían `tipo` y `creadoPor`, obligatorios en `parametro_legal`.                        | Se usa el mismo mapeo de tipos del seed y un actor UUID sintético.                           | Los parámetros se insertan, se leen y luego se limpian correctamente.                        |
| `boleta_pago_nomina` no tenía protección de BD; el SQL extra protegía solo la tabla heredada `boleta_pago`.          | Migración aditiva con bloqueo de `UPDATE`, `DELETE` y `TRUNCATE` para boletas actuales.      | Prueba unitaria de reutilización exacta y verificación real de `UPDATE`/`DELETE` rechazados. |

No se confirmó un defecto adicional de identidad durante esta ejecución: la suite
existente de `ms-auth` permanece como regresión y debe pasar en la validación final
del monorepo. No se cambió código de identidad ni se atribuyó un fallo sin prueba.

## Reproducción segura

Usar únicamente una base desechable `db_planillas`. El script aborta si encuentra
los periodos reservados `2000-01` o `2000-02` y limpia solamente los UUID creados
por su propia ejecución.

```bash
corepack pnpm --filter ms-planillas test
corepack pnpm db:verify-planillas
```

El segundo comando requiere `PLANILLAS_DATABASE_URL` para el rol runtime y
`PLANILLAS_DIRECT_URL` para el owner de una base de prueba con migraciones
aplicadas. No debe ejecutarse contra producción.
