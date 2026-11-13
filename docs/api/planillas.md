# API de planillas y boletas (ms-planillas)

Rutas públicas por gateway: `/api/planillas/*`. Rutas internas: `/planillas/*`.
Este documento complementa el Swagger generado por los controladores activos.

Aplica [README.md](./README.md): JWT RS256, HMAC interno, RBAC en gateway +
`@RequirePermission` en servicio, whitelist, paginación, errores comunes, y
enmascarado de datos sensibles. **Prohibida** la lectura directa de BD ajenas.

## Propiedad, inmutabilidad y retención

- `db_planillas` es la única base de datos que escribe/lee ms-planillas.
- **Planillas cerradas y boletas emitidas son inmutables**: no se modifican ni
  eliminan por API; refuerzos en servicio y, cuando aplique, a nivel BD.
- Retención mínima de registros de pago/subsidios: **8 años** (HU-24). Se
  implementa como política/configuración y controles operativos; no es una
  espera real en pruebas.
- ms-planillas obtiene datos de empleados activos/remuneración por **interfaz
  autorizada** hacia ms-personal (HTTP interno firmado). No duplica
  `db_personal`. Los cálculos usan los valores vigentes obtenidos al procesar y
  persisten el desglose necesario para reproducibilidad.

## Propiedad de documentos (boletas)

- Boletas PDF: ms-planillas guarda los bytes finales de forma inmutable y su
  **SHA-256**. La verificación vuelve a calcular el hash del archivo recibido;
  cualquier cambio de un byte invalida la boleta.
- Descarga autorizada: funcionario solo boletas propias (`boleta:read_own`);
  RRHH/nómina/auditor según `boleta:read_all`/`boleta:issue`/`planilla:read`.

## Endpoints

### Parámetros legales (HU-20 / RF-23)

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `GET /api/planillas/parametros` -> `GET /planillas/parametros` | `parametros_ley:update` o `planilla:read` o `planilla:calculate` | Lectura para operación nómina; edición solo `parametros_ley:update`. | Query: `tipo?` (`SMN`,`APORTE_LABORAL`,`APORTE_PATRONAL`,`BONO_ANTIGUEDAD`), `vigenteEn?=YYYY-MM-DD`, paginación. | `200 { data: [{ id, tipo, clave, valor, unidad, vigenteDesde, vigenteHasta, activo }], meta }`. Valores de referencia PB: SMN Bs 3300, aportes 12.71%/16.71%, bono antigüedad editable por escala. | `VALIDATION_ERROR`, `FORBIDDEN` | `PLANILLA_PARAMETRO_LISTAR` |
| `POST /api/planillas/parametros` -> `POST /planillas/parametros` | `parametros_ley:update` | ADMIN_GENERAL (según seed). | JSON whitelist: `tipo`, `clave`, `valor` (decimal/string controlado), `unidad?`, `vigenteDesde`, `vigenteHasta?`, `metadata?` (ej. escala bono). Valida solapamientos de vigencia por `tipo/clave`. | `201` parámetro creado. | `VALIDATION_ERROR`, `CONFLICT`, `FORBIDDEN` | `PLANILLA_PARAMETRO_CREAR` |
| `PATCH /api/planillas/parametros/:id` -> `PATCH /planillas/parametros/:id` | `parametros_ley:update` | Ídem. | Whitelist: `valor?`, `vigenteHasta?`, `activo?`, `metadata?`. Cambios generan traza/auditoría; no editar retroactivamente periodos cerrados sin política explícita. | `200` parámetro actualizado. | `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `PLANILLA_PARAMETRO_ACTUALIZAR` |

### Cálculo y ejecución mensual (HU-21 / RF-24)

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `POST /api/planillas/periodos/:periodo/calcular` -> `POST /planillas/periodos/:periodo/calcular` | `planilla:calculate` | Encargado de nómina. Crea o recalcula el borrador para empleados activos elegibles. | `:periodo` en formato `YYYY-MM`; no acepta periodos futuros ni planillas cerradas. Sin body. | `200 { planilla, observaciones, duracionTotalMs }`; `planilla` incluye estado `BORRADOR`, total de funcionarios y totales monetarios. | `VALIDATION_ERROR`, `CONFLICT` (`PLAN_CERRADA`), `PLAN_PARAMETROS_INCOMPLETOS`, `PLAN_PERSONAL_NO_DISPONIBLE`, `PLAN_SIN_EMPLEADOS`, `FORBIDDEN` | `PLANILLA_CALCULAR` |
| `GET /api/planillas` -> `GET /planillas` | `planilla:read` | Nómina/auditor/gerencia. | Query paginada: `periodo?`, `estado?`, `desde?`, `hasta?`. | `200 { data, meta }`. | `VALIDATION_ERROR`, `FORBIDDEN` | `PLANILLAS_LISTAR` |
| `GET /api/planillas/:id` -> `GET /planillas/:id` | `planilla:read` | Ídem. | `:id` UUID. | `200 { id, periodo, estado, totales, totalEmpleados, cerradaEn?, detallesResumen? }`. | `NOT_FOUND`, `FORBIDDEN` | `PLANILLA_CONSULTAR` |
| `GET /api/planillas/:id/detalles` -> `GET /planillas/:id/detalles` | `planilla:read` | Ídem. | Query paginada, `empleadoId?`. | `200 { data: [{ empleadoId, totalGanado, bonoAntiguedad, aporteLaboral, aportePatronal, ans, rcIvaComputable, liquidoPagable, subsidiosInformativos }], meta }`. RC-IVA computable editable solo con autorización (`planilla:calculate` en flujo de ajuste, si se define endpoint). | `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN` | `PLANILLA_DETALLES_CONSULTAR` |
| `POST /api/planillas/:id/cerrar` -> `POST /planillas/:id/cerrar` | `planilla:close` | Encargado de nómina. Cierre inmutable. | Sin body o `{ confirmacion: true }`. Solo planilla calculada/revisada; al cerrar genera/habilita boletas. | `200 { id, periodo, estado: "CERRADA", cerradaEn }`. | `NOT_FOUND`, `CONFLICT` (`PLANILLA_ESTADO_INVALIDO`), `FORBIDDEN` | `PLANILLA_CERRAR` |

Componentes de cálculo (HU-21): Total Ganado, Bono de Antigüedad según escala
vigente, aportes laboral/patronal (12.71%/16.71% por defecto PB), ANS, RC-IVA
(monto computable editable con autorización), Líquido Pagable. Redondeos
consistentes y reproducibles.

En el frontend, el rol `ENCARGADO_NOMINA` puede calcular y cerrar el periodo
desde **Boletas autorizadas**. La pantalla muestra el resumen y las
observaciones del cálculo antes de pedir confirmación para el cierre
inmutable; el cierre habilita la consulta y descarga de boletas del periodo.

### Boletas (HU-22, HU-23 / RF-25, RF-27)

Endpoints implementados:

- `GET /api/planillas/boletas/mias/:periodo/pdf` (`boleta:read_own`).
- `GET /api/planillas/boletas/:planillaId/empleados/:empleadoId/pdf`
  (`boleta:read_all` o propiedad con `boleta:read_own`).
- `POST /api/planillas/boletas/verificar` (`multipart/form-data`, campo
  `archivo`, máximo 5 MiB). Devuelve el SHA-256 y `integra`.

La descarga responde `application/pdf`, `Cache-Control: private, no-store` y
la cabecera `X-Document-SHA256`. Solo se emiten documentos definitivos cuando
la planilla está `CERRADA`.

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `POST /api/planillas/:id/boletas/generar` -> `POST /planillas/:id/boletas/generar` | `boleta:issue` | Nómina; normalmente tras cierre o como parte controlada. | `{ regenerarFallidas?: false }` (sin regenerar boletas emitidas inmutables). | `200 { planillaId, generadas, existentes, errores }`. | `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `BOLETAS_GENERAR` |
| `GET /api/planillas/boletas` -> `GET /planillas/boletas` | `boleta:read_all` o `boleta:read_own` | `boleta:read_all`: listado autorizado. `boleta:read_own`: **solo** `empleadoId` del token; filtros que pidan otro empleado se ignoran o responden `404/403` según política (preferir forzar scope propio). | Query: `periodo?`, `empleadoId?` (solo all), `planillaId?`, paginación. | `200 { data: [{ id, planillaId, periodo, empleadoId, liquidoPagable, hashSha256, emitidaEn }], meta }`. | `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN` | `BOLETAS_LISTAR` |
| `GET /api/planillas/boletas/:id` -> `GET /planillas/boletas/:id` | `boleta:read_all` o `boleta:read_own` | Propio si `read_own`; ajeno `404`. | `:id` UUID. | `200` metadatos + hash + referencia de descarga. | `NOT_FOUND`, `FORBIDDEN` | `BOLETA_CONSULTAR` |
| `GET /api/planillas/boletas/:id/descarga` -> `GET /planillas/boletas/:id/descarga` | `boleta:read_all` o `boleta:read_own` | Propio si `read_own`; ajeno `404`. Nadie descarga boleta ajena sin permiso global. | Sin body. | `200 { url, expiresInSeconds: 60, hashSha256 }`; URL firmada temporal. PDF consistente con planilla cerrada; incluye haberes, descuentos, líquido, subsidios informativos, firma gráfica y hash SHA-256. | `NOT_FOUND`, `FORBIDDEN` | `BOLETA_DESCARGAR` |

### Historial inmutable (HU-24 / RF-26)

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `GET /api/planillas/historial` -> `GET /planillas/historial` | `planilla:read` | Nómina/auditor/gerencia. | Query: `periodo?`, `empleadoId?`, `gestion?`, paginación. | `200 { data, meta }` con planillas/boletas históricas cerradas. | `VALIDATION_ERROR`, `FORBIDDEN` | `PLANILLA_HISTORIAL_CONSULTAR` |

No existen endpoints `PUT/PATCH/DELETE` para planillas cerradas, detalles
cerrados o boletas emitidas. Intentos por rutas no declaradas quedan bloqueados
por gateway; operaciones internas no deben exponer mutación destructiva.

#### Validación de rendimiento (ARQ-204)

El benchmark mide cinco llamadas reales al endpoint síncrono implementado
`POST /api/planillas/periodos/:periodo/calcular` y exige que cada respuesta
incluya exactamente 200 empleados y que el p95 de latencia HTTP sea menor a
30 segundos. No se debe ejecutar en producción: cada llamada crea o recalcula
el borrador del periodo indicado. Usa una base desechable con exactamente 200
empleados activos, parámetros legales y un periodo abierto de prueba.

Esta medición valida el endpoint síncrono implementado; no valida el contrato
asíncrono `202 EN_PROCESO` descrito en la tabla de requisitos.

Desde la raíz, define `ARQ204_TEST_ALLOW_MUTATIONS=true`,
`ARQ204_PLANILLAS_URL`, `ARQ204_PLANILLAS_TOKEN` y
`ARQ204_PLANILLAS_PERIOD` en la sesión de PowerShell y ejecuta:

```powershell
corepack pnpm bench:arq204 -- planillas
```

El comando no carga `.env`. Registra p50, p95 y máximo; el benchmark valida el
p95 contra el objetivo y falla si el entorno no tiene exactamente 200 empleados.

### KPIs / Dashboard (HU-25 / RF-28)

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `GET /api/planillas/kpis` -> `GET /planillas/kpis` | `dashboard:read` o `dashboard:read_area` | `dashboard:read`: empresa. `dashboard:read_area`: **solo área del actor** (el servicio debe resolver área desde identidad/snapshot autorizado; área ajena `404`). | Query: `periodo?`, `areaId?` (solo si política lo permite). | `200 { periodo, costoPlanilla, boletasEmitidas, tendenciaCostos: [{ periodo, total }] }`. | `VALIDATION_ERROR`, `FORBIDDEN` | `DASHBOARD_PLANILLAS_CONSULTAR` |

**Nota de composición:** este endpoint solo entrega costos y boletas de
planilla. KPIs de empleados, vacaciones e inamovilidad pertenecen a
ms-personal/ms-vacaciones y se componen mediante sus APIs autorizadas; no se
duplican ni se consultan sus bases de datos.

### Exportaciones (HU-26 / RF-29)

Implementado: `GET /api/planillas/:id/exportar?format=csv|xlsx&areaId?=UUID`,
con permiso `export:data`. CSV incluye BOM UTF-8 y neutraliza fórmulas; XLSX
incluye cabecera, filtro y fila congelada.

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `GET /api/planillas/export` -> `GET/planillas/export` | `export:data` | Nómina/RRHH autorizado. | Query: `formato=csv|xlsx`, mismos filtros que listado (`periodo`, `estado`, etc.). Proteger contra CSV/formula injection en celdas. | `200` archivo (`text/csv` o `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) con nombre seguro. | `VALIDATION_ERROR`, `FORBIDDEN` | `PLANILLAS_EXPORTAR` |

Exportación de personal: definir en ms-personal (`GET /employees/export` o
equivalente) con `export:data` y mismos filtros; coordinar con ARQ-203.

## Estados

- Planilla: `BORRADOR` | `EN_PROCESO` | `CALCULADA` | `CERRADA` | `ERROR`.
- Boleta: `EMITIDA` (inmutable) | `ANULADA` solo por proceso excepcional
  documentado (preferir no anular; si existe, mantener traza).

## Errores específicos

`PLANILLA_PERIODO_DUPLICADO`, `PLANILLA_PARAMETROS_VIGENTES_FALTANTES`,
`PLANILLA_ESTADO_INVALIDO`, `PLANILLA_CALCULO_ERROR`, `BOLETA_NO_DISPONIBLE`.

## Ejemplos JSON

### Crear parámetro
```json
{ "tipo": "SMN", "clave": "SMN_NACIONAL", "valor": "3300.00", "unidad": "BOB", "vigenteDesde": "2026-01-01" }
```

### Procesar planilla
```json
{ "periodo": "2026-11", "observacion": "Proceso mensual noviembre" }
```

### Detalle (respuesta resumida)
```json
{
  "empleadoId": "ec7fb95f-8ae6-48df-8a48-6a88784bef18",
  "totalGanado": "5000.00",
  "bonoAntiguedad": "0.00",
  "aporteLaboral": "635.50",
  "aportePatronal": "835.50",
  "ans": "0.00",
  "rcIvaComputable": "0.00",
  "liquidoPagable": "4364.50",
  "subsidiosInformativos": []
}
```

### Boleta (metadatos)
```json
{
  "id": "b31f9d60-7b0a-4f8e-8f10-2d6a9b1c4e55",
  "periodo": "2026-11",
  "empleadoId": "ec7fb95f-8ae6-48df-8a48-6a88784bef18",
  "liquidoPagable": "4364.50",
  "hashSha256": "a3...",
  "emitidaEn": "2026-11-08T18:00:00.000Z"
}
```

## Decisiones de contrato

- Las descargas de boletas usan URL firmada con vigencia de 60 segundos.
- `boleta:read_own` siempre aplica el `empleadoId` autenticado; si falta, o el
  recurso pertenece a otra persona, se responde `404`. Un filtro `empleadoId`
  distinto nunca amplía el alcance del token.
- RC-IVA se recibe durante el cálculo autorizado y queda en la traza de cálculo;
  no se permite editar detalles de una planilla cerrada.
- El dashboard de este servicio solo expone costos/boletas de planilla. KPIs de
  personal y vacaciones pertenecen a sus servicios dueños y se componen fuera
  de ms-planillas.
- ms-planillas es dueño de sus eventos y Outbox. `PLANILLA_CERRADA` y
  `BOLETA_EMITIDA` podrán publicarse con routing keys `planillas.planilla.cerrada`
  y `planillas.boleta.emitida` cuando haya consumidores y permisos RabbitMQ
  explícitos (ARQ-203); no se consulta directamente otra base de datos.
