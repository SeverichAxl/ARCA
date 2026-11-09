# Sprint 2 — Plantillas de contrato (frontend)

Guía de la implementación de **TSK-DEV1-201**: listado, editor WYSIWYG y vista
previa de plantillas de contrato, más la capa base reutilizable del frontend.

- App: `apps/web-frontend` (paquete `web-frontend`).
- Contrato fuente de verdad: [`docs/api/contratos.md`](../api/contratos.md) y
  [`docs/api/openapi/contratos.yaml`](../api/openapi/contratos.yaml).
- Rutas nuevas:
  - `/contratos/plantillas` — listado, búsqueda, filtro por estado, paginación.
  - `/contratos/plantillas/nueva` — alta con editor WYSIWYG.
  - `/contratos/plantillas/[id]` — edición o consulta en modo lectura.
- `/contratos` queda como portada del módulo con acceso a plantillas.

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
| `NEXT_PUBLIC_API_MOCKS` | lista separada por comas; vacío / `none` / `off` / `false` / `0` desactiva | Dominios simulados. Si **no** se define, se simula `contratos`. |
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
| `src/components/shared/*` | `DataTable`, `StatusBadge`, `LoadingSkeleton`, `ErrorAlert`, `ConfirmDialog`, `PermissionGate`, `SafeHtmlPreview`, `MockBanner`. |
| `src/hooks/use-contratos.ts` | Carga de listado y detalle. |

Los componentes **nunca** importan mocks: solo `contratos-api.ts` lo hace.

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

## Mocks y errores simulados

- Dominio por defecto: `contratos`.
- Persistencia: `sessionStorage` (`arca.mock.contratos.plantillas.v1`) o memoria
  cuando no hay `sessionStorage`.
- Latencia determinista de 200–600 ms.
- Errores activables: 401, 403, 404, 409 y 500.
- Datos bolivianos deterministas; las plantillas de ejemplo incluyen el aviso
  **“Modelo de ejemplo: la redacción legal debe validarse.”**
- Banner global fijo: `DATOS SIMULADOS: contratos`.

Ejemplos:

```bash
# Simular conflicto solo en contratos
NEXT_PUBLIC_API_MOCK_ERROR=contratos:409 corepack pnpm --filter web-frontend dev

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

## Pendientes / no verificado

- **Pregunta abierta para backend**: ¿se permite `contrato:read` en
  `GET /plantillas` para GERENCIA y AUDITOR? Hoy el contrato exige
  `contrato:template_manage` o `contrato:generate`, por lo que esos roles no
  ven la sección en la UI.
- Integración real contra ms-contratos cuando existan los handlers; los mocks
  siguen siendo el camino por defecto.
- Prueba manual en navegador de arrastre del divisor, foco y lector de pantalla
  (los tests cubren lógica y render, no interacción real).
- Validación de que el backend acepte el HTML serializado por TipTap tal cual;
  el contrato exige saneamiento del lado servidor.
