# Cálculo de finiquito (DEV3-103)

El cálculo es una función pura de `ms-personal`. Recibe la remuneración básica
vigente (SPI), fecha de ingreso, fecha efectiva de baja, días de vacaciones
pendientes y si aplica desahucio. No consulta ni modifica la base de datos.

## Convenciones y fórmulas

- Moneda: bolivianos (BOB). El SPI se toma de la remuneración vigente y su
  origen se informa como `HABER_BASICO`, porque aún no hay boletas disponibles.
- Los importes se representan como centavos enteros. Cada concepto se calcula
  como una fracción exacta y se redondea una vez con half-up a dos decimales.
  El total suma los conceptos ya redondeados.
- El período de servicio es la diferencia calendario entre la fecha de ingreso
  y el día posterior a la baja; la fecha de baja se cuenta como día trabajado.
  Se ancla el cómputo a la fecha inicial y, al sumar meses/años, se usa el
  último día del mes de destino cuando el día original no existe.
- Antigüedad en días: `(fechaBaja - fechaIngreso) + 1`.
- Si la antigüedad es menor que los días de prueba del expediente (90 por
  defecto), indemnización y desahucio son cero y el desglose incluye una
  advertencia (Art. 13 LGT).
- Indemnización: `años × SPI + meses × SPI / 12 + días × SPI / 360`.
- Desahucio: `3 × SPI` únicamente cuando `aplicaDesahucio` y se alcanzó el
  período de prueba.
- Aguinaldo proporcional: la misma fórmula por meses y días desde la fecha
  posterior entre ingreso y 1 de enero del año de baja, contando la baja.
- Vacaciones pendientes: `días pendientes × SPI / 30`.

Los valores de vacaciones pendientes se ingresan manualmente porque
`ms-personal` no consulta `db_vacaciones`; esa integración está prevista para
Sprint 2. Tampoco se desactiva aquí la cuenta del funcionario (responsabilidad
de `ms-auth`) ni se incluyen doble aguinaldo o quinquenio.

## Casos de referencia

| SPI | Ingreso | Baja | Desahucio | Vacaciones | Indemnización | Desahucio | Aguinaldo | Vacaciones | Total |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|
| 6000.00 | 2020-03-01 | 2026-11-30 | No | 0 | 40500.00 | 0.00 | 5500.00 | 0.00 | 46000.00 |
| 4500.00 | 2023-08-16 | 2026-05-20 | Sí | 10 | 12437.50 | 13500.00 | 1750.00 | 1500.00 | 29187.50 |
| 3500.00 | 2026-09-01 | 2026-10-15 | Solicitado; no aplica (<90 días) | 0 | 0.00 | 0.00 | 437.50 | 0.00 | 437.50 |
| 5000.00 | 2024-01-10 | 2026-02-28 | No | 3 | 10680.56 | 0.00 | 833.33 | 500.00 | 12013.89 |

Las pruebas unitarias también cubren aniversario del 29 de febrero, el día
anterior a un aniversario, baja el 31 de diciembre, baja en la fecha de ingreso,
remuneración con centavos y los límites de antigüedad de 89, 90 y 91 días.

## Verificación

- Unitarias: `corepack pnpm --filter ms-personal test`.
- PostgreSQL y endpoints: `corepack pnpm db:verify-personal`.
- Rendimiento: `corepack pnpm perf:personal` (requiere además
  `PERSONAL_TEST_AREA_ID` y `PERSONAL_TEST_CARGO_ID`).

Los dos scripts de BD requieren una base aislada, `DATABASE_URL` con el usuario
de runtime, `DIRECT_URL` con el dueño, `PERSONAL_API_URL` terminado en
`/api/personal`, `PERSONAL_TEST_TOKEN` y la confirmación
`PERSONAL_TEST_ALLOW_MUTATIONS=true`. La suite E2E de integración con
ms-vacaciones sigue pendiente de verificación por el arquitecto.

El endpoint `GET /employees/:id/firma` genera el enlace temporal al solicitarlo.
La expiración de enlaces Cloudinary no ha sido verificada con una cuenta/plan
real; no habilitar el adaptador remoto en producción hasta confirmar ese
comportamiento en Cloudinary.
