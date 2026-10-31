# Sistema de Gestión Humana ARCA Ltda.

Monorepo con microservicios **NestJS**, frontend **Next.js (App Router)** y paquetes
compartidos en TypeScript. Esta entrega contiene únicamente la **estructura base
ejecutable**: endpoints `/health`, Swagger condicional, seguridad por defecto, Prisma
configurado y las rutas visuales del frontend, sin lógica de negocio.

## Estructura

```
.
├── apps/
│   ├── api-gateway/          # Gateway NestJS: auth JWT RS256, proxy, rate limit
│   └── web-frontend/         # Next.js + Tailwind + shadcn/ui
├── services/
│   ├── ms-auth/              # Autenticación (incluye seed de administrador)
│   ├── ms-personal/          # Personal
│   ├── ms-vacaciones/        # Vacaciones
│   ├── ms-contratos/         # Contratos
│   └── ms-planillas/         # Planillas
├── packages/
│   ├── common-dtos/          # JwtPayload, EventEnvelope y nombres de eventos
│   ├── crypto-utils/         # AES-256-GCM, HMAC-SHA256, SHA-256 + tests Jest
│   ├── messaging/            # RabbitMQ, Outbox, reintentos e idempotencia
│   └── database-config/      # Paquete reservado (vacío)
├── docker/
│   ├── Dockerfile.service    # Genérico para servicios NestJS (ARG SERVICE)
│   ├── Dockerfile.frontend   # Imagen del frontend
│   └── init-scripts/         # Creación de roles y bases de datos
├── docs/                     # api/, adr/, spikes/, db/
└── .github/                  # CI y plantilla de Pull Request
```

Cada microservicio usa las capas `src/domain`, `src/application` y
`src/infrastructure`. La regla ESLint `no-restricted-imports` impide que `domain`
importe desde `infrastructure` (RNF-08).

## Requisitos

- Node.js 20 o superior (probado con Node 24).
- pnpm 9 (`corepack enable`).
- Docker 24+ y Docker Compose v2.
- PostgreSQL 16 y RabbitMQ 3 se levantan con Docker Compose.

## Arranque rápido

```bash
cp .env.example .env
# Edite .env: reemplace todos los placeholders (JWT, base de datos, llaves, etc.)
corepack enable
pnpm install
docker compose up --build
```

Servicios disponibles:

- Frontend: http://localhost:3000
- API Gateway: http://localhost:4000
- Health del gateway: http://localhost:4000/health
- Swagger (si `SWAGGER_ENABLED=true`): http://localhost:4000/docs
- RabbitMQ Management: http://127.0.0.1:15672

Para desarrollo local sin contenedores:

```bash
pnpm install
pnpm dev
```

> El host de las bases de datos en `.env.example` es `postgres` porque está pensado
> para Docker. Si ejecuta los servicios fuera de Compose, cambie el host a
> `localhost` en las variables `*_DATABASE_URL` y `*_DIRECT_URL`.
>
> Para ejecutar Prisma desde una carpeta `services\ms-*`, cree allí un `.env`
> (ignorado por Git) con `DATABASE_URL` usando el rol `ms_*_app` y `DIRECT_URL`
> usando `ms_*_owner`, ambos apuntando a `localhost` y a la base `db_*` del servicio.

## Puertos

| Componente          | Host                     | Contenedor |
| ------------------- | ------------------------ | ---------- |
| Frontend            | `3000`                   | `3000`     |
| API Gateway         | `4000`                   | `4000`     |
| ms-auth             | — (solo red interna)     | `4001`     |
| ms-personal         | — (solo red interna)     | `4002`     |
| ms-vacaciones       | — (solo red interna)     | `4003`     |
| ms-contratos        | — (solo red interna)     | `4004`     |
| ms-planillas        | — (solo red interna)     | `4005`     |
| PostgreSQL          | `127.0.0.1:5432`         | `5432`     |
| RabbitMQ AMQP       | `127.0.0.1:5672`         | `5672`     |
| RabbitMQ Management | `127.0.0.1:15672`        | `15672`    |

## Scripts raíz

| Comando                | Descripción                                        |
| ---------------------- | -------------------------------------------------- |
| `pnpm build`           | Compila todos los paquetes y aplicaciones           |
| `pnpm lint`            | Ejecuta ESLint en todo el workspace                 |
| `pnpm test`            | Ejecuta los tests (Jest)                            |
| `pnpm format`          | Formatea con Prettier                               |
| `pnpm dev`             | Levanta frontend y servicios en modo watch          |
| `pnpm prisma:validate` | Ejecuta `prisma validate` en los 5 servicios        |
| `pnpm prisma:generate` | Ejecuta `prisma generate` en los 5 servicios        |
| `pnpm db:migrate:all` | Aplica migraciones publicadas en las 5 bases (`migrate deploy`) |
| `pnpm db:seed:all` | Ejecuta los seeds idempotentes de auth, personal y vacaciones |
| `pnpm db:docs` | Genera diccionario y MER Mermaid a partir de DMMF generado |
| `pnpm db:verify-isolation` | Comprueba roles de BD, privilegios de auditoría y URLs de Compose |
| `pnpm messaging:integration` | Verifica persistencia, reintentos y DLQ; requiere RabbitMQ |
| `pnpm db:reset` | **DESTRUCTIVO**: restablece las cinco bases; exige escribir `DESTRUCTIVE` |

`db:migrate:all`, `db:seed:all` y `db:reset` seleccionan los pares específicos
`*_DATABASE_URL`/`*_DIRECT_URL` de `.env`; si el host es el nombre interno
`postgres`, lo transforman a `127.0.0.1:POSTGRES_PORT` para ejecutar Prisma desde
Windows. Requieren que Postgres esté arriba y publicado en loopback. Usan el rol owner solo para
migraciones y el rol app para seeds. Seeds no requieren permisos de escritura
de esquema. `prisma:validate` y `prisma:generate` no conectan a la BD. Copie
`.env.example` a `.env`, complete los secretos y actualice ambas URLs de cada
servicio al cambiar contraseñas; codifique los caracteres especiales de las
contraseñas al incluirlas en una URL.

Los contenedores ejecutan `prisma migrate deploy` usando `DIRECT_URL` antes de
arrancar; el seed solo se ejecuta con `RUN_SEED_AUTH=true`,
`RUN_SEED_PERSONAL=true` o `RUN_SEED_VACACIONES=true`. Nunca active seeds en
producción sin aprobación.

`pnpm db:reset` borra y recrea las bases mediante `prisma migrate reset`; no
ejecute este comando en datos compartidos o de producción. No borra volúmenes
Docker.

## Seguridad por defecto

- Guard global en gateway y servicios que **deniega todo** salvo lo marcado con
  `@Public()` (`/health`; `login` y `refresh` se enrutan por el proxy del gateway).
  `ms-auth` expone `POST /auth/login` y `POST /auth/refresh` como placeholders
  públicos (responden `501` hasta implementar la lógica de autenticación).
- Decorador `@RequirePermission('modulo:accion')` creado; la verificación efectiva
  de permisos queda marcada con `TODO(RBAC)`.
- `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`.
- `helmet` habilitado y CORS restringido por `CORS_ORIGIN`.
- Rate limit con `@nestjs/throttler` en el gateway (`THROTTLE_TTL`, `THROTTLE_LIMIT`).
- JWT RS256 verificado con clave pública (`JWT_PUBLIC_KEY`, `JWT_KID`,
  `JWT_ISSUER`, `JWT_AUDIENCE`).
- Sin credenciales ni llaves hardcodeadas: todo se inyecta por variables de entorno.

## Base de datos

Cada servicio tiene su propio `schema.prisma` y su propia base de datos (`db_auth`,
`db_personal`, `db_vacaciones`, `db_contratos`, `db_planillas`). El script
`docker/init-scripts/01-create-databases.sh` crea un rol owner para migraciones y
un rol app de runtime por base al inicializar PostgreSQL. Las decisiones y
contraseñas placeholder están documentadas en
[`docs/db/decisiones-bd.md`](docs/db/decisiones-bd.md).

Use los scripts raíz para mantener las URLs de cada servicio separadas:

```bash
corepack pnpm prisma:validate
corepack pnpm prisma:generate
corepack pnpm db:migrate:all
corepack pnpm db:seed:all
```

`db:migrate:all` ejecuta únicamente `prisma migrate deploy` sobre migraciones
existentes; no usa `migrate dev` ni `db push`, y no genera migraciones. `db:reset`
es destructivo, exige confirmación interactiva y no debe usarse con datos
compartidos o de producción.

## Convenciones de ramas y PR

- Ramas: `feature/<ID-historia>-descripcion` (ej. `feature/HU-012-gestion-vacaciones`).
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`...).
- Cada Pull Request debe incluir al menos **una revisión aprobada** y completar el
  checklist del DoD en `.github/pull_request_template.md`.
- La rama base es `main`; los cambios llegan por PR, no por push directo.

## CI

`.github/workflows/ci.yml` ejecuta en cada push/PR a `main` y `develop`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm build`
4. `pnpm test`
5. `prisma validate` en cada servicio
6. `pnpm audit --prod`
7. Gitleaks para detección de secretos

## Documentación

- `docs/api/` — contratos y especificaciones de API.
- `docs/adr/` — Architecture Decision Records.
- `docs/spikes/` — investigaciones técnicas.
- `docs/db/` — decisiones de base de datos.
- `docs/db/diccionario-<servicio>.md` y `docs/db/mer-<servicio>.md` — documentos generados desde DMMF.
- `docs/adr/ADR-002-mensajeria.md` — decisión de mensajería.
