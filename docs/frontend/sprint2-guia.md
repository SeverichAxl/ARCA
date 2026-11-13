# Sprint 2 — Plantillas de contrato y boletas (frontend)

Guía de la implementación de **TSK-DEV1-201** (listado, editor WYSIWYG, selector
de funcionario y vista previa real de plantillas de contrato) y
**TSK-DEV1-204** (autoconsulta y descarga de boletas de pago), más la capa base
reutilizable del frontend.

> Estado de TSK-DEV1-201: el dominio `contratos` ya usa el backend real de
> `ms-contratos` por defecto. Solo `planillas` queda simulado si no se define
> `NEXT_PUBLIC_API_MOCKS`; el mock de contratos sigue disponible para demos sin
> backend.

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

## TSK-DEV1-202 — Ficha consolidada y contratos

La ruta `/personal/[id]` reutiliza el detalle de Sprint 1 e incorpora los datos
del expediente (`GET /personal/employees/:id`), la línea de tiempo
(`GET /personal/employees/:id/historial`) y los contratos/versiones
(`GET /contratos/empleado/:empleadoId`). El historial conserva estados de carga,
error y vacío separados de los datos del funcionario.

La ficha respeta la respuesta de personal: muestra la CI ya enmascarada por el
backend sin transformarla y solo renderiza remuneración cuando viene en la
respuesta y el rol tiene `personal:read_salary`. Los nombres de área/cargo se
resuelven desde la respuesta o catálogos permitidos por `catalogo:manage`; si
solo hay IDs, usa etiquetas neutrales.

Para generar un contrato se requiere `contrato:generate`: la ficha permite
elegir una plantilla activa, obtiene la vista previa real y registra el
contrato antes de crear su primera versión PDF. Si falla la creación del PDF,
se conserva el contrato y el diálogo permite reintentar sin duplicarlo. Las
descargas requieren `contrato:read` o `contrato:download_own`; consumen el PDF
directo o la URL firmada de corta duración que devuelve el backend, sin reenviar
credenciales ni persistir la URL.

Brechas del backend reflejadas en la UI:

- **ms-vacaciones:** no hay endpoint de licencias por empleado; la sección indica
  “No disponible todavía”.
- **ms-planillas:** no hay listado de boletas por empleado; la pestaña aparece
  solo con `boleta:read_all` e indica “No disponible todavía”.

Las rutas no agregan permisos nuevos; el gateway mantiene la denegación por
defecto para endpoints que no estén declarados.

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
| `NEXT_PUBLIC_API_MOCKS` | lista separada por comas; vacío / `none` / `off` / `false` / `0` desactiva | Dominios simulados. Si **no** se define, solo se simula `planillas`; `contratos` usa `ms-contratos`. Para activar el mock de contratos usa `contratos,planillas`. |
| `NEXT_PUBLIC_API_MOCK_ERROR` | `409`, `500`, `contratos:409,planillas:500`… | Fuerza errores 401/403/404/409/500 en los mocks **activos**. |
| `NEXT_PUBLIC_API_MOCK_LATENCY` | `0` o sin definir | Sin definir aplica latencia determinista de 200–600 ms. `0` la desactiva (tests). |

> Las variables `NEXT_PUBLIC_*` se embeben en el build. Para una demo con backend
> real compila con `NEXT_PUBLIC_API_MOCKS=none` (o vacío en Linux/macOS) y
> ejecuta `CHECK_DEMO=1 corepack pnpm --filter web-frontend check:mocks`.
> No se agregaron variables de entorno nuevas en TSK-DEV1-201.

## Permisos y roles

Solo se usan permisos existentes en `services/ms-auth/prisma/seed.ts`.

| Acción | Permiso |
|---|---|
| Ver listado y abrir plantilla | `contrato:template_manage` o `contrato:generate` |
| Crear, editar, archivar, reactivar, duplicar | `contrato:template_manage` |
| Vista previa real (`POST /contratos/preview`) | `contrato:generate` |
| Buscar funcionario para la vista previa | `personal:read` |
| Mostrar nombres de área y cargo | `catalogo:manage` (opcional; si falta, se muestran solo identificadores) |

Comportamiento por rol:

- **RRHH_OPERATIVO**: acceso completo (crear/editar/archivar/duplicar), vista
  previa real y selector de funcionario.
- Un rol con solo `contrato:generate` vería el listado y abriría el editor en
  modo lectura, sin barra activa ni botón Guardar. Puede generar la vista previa
  real si además tiene `personal:read` para elegir al funcionario.
- **GERENCIA**, **AUDITOR**, **ADMIN_GENERAL**, **ENCARGADO_NOMINA**,
  **JEFE_AREA** y **FUNCIONARIO**: no ven la entrada de menú ni pueden entrar a
  las rutas de plantillas; la URL directa los redirige a acceso denegado.

`contrato:read` no habilita las rutas de plantillas. La vista previa real
requiere `contrato:generate`; si el rol solo tiene `personal:read`, puede buscar
funcionarios pero no generar la vista real. Si falta `personal:read`, el selector
muestra un aviso y la vista previa real queda deshabilitada (el listado real de
personal exige ese permiso).

Los errores 403 se muestran como “No tienes permiso para realizar esta
operación” o con el mensaje contractual, sin reintentar automáticamente. Los 400
de variables muestran exactamente las variables rechazadas por el servidor.

## TSK-DEV1-203 — Calendario de descansos

La pestaña Calendario consulta `GET /vacaciones/solicitudes?vista=propias` con
los límites del mes (`desde` y `hasta`) y muestra únicamente rangos con estado
`APROBADO_FINAL`. La consulta se mantiene en el ámbito propio autorizado por
`vacaciones:read_own`; no se infieren ausencias a partir de solicitudes
pendientes ni de los saldos.

El backend actual no ofrece una consulta de ausencias por área/global ni un
endpoint de lectura de licencias. Por eso el calendario todavía no filtra por
área ni incluye licencias remuneradas; la interfaz lo informa y no sustituye
esos datos con contenido simulado. Para completar esos alcances se requiere
publicar y autorizar las consultas correspondientes en el API.

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
| `src/lib/api/contratos/contratos-api.ts` | Cliente CRUD y vista previa real con conmutación mock/real. |
| `src/lib/api/contratos/employees-api.ts` | Búsqueda paginada de funcionarios y mapeo mínimo para la vista previa. |
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
| `src/components/contratos/employee-combobox.tsx` | Selector real de funcionario con debounce, cancelación, paginación y permisos. |
| `src/hooks/use-contratos.ts` / `use-planillas.ts` | Carga de listado, detalle y descarga. |

Los componentes **nunca** importan mocks: solo `contratos-api.ts` y
`planillas-api.ts` lo hacen.

## Variables y validación

Variables permitidas (las seis del backend):

`nombre_empleado`, `ci`, `cargo`, `remuneracion`, `fecha_ingreso`,
`duracion_prueba`.

Reglas implementadas, alineadas con `CreatePlantillaDto`/`UpdatePlantillaDto`:

- Nombre obligatorio, máximo **200 caracteres**.
- Descripción opcional, máximo **1 000 caracteres**.
- Contenido obligatorio (no basta HTML vacío), máximo **200 000 caracteres**
  (el backend valida caracteres, no bytes; la UI conserva el conteo de bytes
  solo como dato informativo).
- Variables desconocidas: **bloquean** el guardado.
- Llaves desbalanceadas o placeholders malformados: **bloquean** el guardado.
- Variables recomendadas ausentes (`fecha_ingreso`, `remuneracion`,
  `duracion_prueba`): solo **advertencia**, no bloquean.

El editor guarda las variables como texto literal `{{variable}}`; no las
transforma. La barra de variables inserta el texto en la posición del cursor y
las resalta dentro del editor (las desconocidas se marcan en rojo).

Errores del backend cubiertos por la UI:

| Respuesta | Presentación |
|---|---|
| `400 CONTR_VARIABLE_NO_PERMITIDA` con `details.variables` | Lista exacta de variables rechazadas (`{{variable}}`), tanto al guardar como al previsualizar. |
| `400 CONTR_TEMPLATE_INVALIDA` | Mensaje accionable de ErrorAlert; la validación local evita la mayoría de casos. |
| `400 CONTR_PLANTILLA_INACTIVA` | “La plantilla está inactiva. Reactívala antes de generar una vista previa real.” |
| `422 CONTR_DATOS_INCOMPLETOS` con `details.fields` | Mensaje de datos insuficientes; los campos se muestran cuando el backend los envía. |
| `403` | “No tienes permiso para realizar esta operación”, sin exponer detalles internos. |

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

El panel de vista previa incluye:

- Un selector real de funcionario (`EmployeeCombobox`) con búsqueda por nombre
  o CI exacta, debounce de 300 ms, `AbortController`, paginación “Cargar más” y
  permiso `personal:read`.
- Dos pestañas: **Contenido actual** (sustitución local, sin enviar HTML al
  servidor) y **Vista previa con datos reales** (`POST /contratos/preview`).
- Aviso explícito cuando la vista real usa la versión guardada y hay cambios sin
  guardar; en ese caso los cambios locales no se incluyen hasta guardar.
- Estados de carga, error y reintento independientes del guardado.

El selector no muestra CI ni remuneración en la lista. Si el rol no tiene
`catalogo:manage`, el backend devuelve solo `areaId`/`cargoId`; la UI muestra
“Área y cargo no disponibles” en lugar de inventar nombres.

## Vista previa segura y real

`SafeHtmlPreview` genera un `iframe` con:

- `sandbox=""` (sin scripts ni same-origin).
- `srcDoc` sanitizado con DOMPurify (lista blanca de etiquetas/atributos).
- CSP `default-src 'none'; style-src 'unsafe-inline'; img-src data:`.
- Hoja A4 blanca independiente del tema oscuro de la app.

Toda vista previa, local o real, se renderiza **siempre** dentro de
`SafeHtmlPreview`; nunca se inyecta HTML con `dangerouslySetInnerHTML` fuera del
iframe aislado.

La vista local sustituye variables con los datos visibles del funcionario
seleccionado y resalta lo que falte; se actualiza 300 ms después de dejar de
escribir y no hace peticiones. La vista real:

- Requiere una plantilla guardada (`templateId`), permiso `contrato:generate` y
  un funcionario seleccionado.
- Envía exactamente `{ plantillaId, empleadoId }` a
  `POST /api/contratos/preview`; no persiste contratos ni datos personales.
- Usa `AbortController` para cancelar peticiones anteriores y debounce de 300 ms.
- Muestra versión de plantilla, variables resueltas, campos faltantes y
  advertencias devueltas por el backend.
- No registra HTML, nombres, CI ni datos del funcionario en consola, URL ni
  `localStorage`/`sessionStorage`.

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

- Dominios por defecto: **solo `planillas`**. `contratos` usa el backend real;
  para activar su mock hay que incluirlo explícitamente:
  `NEXT_PUBLIC_API_MOCKS=contratos,planillas`.
- Persistencia: `sessionStorage` (`arca.mock.contratos.plantillas.v1`) o memoria
  cuando no hay `sessionStorage`. Las boletas de planillas son un conjunto
  determinista en memoria (10+2 boletas de 2026) con montos balanceados y hash
  SHA-256 de 64 caracteres hexadecimales.
- Latencia determinista de 200–600 ms.
- Errores activables: 401, 403, 404, 409 y 500, por dominio activo.
- Datos bolivianos deterministas; las plantillas de ejemplo incluyen el aviso
  **“Modelo de ejemplo: la redacción legal debe validarse.”** y la pantalla de
  boletas muestra un aviso de importes simulados.
- Banner global fijo solo con los dominios simulados activos; por defecto
  muestra `DATOS SIMULADOS: planillas`. Con el mock de contratos activo muestra
  `DATOS SIMULADOS: contratos, planillas`.
- Los mocks de planillas simulan el scope propio desde `empleadoId` de la
  sesión: una boleta de otro funcionario devuelve 404.
- El mock de contratos implementa la misma forma de `POST /contratos/preview`
  (incluido `CONTR_PLANTILLA_INACTIVA`) y conserva el HTML crudo para que
  `SafeHtmlPreview` resalte los campos faltantes.

Ejemplos:

```bash
# Demo con backend real para contratos y mocks solo en planillas
NEXT_PUBLIC_API_MOCKS=planillas corepack pnpm --filter web-frontend dev

# Activar también el mock de contratos y simular un conflicto en ese dominio
NEXT_PUBLIC_API_MOCKS=contratos,planillas NEXT_PUBLIC_API_MOCK_ERROR=contratos:409 corepack pnpm --filter web-frontend dev

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
- `mock-contratos.test.ts`: CRUD, versiones, duplicado, 404, 409, 500 y vista
  previa simulada.
- `contratos-api.test.ts`: `POST /contratos/preview` con body exacto y `signal`;
  query real de listado (`page`, `pageSize`, `activa`, `q`).
- `employees-api.test.ts`: query real de funcionarios, paginación, límite de
  `pageSize`, CI exacta y mapeo de remuneración sin campos extra.
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
- `mock-status.test.ts`: default solo `planillas`, dominios, errores, latencia,
  sentinelas y chequeo demo.
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
4. **Vista previa real**: existe `POST /contratos/preview` con body
   `{ plantillaId, empleadoId }`, permiso `contrato:generate` y respuesta
   `PreviewContrato` con `contratoId: null`. La UI la usa sobre la **versión
   guardada**; no hay preview del HTML sin guardar. La vista local sigue
   disponible para editar sin llamar al backend.
5. **Límite de contenido**: el backend valida 200 000 caracteres en
   `contenidoHtml`, 200 en `nombre` y 1 000 en `descripcion`; el frontend aplica
   exactamente esos límites.
6. **Datos del selector de funcionario**: `GET /personal/employees` exige
   `personal:read`, devuelve CI enmascarada y solo `areaId`/`cargoId` (sin
   nombres). La remuneración se omite sin `personal:read_salary`. La UI no
   muestra CI ni remuneración; resuelve nombres de área/cargo solo si el rol
   tiene `catalogo:manage`. Un rol con `contrato:generate` pero sin
   `personal:read` no puede usar el selector real.
7. **Plantilla inactiva**: `POST /contratos/preview` responde
   `400 CONTR_PLANTILLA_INACTIVA`; la UI lo muestra y sugiere reactivarla.
8. **Descarga de boleta**: el contrato v1 responde JSON con una URL firmada de
   60 s, no un PDF directo. `descargarBoletaPdf` obtiene la URL y descarga el
   binario; además acepta una respuesta PDF directa por si el backend cambia.
9. **Desglose de boleta**: el OpenAPI de listado no expone `estado` y el de
   detalle no publica el desglose completo. El tipo deja `estado` opcional (la
   UI usa `EMITIDA` como respaldo) y solo renderiza el desglose cuando el mock o
   un backend futuro lo entregan.
10. **`empleadoId` en la sesión**: el JWT de ms-auth ya firmaba `empleadoId`,
    pero el frontend no lo leía. Se agregó al tipo `AuthSession.user` de forma
    aditiva; no se envió como query ni se alteró la autenticación existente
    (`auth-session.test.ts` cubre el comportamiento previo).
11. **Horas extra / otros ingresos**: la base de datos no tiene columnas
    explícitas para esos conceptos; el mock los entrega dentro del desglose. Si
    el backend real los expone, se ubican en `calculoSnapshot`.
12. **OpenAPI desactualizado**: `docs/api/openapi/contratos.yaml` aún no
    documenta `POST /api/contratos/preview` en el fragmento revisado, y su
    esquema `Preview` no incluye `plantillaId` ni `contratoId` nullable. El
    frontend se alineó con el controlador y los DTO reales de ms-contratos.

## Pendientes / no verificado

- **Pregunta abierta para backend**: ¿se permite `contrato:read` en
  `GET /plantillas` para GERENCIA y AUDITOR? Hoy el contrato exige
  `contrato:template_manage` o `contrato:generate`, por lo que esos roles no
  ven la sección en la UI.
- **Brecha de permisos del selector**: `GET /personal/employees` exige
  `personal:read`. Un rol con `contrato:generate` pero sin `personal:read` no
  puede elegir funcionario, aunque sí podría previsualizar si conociera el UUID.
  Evaluar un endpoint de búsqueda acotado para contratos o ampliar el permiso
  del endpoint con criterio de backend.
- **Nombres de área/cargo**: el listado de personal solo devuelve IDs. Sin
  `catalogo:manage` la UI no puede mostrar nombres; hoy lo informa en pantalla.
- Integración real autenticada contra `ms-contratos`: el flujo está conectado,
  pero no se pudo generar un token en este entorno (`DEV_JWT_ENABLED`,
  `DEV_JWT_PRIVATE_KEY`, `JWT_KID`, `JWT_ISSUER` y `JWT_AUDIENCE` ausentes, y
  `POST /api/auth/login` con las credenciales de `.env.example` devuelve 500).
  Verificar listado, alta, edición, archivo/reactivación y `POST /preview` con
  un token real.
- Integración real contra ms-planillas para boletas: el contrato está mergeado,
  pero los handlers reales deben confirmarse. Verificar en particular la forma
  exacta de la respuesta de `GET /boletas/:id/descarga` y si incluye
  `Content-Disposition` al descargar la URL firmada.
- Prueba manual en navegador de arrastre del divisor, foco, lector de pantalla y
  debounce del selector (los tests cubren lógica y render, no interacción real).
- Prueba manual de `Mis boletas` con los siete roles: `ADMIN_GENERAL` no tiene
  `empleadoId` en el mock y debe ver el aviso de usuario no vinculado.
- Validación de que el backend acepte el HTML serializado por TipTap tal cual;
  el contrato exige saneamiento del lado servidor.
- Verificar en navegador que la vista previa real use la versión guardada
  (aviso visible), que la inactiva devuelva `CONTR_PLANTILLA_INACTIVA` y que
  `400 CONTR_VARIABLE_NO_PERMITIDA` liste las variables de
  `details.variables`.
