# API de personal (ms-personal)

Rutas públicas por gateway: `/api/personal/*`. Rutas internas: `/employees`,
`/areas`, `/cargos`, sin `/api`. Todo endpoint protegido verifica permisos y
propiedad dentro de ms-personal; valida además las cabeceras internas HMAC.

## Campos y privacidad

`Empleado` usa UUID como `id`/`empleadoId`; estados `EN_PRUEBA`, `RATIFICADO`,
`INACTIVO`. CI se normaliza y busca solo por igualdad exacta calculando
`ci_hash` (HMAC-SHA256 con `CI_HMAC_KEY`); nunca se busca por prefijo o
subcadena. `ci_cifrado` y los importes cifrados usan AES-256-GCM. La API solo
serializa `remuneracion`, importes de historial salarial, sueldo promedio,
finiquito y detalle financiero si el actor tiene `personal:read_salary`.
Sin ese permiso los campos se omiten, no se envían como `null`.

Entrada con whitelist; no aceptar IDs de auditoría, actor, ciphertext, estado
calculado ni `firmaPublicId` en el body.

## Endpoints

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `POST /api/personal/employees` -> `POST /employees` | `personal:create` | Crea un expediente; no permite elegir `creadoPor` | `multipart/form-data`: `datos` JSON y `firma` archivo. `datos`: `nombres`, `apellidos`, `ci`, `areaId`, `cargoId`, `remuneracion`, `fechaIngreso`; opcionales `ciExpedido`, `fechaNacimiento`, `esExtranjero`, `email`, `telefono`, `direccion`, `diasPrueba` (0..90), `inamovilidad` (`tipo`, `fechaInicio`, `fechaFin?`, `observacion?`). CI obligatoria y única, UUID válidos, importe no negativo, fechas ISO. Firma `.png` o `.jpeg`, máximo propuesto 5 MiB; verificar extensión, MIME y magic bytes reales PNG/JPEG | `201 { id, nombres, apellidos, areaId, cargoId, fechaIngreso, estado, firmaDisponible }`; salario solo con `personal:read_salary` | `VALIDATION_ERROR`, `PERS_FIRMA_REQUERIDA`, `PERS_ARCHIVO_INVALIDO`, `PERS_CI_DUPLICADA`, `PERS_LIMITE_EXTRANJEROS`, `NOT_FOUND`, `FORBIDDEN` | `EMPLEADO_CREAR` |
| `GET /api/personal/employees` -> `GET /employees` | `personal:read` | Funcionario solo sus datos; cualquier ámbito de jefatura se limita a su área; roles con lectura transversal según permiso pueden consultar ámbito autorizado | Query paginada: `nombre?` (texto), `ci?` (igualdad exacta por `ci_hash`), `areaId?`, `cargoId?`, `estado?`, `inamovilidad?` | `200 { data, meta }`; campos de sueldo excluidos salvo `personal:read_salary` | `VALIDATION_ERROR`, `FORBIDDEN` | `EMPLEADOS_LISTAR` |
| `GET /api/personal/employees/:id` -> `GET /employees/:id` | `personal:read` | Solo propio para funcionario; jefe limitado a su área; acceso ajeno devuelve 404 | Sin body; `id` UUID | `200` expediente y estado de inamovilidad; `remuneracion` solo con `personal:read_salary` | `NOT_FOUND`, `FORBIDDEN` | `EMPLEADO_CONSULTAR` |
| `GET /api/personal/employees/:id/historial` -> `GET /employees/:id/historial` | `personal:read` | Misma propiedad que la ficha | Query paginada opcional | `200 { data, meta }`; importes anterior/nuevo solo con `personal:read_salary` | `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN` | `EMPLEADO_HISTORIAL_CONSULTAR` |
| `PATCH /api/personal/employees/:id` -> `PATCH /employees/:id` | `personal:update` | Solo personal autorizado puede modificar; un funcionario no modifica su expediente; objeto fuera de ámbito responde 404 | Whitelist: al menos uno de `areaId`, `cargoId`, `remuneracion`; `fechaEfectiva: YYYY-MM-DD` y `motivo: string` obligatorios para movimiento. UUID existentes; importe >= 0. Los campos omitidos no cambian | `200` expediente actualizado; historial laboral registrado; salario solo si el actor también tiene `personal:read_salary` | `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT` | `EMPLEADO_MODIFICAR` |
| `POST /api/personal/employees/:id/ratificar` -> `POST /employees/:id/ratificar` | `personal:ratify` | Actor autorizado y empleado no fuera de su ámbito | `{ fechaRatificacion: "YYYY-MM-DD", motivo?: string }`; empleado debe estar `EN_PRUEBA`; fecha no anterior a `fechaIngreso + diasPrueba` | `200 { id, estado: "RATIFICADO", fechaRatificacion }` | `VALIDATION_ERROR`, `PERS_RATIFICACION_ANTICIPADA`, `CONFLICT`, `NOT_FOUND`, `FORBIDDEN` | `EMPLEADO_RATIFICAR` |
| `POST /api/personal/employees/:id/baja` -> `POST /employees/:id/baja` | `personal:baja` | No puede tramitarse sobre expediente ajeno; aplica bloqueo de inamovilidad activa | `multipart/form-data`: `datos` JSON (`fechaBaja`, `motivo`, `aplicaDesahucio`, `sueldoPromedio`, `finiquitoTotal`, `finiquitoDetalle`). Si tiene inamovilidad activa, adjuntar `autorizacionMinisterio` PDF (máximo propuesto 10 MiB). Validar importes >= 0, fecha y motivo no vacío. Los cálculos financieros solo se devuelven a `personal:read_salary` | `201 { id, empleadoId, fechaBaja, estado: "INACTIVO", finiquitoRegistrado }`; valores financieros solo con `personal:read_salary` | `VALIDATION_ERROR`, `PERS_ARCHIVO_INVALIDO`, `PERS_INAMOVILIDAD_ACTIVA`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `EMPLEADO_DAR_DE_BAJA` |
| `GET /api/personal/employees/:id/inamovilidades` -> `GET /employees/:id/inamovilidades` | `personal:read` | Mismo alcance de propiedad que la ficha | Query paginada | `200 { data, meta }` | `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN` | `INAMOVILIDAD_LISTAR` |
| `POST /api/personal/employees/:id/inamovilidades` -> `POST /employees/:id/inamovilidades` | `personal:inamovilidad` | Registra solo sobre empleado accesible al actor autorizado | `{ tipo: "GESTACION" \| "PROGENITOR" \| "DISCAPACIDAD" \| "TUTOR_DISCAPACIDAD", fechaInicio, fechaFin?, observacion? }`; fechas válidas, tipo del enum | `201 { id, empleadoId, tipo, fechaInicio, fechaFin, estadoActivo: true }` | `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `INAMOVILIDAD_ALTA` |
| `PATCH /api/personal/employees/:id/inamovilidades/:inamovilidadId/cerrar` -> `PATCH /employees/:id/inamovilidades/:inamovilidadId/cerrar` | `personal:inamovilidad` | Ambos IDs deben pertenecer al mismo empleado dentro del ámbito del actor | `{ fechaFin: "YYYY-MM-DD", observacion?: string }`; fecha no anterior a `fechaInicio`, registro activo | `200 { id, estadoActivo: false, fechaFin }` | `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `INAMOVILIDAD_CERRAR` |
| `GET /api/personal/areas` -> `GET /areas` | `catalogo:manage` | Catálogo visible para operadores de catálogo | Query paginada, `activa?`, `padreId?` | `200 { data, meta }` | `VALIDATION_ERROR`, `FORBIDDEN` | `AREAS_LISTAR` |
| `POST /api/personal/areas` -> `POST /areas` | `catalogo:manage` | Crea área y relaciones dentro del mismo árbol | `{ nombre, padreId?: uuid|null, jefeId?: uuid|null, activa?: boolean }`; nombre no vacío; referencias existentes | `201 { id, nombre, padreId, jefeId, activa }` | `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `AREA_CREAR` |
| `PATCH /api/personal/areas/:id` -> `PATCH /areas/:id` | `catalogo:manage` | Solo actualiza el área indicada; no acepta otros campos | Whitelist: `nombre?`, `padreId?`, `jefeId?`, `activa?`; no vacío si se envía; cambio de padre no puede crear ciclo | `200 { id, nombre, padreId, jefeId, activa }`; cambio de jefe publica `AREA_ACTUALIZADA` | `VALIDATION_ERROR`, `PERS_CICLO_JERARQUIA`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `AREA_ACTUALIZAR` |
| `DELETE /api/personal/areas/:id` -> `DELETE /areas/:id` | `catalogo:manage` | Elimina solo área sin empleados ni subáreas | Sin body | `204` | `PERS_AREA_CON_EMPLEADOS`, `PERS_AREA_CON_HIJAS`, `NOT_FOUND`, `FORBIDDEN` | `AREA_ELIMINAR` |
| `GET /api/personal/areas/tree` -> `GET /areas/tree` | `organigrama:read` | Organigrama dentro del alcance autorizado; un jefe solo puede consultar su área. Incluir descendientes requiere decisión explícita | Sin body; `raizId?` UUID opcional | `200 { data: [{ id, nombre, jefeId, hijos: [...] }] }` | `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN` | `ORGANIGRAMA_CONSULTAR` |
| `GET /api/personal/cargos` -> `GET /cargos` | `catalogo:manage` | Catálogo de cargos | Query paginada y `activo?` opcional | `200 { data, meta }` | `VALIDATION_ERROR`, `FORBIDDEN` | `CARGOS_LISTAR` |
| `POST /api/personal/cargos` -> `POST /cargos` | `catalogo:manage` | Crea cargo | `{ nombre, descripcion? }`; nombre no vacío y único | `201 { id, nombre, descripcion, activo }` | `VALIDATION_ERROR`, `CONFLICT`, `FORBIDDEN` | `CARGO_CREAR` |
| `PATCH /api/personal/cargos/:id` -> `PATCH /cargos/:id` | `catalogo:manage` | Solo modifica cargo indicado | `{ nombre?, descripcion?, activo? }`; whitelist, nombre único si cambia | `200 { id, nombre, descripcion, activo }` | `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` | `CARGO_ACTUALIZAR` |
| `DELETE /api/personal/cargos/:id` -> `DELETE /cargos/:id` | `catalogo:manage` | Elimina cargo sin empleados asignados | Sin body | `204` | `PERS_CARGO_CON_EMPLEADOS`, `NOT_FOUND`, `FORBIDDEN` | `CARGO_ELIMINAR` |

### Reglas operativas

- El límite de extranjeros usa `ConfiguracionPersonal.LIMITE_EXTRANJEROS_PCT`
  (15 por defecto) y se comprueba transaccionalmente contra el total vigente.
- Ratificación actualiza el empleado y agrega movimiento `RATIFICACION`.
- Cambio de área/cargo/remuneración agrega `HistorialLaboral` en la misma
  transacción. Nunca se registra sueldo en claro en auditoría.
- Para una baja con inamovilidad activa se exige autorización del Ministerio de
  Trabajo; una baja rechazada no cambia estado ni publica evento.
- En alta, modificación relevante, cambio de área/jefe y baja se publica el
  evento correspondiente mediante Outbox. El payload de empleado no incluye CI
  ni valores salariales.
