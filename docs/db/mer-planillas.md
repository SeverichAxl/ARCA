# Modelo entidad-relación — db_planillas

Generado desde el DMMF del cliente Prisma.

```mermaid
erDiagram
  EventoProcesado {
    String event_id PK
    String event_name
    DateTime procesado_en
  }
  OutboxEvento {
    String id PK
    String event_name
    Json payload
    DateTime occurred_on
    DateTime publicado_en
    Int intentos
  }
  ParametroLegal {
    String id PK
    TipoParametroLegal tipo
    String clave
    Decimal valor
    String unidad
    Json metadata
    DateTime vigente_desde
    DateTime vigente_hasta
    Boolean activo
    String creado_por
    DateTime creado_en
    DateTime actualizado_en
  }
  PlanillaMensual {
    String id PK
    String periodo UK
    EstadoPlanilla estado
    Int total_empleados
    Decimal total_ganado
    Decimal total_aportes_lab
    Decimal total_aportes_pat
    Decimal total_liquido
    String observacion
    String procesada_por
    DateTime procesada_en
    String cerrada_por
    DateTime cerrada_en
    DateTime creado_en
    DateTime actualizado_en
    Int version
    Json parametros_aplicados
    Decimal total_ans
    Decimal total_rc_iva
    Decimal total_otros_descuentos
    Int duracion_ms
    DateTime retencion_hasta
    Json error_proceso
  }
  PlanillaDetalle {
    String id PK
    String planilla_id
    String empleado_id
    String ci_hash_ref
    Decimal haber_basico
    Decimal total_ganado
    Decimal bono_antiguedad
    Decimal aporte_laboral
    Decimal aporte_patronal
    Decimal ans
    Decimal rc_iva_computable
    String rc_iva_editado_por
    DateTime rc_iva_editado_en
    String rc_iva_observacion
    Decimal liquido_pagable
    Json subsidios_info
    Json calculo_snapshot
    DateTime creado_en
    DateTime actualizado_en
    String nombre_completo
    String ci_enmascarado
    String area_id
    String cargo_id
    DateTime fecha_ingreso
    Int dias_trabajados
    Decimal haber_ganado
    Int anios_antiguedad
    Decimal porcentaje_bono
    Decimal otros_ingresos
    Decimal rc_iva_base_imponible
    Decimal rc_iva_impuesto
    Decimal rc_iva_saldo_anterior
    Decimal rc_iva_saldo_siguiente
    Decimal rc_iva
    Decimal otros_descuentos
    Decimal total_descuentos
  }
  BoletaPago {
    String id PK
    String planilla_id
    String detalle_id UK
    String empleado_id
    String periodo
    Decimal liquido_pagable
    String hash_sha256
    Int hash_formula_version
    EstadoBoleta estado
    String documento_public_id
    String documento_version
    String documento_mime
    String firma_grafica_ref
    String emitida_por
    DateTime emitida_en
  }
  NovedadPlanilla {
    String id PK
    String periodo
    String empleado_id
    Int dias_trabajados
    Decimal otros_ingresos
    Decimal otros_descuentos
    Decimal rc_iva_computable
    Json subsidios
    String observacion
    String actualizado_por
    DateTime actualizado_en
  }
  ConfiguracionPlanillas {
    String clave PK
    String valor
    String descripcion
    DateTime actualizado_en
  }
  PlanillaMensual ||--|| PlanillaDetalle : "PlanillaDetalleToPlanillaMensual"
  PlanillaMensual ||--|| BoletaPago : "BoletaPagoToPlanillaMensual"
  PlanillaDetalle ||--|| BoletaPago : "BoletaPagoToPlanillaDetalle"
  %% UNIQUE parametro_legal(tipo, clave, vigenteDesde)
  %% UNIQUE planilla_detalle(id, planillaId)
  %% UNIQUE planilla_detalle(planillaId, empleadoId)
  %% UNIQUE boleta_pago(detalleId, planillaId)
  %% UNIQUE novedad_planilla(periodo, empleadoId)
```
