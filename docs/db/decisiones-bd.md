# Decisiones de base de datos

Este documento registra las decisiones de persistencia del Sistema de Gestión Humana
ARCA Ltda. Los valores de contraseña aquí listados son **placeholders** y deben
reemplazarse en el archivo `.env` real (nunca versionado).

## Motor y topología

- Motor: PostgreSQL 16.
- Patrón: una base de datos por microservicio (database-per-service).
- No se permiten joins ni claves foráneas entre bases de datos de distintos servicios.
- La comunicación entre servicios se realiza por eventos (RabbitMQ) y API del gateway.

## Bases de datos y propietarios

| Servicio        | Base de datos     | Rol propietario    | Contraseña (placeholder)          |
| --------------- | ----------------- | ------------------ | --------------------------------- |
| Administración  | `postgres`        | `arca_admin`       | `change_me_postgres_admin`        |
| `ms-auth`       | `arca_auth`       | `arca_auth`        | `change_me_auth_db_password`      |
| `ms-personal`   | `arca_personal`   | `arca_personal`    | `change_me_personal_db_password`  |
| `ms-vacaciones` | `arca_vacaciones` | `arca_vacaciones`  | `change_me_vacaciones_db_password`|
| `ms-contratos`  | `arca_contratos`  | `arca_contratos`   | `change_me_contratos_db_password` |
| `ms-planillas`  | `arca_planillas`  | `arca_planillas`   | `change_me_planillas_db_password` |

Las variables de conexión se declaran por servicio en `.env.example`:

- `AUTH_DATABASE_URL` / `AUTH_DIRECT_URL`
- `PERSONAL_DATABASE_URL` / `PERSONAL_DIRECT_URL`
- `VACACIONES_DATABASE_URL` / `VACACIONES_DIRECT_URL`
- `CONTRATOS_DATABASE_URL` / `CONTRATOS_DIRECT_URL`
- `PLANILLAS_DATABASE_URL` / `PLANILLAS_DIRECT_URL`

`DATABASE_URL` se usa para la conexión en tiempo de ejecución (pooler) y `DIRECT_URL`
para tareas administrativas y migraciones.

## Migraciones

- Las migraciones se gestionan con Prisma Migrate y se versionan en cada servicio.
- La carpeta `prisma/migrations-extra/` queda reservada para SQL adicional no generado
  por Prisma (extensiones, índices especializados, triggers de auditoría).
- Este repositorio no crea ni ejecuta migraciones automáticamente: solo `prisma validate`
  y `prisma generate`.

## Seguridad y datos sensibles

- Los datos personales sensibles se cifran en reposo a nivel de aplicación con
  AES-256-GCM (`packages/crypto-utils`), usando una llave de 32 bytes por servicio
  (`ENC_KEY_*`).
- Los identificadores de integridad se firman con HMAC-SHA256 (`CI_HMAC_KEY`).
- Las credenciales de base de datos, RabbitMQ, JWT y Cloudinary se inyectan por
  variables de entorno; no se admiten valores hardcodeados en el código.
- Las escrituras deben registrar auditoría con el evento `AUDITORIA_REGISTRADA`.
