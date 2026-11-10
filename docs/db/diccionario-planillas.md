# Diccionario de datos — db_planillas

Generado desde el DMMF del cliente Prisma. Las columnas muestran el nombre físico y los campos escalares; las relaciones se documentan aparte para distinguir las relaciones entre modelos.

## Tabla `evento_procesado` (`EventoProcesado`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `event_id` | `String` | No | — | PK | — |
| `event_name` | `String` | No | — | — | — |
| `procesado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |

## Tabla `outbox_evento` (`OutboxEvento`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | — | PK | — |
| `event_name` | `String` | No | — | — | — |
| `payload` | `Json` | No | — | — | — |
| `occurred_on` | `DateTime` | No | — | — | — |
| `publicado_en` | `DateTime` | Sí | — | — | — |
| `intentos` | `Int` | No | `0` | — | — |

## Tabla `parametro_legal` (`ParametroLegal`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `tipo` | `TipoParametroLegal` | No | — | — | — |
| `clave` | `String` | No | — | — | — |
| `valor` | `Decimal` | No | — | — | — |
| `unidad` | `String` | Sí | — | — | — |
| `metadata` | `Json` | Sí | — | — | — |
| `vigente_desde` | `DateTime` | No | — | — | — |
| `vigente_hasta` | `DateTime` | Sí | — | — | — |
| `activo` | `Boolean` | No | `true` | — | — |
| `creado_por` | `String` | No | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |

Restricciones únicas compuestas: `(tipo, clave, vigenteDesde)`.

## Tabla `planilla_mensual` (`PlanillaMensual`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `periodo` | `String` | No | — | UNIQUE | — |
| `estado` | `EstadoPlanilla` | No | `BORRADOR` | — | — |
| `total_empleados` | `Int` | No | `0` | — | — |
| `total_ganado` | `Decimal` | No | `0` | — | — |
| `total_aportes_lab` | `Decimal` | No | `0` | — | — |
| `total_aportes_pat` | `Decimal` | No | `0` | — | — |
| `total_liquido` | `Decimal` | No | `0` | — | — |
| `observacion` | `String` | Sí | — | — | — |
| `procesada_por` | `String` | Sí | — | — | — |
| `procesada_en` | `DateTime` | Sí | — | — | — |
| `cerrada_por` | `String` | Sí | — | — | — |
| `cerrada_en` | `DateTime` | Sí | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |
| `version` | `Int` | No | `0` | — | — |
| `parametros_aplicados` | `Json` | Sí | — | — | — |
| `total_ans` | `Decimal` | No | `0` | — | — |
| `total_rc_iva` | `Decimal` | No | `0` | — | — |
| `total_otros_descuentos` | `Decimal` | No | `0` | — | — |
| `duracion_ms` | `Int` | Sí | — | — | — |
| `retencion_hasta` | `DateTime` | Sí | — | — | — |
| `error_proceso` | `Json` | Sí | — | — | — |
| — | — | — | — | — | `detalles`: PlanillaDetalleToPlanillaMensual (relación inversa → —) |
| — | — | — | — | — | `boletas`: BoletaPagoToPlanillaMensual (relación inversa → —) |

## Tabla `planilla_detalle` (`PlanillaDetalle`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `planilla_id` | `String` | No | — | — | — |
| `empleado_id` | `String` | No | — | — | — |
| `ci_hash_ref` | `String` | Sí | — | — | — |
| `haber_basico` | `Decimal` | No | — | — | — |
| `total_ganado` | `Decimal` | No | — | — | — |
| `bono_antiguedad` | `Decimal` | No | `0` | — | — |
| `aporte_laboral` | `Decimal` | No | `0` | — | — |
| `aporte_patronal` | `Decimal` | No | `0` | — | — |
| `ans` | `Decimal` | No | `0` | — | — |
| `rc_iva_computable` | `Decimal` | No | `0` | — | — |
| `rc_iva_editado_por` | `String` | Sí | — | — | — |
| `rc_iva_editado_en` | `DateTime` | Sí | — | — | — |
| `rc_iva_observacion` | `String` | Sí | — | — | — |
| `liquido_pagable` | `Decimal` | No | — | — | — |
| `subsidios_info` | `Json` | Sí | — | — | — |
| `calculo_snapshot` | `Json` | Sí | — | — | — |
| `creado_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |
| `nombre_completo` | `String` | Sí | — | — | — |
| `ci_enmascarado` | `String` | Sí | — | — | — |
| `area_id` | `String` | Sí | — | — | — |
| `cargo_id` | `String` | Sí | — | — | — |
| `fecha_ingreso` | `DateTime` | Sí | — | — | — |
| `dias_trabajados` | `Int` | No | `30` | — | — |
| `haber_ganado` | `Decimal` | No | `0` | — | — |
| `anios_antiguedad` | `Int` | No | `0` | — | — |
| `porcentaje_bono` | `Decimal` | No | `0` | — | — |
| `otros_ingresos` | `Decimal` | No | `0` | — | — |
| `rc_iva_base_imponible` | `Decimal` | No | `0` | — | — |
| `rc_iva_impuesto` | `Decimal` | No | `0` | — | — |
| `rc_iva_saldo_anterior` | `Decimal` | No | `0` | — | — |
| `rc_iva_saldo_siguiente` | `Decimal` | No | `0` | — | — |
| `rc_iva` | `Decimal` | No | `0` | — | — |
| `otros_descuentos` | `Decimal` | No | `0` | — | — |
| `total_descuentos` | `Decimal` | No | `0` | — | — |
| — | — | — | — | — | `planilla`: PlanillaDetalleToPlanillaMensual (planillaId → id) |
| — | — | — | — | — | `boleta`: BoletaPagoToPlanillaDetalle (relación inversa → —) |

Restricciones únicas compuestas: `(id, planillaId)`, `(planillaId, empleadoId)`.

## Tabla `boleta_pago` (`BoletaPago`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `planilla_id` | `String` | No | — | — | — |
| `detalle_id` | `String` | No | — | UNIQUE | — |
| `empleado_id` | `String` | No | — | — | — |
| `periodo` | `String` | No | — | — | — |
| `liquido_pagable` | `Decimal` | No | — | — | — |
| `hash_sha256` | `String` | No | — | — | — |
| `hash_formula_version` | `Int` | No | `1` | — | — |
| `estado` | `EstadoBoleta` | No | `EMITIDA` | — | — |
| `documento_public_id` | `String` | Sí | — | — | — |
| `documento_version` | `String` | Sí | — | — | — |
| `documento_mime` | `String` | Sí | — | — | — |
| `firma_grafica_ref` | `String` | Sí | — | — | — |
| `emitida_por` | `String` | No | — | — | — |
| `emitida_en` | `DateTime` | No | `{"name":"now","args":[]}` | — | — |
| — | — | — | — | — | `planilla`: BoletaPagoToPlanillaMensual (planillaId → id) |
| — | — | — | — | — | `detalle`: BoletaPagoToPlanillaDetalle (detalleId, planillaId → id, planillaId) |

Restricciones únicas compuestas: `(detalleId, planillaId)`.

## Tabla `novedad_planilla` (`NovedadPlanilla`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `id` | `String` | No | `{"name":"uuid","args":[4]}` | PK | — |
| `periodo` | `String` | No | — | — | — |
| `empleado_id` | `String` | No | — | — | — |
| `dias_trabajados` | `Int` | Sí | — | — | — |
| `otros_ingresos` | `Decimal` | No | `0` | — | — |
| `otros_descuentos` | `Decimal` | No | `0` | — | — |
| `rc_iva_computable` | `Decimal` | No | `0` | — | — |
| `subsidios` | `Json` | No | `{}` | — | — |
| `observacion` | `String` | Sí | — | — | — |
| `actualizado_por` | `String` | No | — | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |

Restricciones únicas compuestas: `(periodo, empleadoId)`.

## Tabla `configuracion_planillas` (`ConfiguracionPlanillas`)

| Columna | Tipo | Nulo | Default | Único / clave | Relación |
|---|---|---:|---|---|---|
| `clave` | `String` | No | — | PK | — |
| `valor` | `String` | No | — | — | — |
| `descripcion` | `String` | Sí | — | — | — |
| `actualizado_en` | `DateTime` | No | — | — | — |

## Notas

- Modelo base TSK-ARQ-202: parametro_legal (tipo/clave/metadata con vigencia), planilla_mensual, planilla_detalle y boleta_pago.
- Extensión TSK-DEV2-201..204 (migración 20261109120000): desglose por funcionario, novedad_planilla, configuracion_planillas, parametros_aplicados y error_proceso.
- Importes DECIMAL(14,2) calculados en centavos enteros; CHECK de cuadre de detalle (NOT VALID para filas previas).
- Inmutabilidad: triggers bloquean UPDATE/DELETE de planilla CERRADA, su detalle y novedades; TRUNCATE bloqueado. Refuerzo opcional en prisma/migrations-extra.
- Retención: configuracion_planillas.RETENCION_ANIOS >= 8 (CHECK); retencion_hasta = cierre + años.
- empleado_id, area_id y cargo_id referencian ms-personal sin FK entre servicios; nombre y CI enmascarada son snapshot al cálculo.
