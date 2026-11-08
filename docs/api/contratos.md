# API de contratos (ms-contratos)

Rutas públicas por gateway: `/api/contratos/*`. Rutas internas: `/contratos/*`.
Este documento es el contrato de API Sprint 2 (TSK-ARQ-201); no implica que los
handlers estén implementados.

Aplica las convenciones transversales de [README.md](./README.md): JWT RS256,
cabeceras internas HMAC (`@arca/internal-auth`), autorización en gateway y
obligatoriamente en servicio con `@RequirePermission`, whitelist, paginación
`?page&pageSize` (`{ data, meta }`, `pageSize` máximo propuesto 100), errores
`{ statusCode, code, message, details?, traceId }`, y enmascarado de datos
sensibles en auditoría/eventos.

## Propiedad de datos y restricciones

- `db_contratos` es la única base de datos que escribe/lee ms-contratos.
  **Prohibido** leer directamente bases de datos de otros servicios.
- Para inyectar variables de contrato (HU-18), ms-contratos obtiene datos del
  empleado por **interfaz autorizada** hacia ms-personal (HTTP interno firmado
  con `INTERNAL_HMAC_KEY`, mismo contrato canónico de `@arca/internal-auth`).
  Solo solicita los campos mínimos necesarios para la plantilla/version
  vigente.
- La remuneración y cualquier dato salarial solo se incluyen en vista previa,
  PDF o descarga cuando el flujo está autorizado para ello; las respuestas a
  actores sin `personal:read_salary` omiten campos salariales (no `null`).
- Recurso ajeno o fuera de alcance responde `404 NOT_FOUND`; permiso ausente
  responde `403 FORBIDDEN`.

## Propiedad de documentos (Cloudinary)

- ms-contratos es dueño de los documentos contractuales: guarda **solo
  metadatos y `publicId`/referencias versionadas** (nunca URL pública
  permanente como fuente de verdad).
- Cada generación PDF crea una **nueva versión**; no se sobreescribe una versión
  existente. El contrato conserva historial de versiones (`version`,
  `publicId`, hash opcional, fecha, actor, estado).
- La descarga/visualización se entrega mediante URL firmada de corta duración o
  stream controlado, generada al momento de la solicitud tras verificar
  autorización y propiedad.
- Adjuntos/firmas se validan por tipo permitido y contenido (magic bytes donde
  aplique), con límites de tamaño definidos por infraestructura.

## Endpoints

### Plantillas (HU-17 / RF-20)

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `POST /api/contratos/plantillas` -> `POST /contratos/plantillas` | `contrato:template_manage` | RRHH autorizado. | JSON whitelist: `nombre` (string, requerido), `descripcion?`, `contenidoHtml` (string, requerido), `activa?` (boolean, default `true`). HTML se **sanea** (lista permitida de etiquetas/atributos) y se valida contra el catálogo de variables permitidas: `{{nombre_empleado}}`, `{{ci}}`, `{{cargo}}`, `{{remuneracion}}`, `{{fecha_ingreso}}`, `{{duracion_prueba}}`. Variables fuera del catálogo o placeholders malformados se rechazan. | `201 { id, nombre, descripcion, variablesDetectadas, activa, versionActual, creadoEn }` | `VALIDATION_ERROR`, `CONTR_TEMPLATE_INVALIDA`, `CONTR_VARIABLE_NO_PERMITIDA`, `FORBIDDEN` | `CONTRATO_PLANTILLA_CREAR` |
| `GET /api/contratos/plantillas` -> `GET /contratos/plantillas` | `contrato:template_manage` o `contrato:generate` | Operación RRHH; `contrato:generate` solo lectura para selección. | Query paginada: `activa?`, `q?` (nombre). | `200 { data: [{ id, nombre, descripcion, activa, versionActual, actualizadoEn }], meta }` | `VALIDATION_ERROR`, `FORBIDDEN` | `CONTRATO_PLANTILLA_LISTAR` |
| `GET /api/contratos/plantillas/:id` -> `GET /contratos/plantillas/:id` | `contrato:template_manage` o `contrato:generate` | Ídem. | `:id` UUID. | `200 { id, nombre, descripcion, contenidoHtml, variablesDetectadas, activa, versionActual, versiones, creadoEn, actualizadoEn }` | `NOT_FOUND`, `FORBIDDEN` | `CONTRATO_PLANTILLA_CONSULTAR` |
| `PATCH /api/contratos/plantillas/:id` -> `PATCH /contratos/plantillas/:id` | `contrato:template_manage` | RRHH autorizado. | Whitelist: `nombre?`, `descripcion?`, `contenidoHtml?`, `activa?`. Si cambia `contenidoHtml`, se sanea/valida, se recalculan variables y se crea **nueva versión** de plantilla (no mutación destructiva del contenido histórico). | `200` plantilla actualizada con `versionActual` incrementada si aplica. | `VALIDATION_ERROR`, `NOT_FOUND`, `CONTR_TEMPLATE_INVALIDA`, `CONTR_VARIABLE_NO_PERMITIDA`, `FORBIDDEN` | `CONTRATO_PLANTILLA_ACTUALIZAR` |

### Contratos individuales y vista previa (HU-18 / RF-21)

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `POST /api/contratos` -> `POST /contratos` | `contrato:generate` | RRHH autorizado. Crea contrato para empleado existente; no acepta `creadoPor`/actor del body. | JSON whitelist: `plantillaId` (UUID), `empleadoId` (UUID), `fechaInicio?`, `observacion?`. Valida existencia de plantilla activa y empleado accesible vía interfaz autorizada. Guarda referencia a `plantillaId` + `plantillaVersion`. | `201 { id, empleadoId, plantillaId, plantillaVersion, estado, creadoEn }` (`estado` inicial propuesto: `BORRADOR`) | `VALIDATION_ERROR`, `NOT_FOUND` (plantilla/empleado no accesible), `FORBIDDEN`, `CONFLICT` | `CONTRATO_CREAR` |
| `POST /api/contratos/preview` -> `POST /contratos/preview` | `contrato:generate` | RRHH autorizado. Vista previa **efímera**: no persiste contrato. | JSON whitelist: `plantillaId` (UUID), `empleadoId` (UUID). Valida plantilla activa y consulta los datos reales del empleado por la interfaz autorizada. | `200 { contratoId: null, empleadoId, plantillaId, plantillaVersion, htmlPreview, variablesResueltas, camposFaltantes, advertencias }` | `VALIDATION_ERROR`, `NOT_FOUND`, `CONTR_DATOS_INCOMPLETOS`, `FORBIDDEN` | `CONTRATO_PREVISUALIZAR` |
| `POST /api/contratos/:id/preview` -> `POST /contratos/:id/preview` | `contrato:generate` o `contrato:read` | Mismo alcance del contrato; vista previa para split screen usando la versión de plantilla congelada en el contrato. | Body opcional whitelist: `datosOverride?` **no permitido** para campos sensibles; solo parámetros editoriales seguros si se aprueba (por defecto vacío). Obtiene datos reales de ms-personal. | `200 { contratoId, empleadoId, plantillaId, plantillaVersion, htmlPreview, variablesResueltas, camposFaltantes, advertencias }`. `variablesResueltas` omite valores salariales sin `personal:read_salary`. | `VALIDATION_ERROR`, `NOT_FOUND`, `CONTR_DATOS_INCOMPLETOS`, `FORBIDDEN` | `CONTRATO_PREVISUALIZAR` |
| `GET /api/contratos` -> `GET /contratos` | `contrato:read` | RRHH/auditoría/gerencia según permiso. `contrato:download_own` no habilita listado general; usar endpoint propio. | Query paginada: `empleadoId?`, `plantillaId?`, `estado?`, `desde?`, `hasta?`. | `200 { data, meta }` sin exponer contenido HTML completo en listado; incluye metadatos y última versión. | `VALIDATION_ERROR`, `FORBIDDEN` | `CONTRATOS_LISTAR` |
| `GET /api/contratos/:id` -> `GET /contratos/:id` | `contrato:read` o `contrato:download_own` (solo propio) | Si solo `contrato:download_own`, el contrato debe pertenecer al `empleadoId` del token; caso contrario `404`. | `:id` UUID. | `200 { id, empleadoId, plantillaId, plantillaVersion, estado, versiones: [{ id, version, estado, creadoEn, hashSha256?, firmadoTrabajador, firmadoRepresentante }], creadoEn, actualizadoEn }` | `NOT_FOUND`, `FORBIDDEN` | `CONTRATO_CONSULTAR` |

### Interfaz autorizada hacia ms-personal (HU-18)

ms-contratos no lee `db_personal`. Para resolver las variables consulta la ruta
interna `GET /employees/:id/datos-contrato` de ms-personal, firmada con las
cabeceras de `@arca/internal-auth` del actor original. La ruta exige
`contrato:generate` o `contrato:read` en ms-personal y devuelve únicamente:

```json
{
  "empleadoId": "ec7fb95f-8ae6-48df-8a48-6a88784bef18",
  "nombre_empleado": "Ana María Rojas",
  "ci": "12345678",
  "cargo": "Analista",
  "remuneracion": "6000.00",
  "fecha_ingreso": "2026-01-15",
  "duracion_prueba": "90 días"
}
```

`remuneracion` se omite cuando el actor no tiene `personal:read_salary`. En ese
caso la vista previa conserva `{{remuneracion}}`, lo informa en
`camposFaltantes` y agrega una advertencia, sin bloquear el resto del documento.
La emisión de contrato no persiste CI ni remuneración: solo guarda un snapshot
mínimo (nombre, cargo, fecha de ingreso, duración de prueba y versión).

### PDF, firmas, versiones y descarga (HU-19 / RF-22)

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `POST /api/contratos/:id/pdf` -> `POST /contratos/:id/pdf` | `contrato:generate` | RRHH autorizado. Genera PDF con Puppeteer a partir de plantilla/version + datos resueltos. | `multipart/form-data` o JSON según diseño final (**SUPUESTO: multipart**): `datos` JSON `{ incluirFirmas: true }` y adjuntos opcionales `firmaTrabajador`, `firmaRepresentante` (imagen, magic bytes PNG/JPEG, máximo propuesto 5 MiB). Si faltan firmas requeridas para emisión final, responder error o generar borrador según regla acordada. | `201/200 { contratoId, version, documento: { publicIdRef, versionId, hashSha256?, creadoEn }, estado }`. Objetivo de rendimiento: **< 3 s** en condiciones nominales (validar en ARQ-204). | `VALIDATION_ERROR`, `NOT_FOUND`, `CONTR_PDF_GENERACION`, `CONTR_ARCHIVO_INVALIDO`, `FORBIDDEN` | `CONTRATO_PDF_GENERAR` |
| `GET /api/contratos/:id/versiones/:versionId/descarga` -> `GET /contratos/:id/versiones/:versionId/descarga` | `contrato:read` o `contrato:download_own` (propio) | Verifica propiedad del contrato y existencia de versión; no expone `publicId` crudo innecesariamente. | Sin body. | `200 { url, expiresInSeconds, versionId }` (URL firmada temporal) o stream `application/pdf` según implementación; **definir una sola forma** antes de congelar contrato. | `NOT_FOUND`, `FORBIDDEN` | `CONTRATO_DESCARGAR` |

### Consulta para ficha consolidada (HU-09)

| Método y ruta pública -> interna | Permiso | Propiedad / alcance | Body y validaciones | Respuesta | Errores | Auditoría |
|---|---|---|---|---|---|---|
| `GET /api/contratos/por-empleado/:empleadoId` -> `GET /contratos/por-empleado/:empleadoId` | `contrato:read` o `personal:read` (composición de ficha, si se autoriza) | Acceso transversal RRHH/auditoría/gerencia; funcionario solo si se compone ficha propia y política lo permite (`404` para ajeno). La ficha oculta remuneración sin `personal:read_salary`. | `:empleadoId` UUID, query paginada opcional. | `200 { data: [{ id, estado, plantillaNombre, versionVigente, creadoEn }], meta }` | `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN` | `CONTRATOS_POR_EMPLEADO_LISTAR` |

## Estados propuestos (a confirmar)

- Plantilla: `activa/inactiva` (boolean) + `versionActual`.
- Contrato: `BORRADOR` | `GENERADO` | `EMITIDO` | `ANULADO` (supuesto; confirmar máquina de estados).
- Versión/documento: metadatos inmutables por versión; anulación no borra versiones.

## Errores específicos propuestos

Usar catálogo común + códigos de dominio: `CONTR_TEMPLATE_INVALIDA`,
`CONTR_VARIABLE_NO_PERMITIDA`, `CONTR_DATOS_INCOMPLETOS`,
`CONTR_PLANTILLA_INACTIVA`, `CONTR_PERSONAL_UNAVAILABLE`,
`CONTR_PDF_GENERACION`, `CONTR_ARCHIVO_INVALIDO`.

## Ejemplos JSON (para mocks frontend)

### Crear plantilla
```json
{
  "nombre": "Contrato indefinido estándar",
  "descripcion": "Modelo Ministerio de Trabajo",
  "contenidoHtml": "<h1>Contrato</h1><p>Yo {{nombre_empleado}}, CI {{ci}}, cargo {{cargo}}, remuneración {{remuneracion}}, ingreso {{fecha_ingreso}}, prueba {{duracion_prueba}}.</p>",
  "activa": true
}
```

### Crear contrato
```json
{ "plantillaId": "8b5f4f5c-2d8a-4b2e-a1d9-9a5db6a0e111", "empleadoId": "ec7fb95f-8ae6-48df-8a48-6a88784bef18" }
```

### Respuesta preview efímero (resumen)
```json
{
  "contratoId": null,
  "empleadoId": "ec7fb95f-8ae6-48df-8a48-6a88784bef18",
  "plantillaId": "8b5f4f5c-2d8a-4b2e-a1d9-9a5db6a0e111",
  "plantillaVersion": 3,
  "htmlPreview": "<h1>Contrato</h1><p>Yo Ana María Rojas, CI 12345678...</p>",
  "variablesResueltas": ["nombre_empleado", "ci", "cargo", "fecha_ingreso", "duracion_prueba"],
  "camposFaltantes": ["remuneracion"],
  "advertencias": ["No se resolvió {{remuneracion}}: el dato no está disponible o el actor no tiene personal:read_salary."]
}
```

## Preguntas abiertas

1. ¿La descarga de PDF será **URL firmada** (JSON) o **stream binario**? Afecta frontend y cache headers.
2. ¿Quién puede leer plantillas inactivas? (propuesto: solo `contrato:template_manage`).
3. Confirmar máquina de estados de contrato y si `EMITIDO` requiere firmas de ambas partes.
4. La vista previa efímera `POST /contratos/preview` queda incluida para UX; requiere `contrato:generate`, no persiste y no audita el HTML.
5. Límites exactos de tamaño/tipo para firmas gráficas y política de retención alineada a 8 años donde aplique.
