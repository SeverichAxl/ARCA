# Sprint 2 — Plantillas de contrato y boletas (frontend)

Guía de la implementación de **TSK-DEV1-201** (listado, editor WYSIWYG y vista
previa de plantillas de contrato) y **TSK-DEV1-204** (autoconsulta y descarga de
boletas de pago), más la capa base reutilizable del frontend.

- App: `apps/web-frontend` (paquete `web-frontend`).
- Contratos fuente de verdad:
  - [`docs/api/contratos.md`](../api/contratos.md) y
    [`docs/api/openapi/contratos.yaml`](../api/openapi/contratos.yaml).
  - [`docs/api/planillas.md`](../api/planillas.md) y
    [`docs/api/openapi/planillas.yaml`](../api/openapi/planillas.yaml).
- Rutas nuevas:
  - `/contratos/plantillas` — listado, búsqueda, filtro por estado, paginación.
  - `/contratos/plantillas/nueva` — alta con editor WYSIWYG.
  - `/contratos/plantillas/[id]` — edición o consulta en modo lectura.
  - `/boletas/mis-boletas` — autoconsulta de boletas por periodo y descarga PDF.
- `/contratos` y `/boletas` quedan como portadas de sus módulos.

## Puesta en marcha

```bash
corepack pnpm install
corepack pnpm --filter web-frontend dev
```

La app queda en `http://localhost:3000`. Para probar roles, usa el login en modo
mock (`NEXT_PUBLIC_AUTH_MODE=mock`) y selecciona un rol.

### Variables de entorno del frontend

Agrégalas manualmente en `apps/web-frontend/.env.local` (no se modificó
`.env.example`):

| Variable | Valores | Efecto |
|---|---|---|
| `NEXT_PUBLIC_API_MOCKS` | lista separada por comas; vacío / `none` / `off` / `false` / `0` desactiva | Dominios simulados. Si **no** se define, se simulan `contratos,planillas`. |
| `NEXT_PUBLIC_API_MOCK_ERROR` | `409`, `500`, `contratos:409,planillas:500`… | Fuerza errores 401/403/404/409/500 en los mocks. |
| `NEXT_PUBLIC_API_MOCK_LATENCY` | `0` o sin definir | Sin definir aplica latencia determinista de 200–600 ms. `0` la desactiva (tests). |

> Las variables `NEXT_PUBLIC_*` se embeben en el build. Para una demo con backend
> real compila con `NEXT_PUBLIC_API_MOCKS=none` (o vacío en Linux/macOS) y
> ejecuta `CHECK_DEMO=1 corepack pnpm --filter web-frontend check:mocks`.

## Permisos y roles

Solo se usan permisos existentes en `services/ms-auth/prisma/seed.ts`.

| Acción | Permiso |
|---|---|
| Ver listado y abrir plantilla | `contrato:template_manage` o `contrato:generate` |
| Crear, editar, archivar, reactivar, duplicar | `contrato:template_manage` |

Comportamiento por rol:

- **RRHH_OPERATIVO**: acceso completo (crear/editar/archivar/duplicar).
- Un rol con solo `contrato:generate` vería el listado y abriría el editor en
  modo lectura, sin barra activa ni botón Guardar.
- **GERENCIA**, **AUDITOR**, **ADMIN_GENERAL**, **ENCARGADO_NOMINA**,
  **JEFE_AREA** y **FUNCIONARIO**: no ven la entrada de menú ni pueden entrar a
  las rutas de plantillas; la URL directa los redirige a acceso denegado.

`contrato:read` no habilita las rutas de plantillas.

Para **Mis boletas** el único permiso es `boleta:read_own`, incluido en `PROPIOS`
del seed, por lo que los siete roles lo tienen. `boleta:read_all` existe en el
seed pero **no** habilita ninguna vista: no se implementó consulta de boletas de
terceros. Sin `boleta:read_own` la ruta redirige a acceso denegado.

El gateway y cada servicio siguen siendo la defensa real; `PermissionGate` y el
guardián de rutas solo ocultan/redirigen en la UI.

## Capa base reutilizable

| Archivo | Uso |
|---|---|
| `src/lib/api/api-error.ts` | `ApiError` normalizado (`statusCode`, `code`, `message`, `details`, `traceId`) y `readJson`. |
| `src/lib/api/mock-status.ts` | Dominios simulados, errores, latencia y chequeo de demo. |
| `src/lib/api/contratos/types.ts` | Tipos exactos del OpenAPI y catálogo de variables. |
| `src/lib/api/contratos/variables.ts` | Extracción, validación y sustitución de `{{variables}}`. |
| `src/lib/api/contratos/preview.ts` | Sanitización DOMPurify, CSP y documento A4. |
| `src/lib/api/contratos/contratos-api.ts` | Cliente CRUD con conmutación mock/real. |
| `src/lib/api/mocks/contratos.mock.ts` | Almacén determinista en memoria/`sessionStorage`. |
| `src/lib/api/planillas/types.ts` | Tipos de listado, detalle, desglose y descarga. |
| `src/lib/api/planillas/planillas-api.ts` | Cliente de boletas con conmutación mock/real y descarga por URL firmada. |
| `src/lib/api/planillas/errors.ts` | Mensajes de error de boletas sin filtrar detalles del servidor. |
| `src/lib/api/planillas/load.ts` | `loadMisBoletasPage` con guarda de `empleadoId` nulo. |
| `src/lib/api/file-download.ts` | Parseo de `Content-Disposition`, descarga y liberación de object URL. |
| `src/lib/api/mocks/planillas.mock.ts` | Boletas deterministas de 2026 para el mock de planillas. |
| `src/lib/format/money.ts` | Formato de montos desde string decimal (sin flotantes). |
| `src/lib/format/period.ts` | Periodos y fechas en español, seguras ante zona horaria. |
| `src/components/shared/*` | `DataTable`, `StatusBadge`, `LoadingSkeleton`, `ErrorAlert`, `ConfirmDialog`, `PermissionGate`, `SafeHtmlPreview`, `MockBanner`, `MoneyText`, `PeriodText`, `FileDownloadButton`. |
| `src/hooks/use-contratos.ts` / `use-planillas.ts` | Carga de listado, detalle y descarga. |

Los componentes **nunca** importan mocks: solo `contratos-api.ts` y
`planillas-api.ts` lo hacen.

## Variables y validación

Variables permitidas (las seis del backend):

`nombre_empleado`, `ci`, `cargo`, `remuneracion`, `fecha_ingreso`,
`duracion_prueba`.

Reglas implementadas:

- Nombre obligatorio, máximo 120 caracteres.
- Descripción opcional, máximo 500 caracteres.
- Contenido obligatorio (no basta HTML vacío).
- Variables desconocidas: **bloquean** el guardado.
- Llaves desbalanceadas o placeholders malformados: **bloquean** el guardado.
- Variables recomendadas ausentes (`fecha_ingreso`, `remuneracion`,
  `duracion_prueba`): solo **advertencia**, no bloquean.
- Tamaño máximo de contenido: 200 KB en UTF-8 (límite de respaldo del frontend;
  el contrato no fija uno).

El editor guarda las variables como texto literal `{{variable}}`; no las
transforma. La barra de variables inserta el texto en la posición del cursor y
las resalta dentro del editor (las desconocidas se marcan en rojo).

## Editor WYSIWYG

TipTap con:

- Negrita, cursiva, subrayado.
- Encabezados H1–H3.
- Listas con viñetas y numeradas.
- Alineación izquierda/centro/derecha/justificado.
- Tabla básica (insertar 3×3, agregar fila/columna, eliminar).
- Deshacer/rehacer.

La pantalla divide editor y vista previa con un divisor arrastrable (30–70 %) y
teclado (flechas). En móvil se usan pestañas **Editor** / **Vista previa**.

## Vista previa segura

`SafeHtmlPreview` genera un `iframe` con:

- `sandbox=""` (sin scripts ni same-origin).
- `srcDoc` sanitizado con DOMPurify (lista blanca de etiquetas/atributos).
- CSP `default-src 'none'; style-src 'unsafe-inline'; img-src data:`.
- Hoja A4 blanca independiente del tema oscuro de la app.
- Sustitución local con funcionarios de ejemplo; el contrato real **no** expone
  vista previa de plantillas.

La vista previa se actualiza 300 ms después de dejar de escribir.

## Autoconsulta de boletas (TSK-DEV1-204)

Ruta `/boletas/mis-boletas`, entrada de menú **Mis boletas** y permiso
`boleta:read_own`. La pantalla lista las boletas del funcionario autenticado,
permite filtrar por año/mes, ver el detalle y descargar el PDF.

Flujo de datos:

- `useMisBoletas(empleadoId, filters)` llama a
  `GET /api/planillas/boletas` con `page`, `pageSize` y, si aplica, `periodo`
  (`YYYY-MM`). No se envía `planillaId` desde la UI ni `empleadoId` como query:
  el backend aplica el funcionario del token.
- `useBoletaDetalle(id, empleadoId)` llama a `GET /api/planillas/boletas/:id` al
  abrir el diálogo.
- La descarga usa `GET /api/planillas/boletas/:id/descarga` con el cliente
  autenticado. El contrato v1 devuelve JSON
  `{ url, expiresInSeconds: 60, hashSha256 }`; el frontend pide esa URL firmada
  con `fetch(..., { credentials: 'omit' })` y descarga el PDF. Si el backend
  respondiera el PDF directo (`Content-Type: application/pdf`), también funciona.
- El nombre del archivo se toma de `Content-Disposition`; si falta, se usa
  `boleta-<periodo>.pdf`.

`empleadoId` se toma de la sesión (`session.user.empleadoId`), que a su vez viene
del claim `empleadoId` del JWT de ms-auth. Si el usuario no tiene empleado
vinculado, la pantalla muestra **“Tu usuario no está vinculado a un funcionario”**
y no llama a la API.

Estados cubiertos:

| Situación | Comportamiento |
|---|---|
| Cargando | `LoadingSkeleton` de tabla/cards y de formulario en el detalle. |
| Sin boletas | `EmptyState` con mensaje distinto si hay filtro de periodo. |
| Error de red/5xx | `ErrorAlert` con reintento. |
| 401 | Mensaje de sesión vencida; el proveedor de auth conserva su comportamiento. |
| 403 / 404 | “No tienes acceso a este documento”, sin códigos ni traceId. |
| Sin `desglose` | Nota de metadatos: el contrato no publica el desglose completo. |
| Descarga no disponible | Error explícito, sin exponer la URL ni el hash. |

Seguridad y accesibilidad:

- El token nunca viaja en la URL; las URLs firmadas se piden sin credenciales.
- No se registran importes, hashes ni tokens en consola.
- Tabla con `caption`, encabezados y `aria-label`; versión móvil en tarjetas con
  paginación propia. Contraste y modo oscuro usan las utilidades del tema.
- El hash SHA-256 se muestra como texto seleccionable y se puede copiar con
  confirmación `role="status"`; si falla, se indica copiar manualmente.

## Mocks y errores simulados

- Dominios por defecto: `contratos,planillas`.
- Persistencia: `sessionStorage` (`arca.mock.contratos.plantillas.v1`) o memoria
  cuando no hay `sessionStorage`. Las boletas de planillas son un conjunto
  determinista en memoria (10+2 boletas de 2026) con montos balanceados y hash
  SHA-256 de 64 caracteres hexadecimales.
- Latencia determinista de 200–600 ms.
- Errores activables: 401, 403, 404, 409 y 500, por dominio.
- Datos bolivianos deterministas; las plantillas de ejemplo incluyen el aviso
  **“Modelo de ejemplo: la redacción legal debe validarse.”** y la pantalla de
  boletas muestra un aviso de importes simulados.
- Banner global fijo: `DATOS SIMULADOS: contratos, planillas`.
- Los mocks de planillas simulan el scope propio desde `empleadoId` de la
  sesión: una boleta de otro funcionario devuelve 404.

Ejemplos:

```bash
# Simular conflicto solo en contratos
NEXT_PUBLIC_API_MOCK_ERROR=contratos:409 corepack pnpm --filter web-frontend dev

# Simular error de servidor solo en planillas
NEXT_PUBLIC_API_MOCK_ERROR=planillas:500 corepack pnpm --filter web-frontend dev

# Demo sin mocks (Linux/macOS)
NEXT_PUBLIC_API_MOCKS= CHECK_DEMO=1 corepack pnpm --filter web-frontend check:mocks
```

En PowerShell, asignar `''` elimina la variable; usa `none`:

```powershell
$env:NEXT_PUBLIC_API_MOCKS='none'
$env:CHECK_DEMO='1'
corepack pnpm --filter web-frontend check:mocks
```

## Pruebas y verificación

```bash
corepack pnpm --filter web-frontend typecheck
corepack pnpm --filter web-frontend lint
corepack pnpm --filter web-frontend test
corepack pnpm --filter web-frontend build
corepack pnpm --filter web-frontend check:mocks
```

Cobertura de tests (`tests/`):

- `variables.test.ts`: extracción, formato, llaves, variables desconocidas,
  recomendadas, límites y sustitución/escape.
- `preview.test.ts`: sandbox, DOMPurify, CSP y documento A4.
- `editor-serialization.test.ts`: serialización TipTap, formato, variables,
  tablas y resaltado.
- `mock-contratos.test.ts`: CRUD, versiones, duplicado, 404, 409 y 500.
- `mock-planillas.test.ts`: montos balanceados, 404 de boleta ajena, descarga y
  errores simulados.
- `planillas-api.test.ts`: query sin `empleadoId`, descarga por URL firmada vs.
  PDF directo y guarda de `empleadoId` nulo.
- `file-download.test.ts`: nombre desde `Content-Disposition`, nombre por
  defecto, errores 401/403/404 y liberación de object URL.
- `money.test.ts` / `period.test.ts`: formato de montos sin flotantes y
  periodos/fechas en español.
- `auth-session.test.ts`: comportamiento previo de la sesión más el claim
  aditivo `empleadoId`.
- `mock-status.test.ts`: dominios, errores, latencia, sentinelas y chequeo demo.
- `permissions.test.ts`: matriz de los 7 roles, visibilidad del menú,
  `PermissionGate` y rutas.

## Diferencias con el contrato de backend

1. **Lectura de plantillas**: el contrato del backend permite listar/consultar
   solo con `contrato:template_manage` o `contrato:generate`. La UI aplica
   exactamente esa regla; `contrato:read` no da acceso a las plantillas. Por
   eso GERENCIA y AUDITOR no ven la sección. Queda como pregunta abierta si el
   backend permitirá `contrato:read` en `GET /plantillas` para esos roles (ver
   Pendientes).
2. **Archivar**: no existe `DELETE` ni endpoint de archivo. Se usa
   `PATCH /contratos/plantillas/:id` con `{ activa: false }`; “Reactivar” usa
   `{ activa: true }`.
3. **Duplicar**: no existe endpoint de duplicado. Se compone con
   `GET /contratos/plantillas/:id` + `POST /contratos/plantillas`.
4. **Vista previa**: no existe preview de plantilla. El editor sustituye
   variables localmente con datos de ejemplo. `contratosApi.previewContrato()`
   queda preparado para el `POST /contratos/:id/preview` real, pero no se usa en
   el editor.
5. **Límite de contenido**: el contrato no publica un máximo; se aplica 200 KB
   como respaldo frontend.
6. **Descarga de boleta**: el contrato v1 responde JSON con una URL firmada de
   60 s, no un PDF directo. `descargarBoletaPdf` obtiene la URL y descarga el
   binario; además acepta una respuesta PDF directa por si el backend cambia.
7. **Desglose de boleta**: el OpenAPI de listado no expone `estado` y el de
   detalle no publica el desglose completo. El tipo deja `estado` opcional (la
   UI usa `EMITIDA` como respaldo) y solo renderiza el desglose cuando el mock o
   un backend futuro lo entregan.
8. **`empleadoId` en la sesión**: el JWT de ms-auth ya firmaba `empleadoId`,
   pero el frontend no lo leía. Se agregó al tipo `AuthSession.user` de forma
   aditiva; no se envió como query ni se alteró la autenticación existente
   (`auth-session.test.ts` cubre el comportamiento previo).
9. **Horas extra / otros ingresos**: la base de datos no tiene columnas
   explícitas para esos conceptos; el mock los entrega dentro del desglose. Si
   el backend real los expone, se ubican en `calculoSnapshot`.

## Pendientes / no verificado

- **Pregunta abierta para backend**: ¿se permite `contrato:read` en
  `GET /plantillas` para GERENCIA y AUDITOR? Hoy el contrato exige
  `contrato:template_manage` o `contrato:generate`, por lo que esos roles no
  ven la sección en la UI.
- Integración real contra ms-contratos cuando existan los handlers; los mocks
  siguen siendo el camino por defecto.
- Integración real contra ms-planillas para boletas: el contrato está mergeado,
  pero los handlers reales deben confirmarse. Verificar en particular la forma
  exacta de la respuesta de `GET /boletas/:id/descarga` y si incluye
  `Content-Disposition` al descargar la URL firmada.
- Prueba manual en navegador de arrastre del divisor, foco y lector de pantalla
  (los tests cubren lógica y render, no interacción real).
- Prueba manual de `Mis boletas` con los siete roles: `ADMIN_GENERAL` no tiene
  `empleadoId` en el mock y debe ver el aviso de usuario no vinculado.
- Validación de que el backend acepte el HTML serializado por TipTap tal cual;
  el contrato exige saneamiento del lado servidor.
