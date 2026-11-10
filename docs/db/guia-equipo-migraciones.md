# Guía para actualizar las bases de Contratos y Planillas

Esta guía es para aplicar en las bases locales las migraciones versionadas de
`ms-contratos` y `ms-planillas`. Cada servicio administra su propia base de
datos; no intercambies sus URLs ni ejecutes una migración contra una base de
otro servicio.

## Requisitos

- Estar en la raíz del repositorio y en la rama que contiene las migraciones.
- Tener Docker Desktop y Node.js 20 o superior instalados.
- Tener un `.env` local configurado. No compartas ese archivo ni publiques sus
  credenciales.
- Antes de migrar una base con datos importantes, confirma que las URLs apuntan
  al destino correcto y crea un backup recuperable.

## Preparar el entorno local

En PowerShell, desde la raíz del repositorio:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm infra:up
```

`infra:up` inicia PostgreSQL y RabbitMQ. Los comandos siguientes asumen que
PostgreSQL está publicado en `localhost:55432`, como en la configuración local
de Docker Compose del repositorio.

## Aplicar y verificar las migraciones

Ejecuta el bloque completo en la misma ventana de PowerShell:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^(CONTRATOS_DATABASE_URL|CONTRATOS_DIRECT_URL|PLANILLAS_DATABASE_URL|PLANILLAS_DIRECT_URL)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}

if (-not $env:CONTRATOS_DATABASE_URL -or -not $env:CONTRATOS_DIRECT_URL -or
    -not $env:PLANILLAS_DATABASE_URL -or -not $env:PLANILLAS_DIRECT_URL) {
  throw 'Faltan URLs de migración requeridas en .env.'
}

$env:DATABASE_URL = $env:CONTRATOS_DATABASE_URL.Replace('@postgres:5432', '@localhost:55432')
$env:DIRECT_URL = $env:CONTRATOS_DIRECT_URL.Replace('@postgres:5432', '@localhost:55432')
corepack pnpm --filter ms-contratos exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Falló migrate deploy para ms-contratos.' }
corepack pnpm --filter ms-contratos exec prisma migrate status
if ($LASTEXITCODE -ne 0) { throw 'Falló migrate status para ms-contratos.' }

$env:DATABASE_URL = $env:PLANILLAS_DATABASE_URL.Replace('@postgres:5432', '@localhost:55432')
$env:DIRECT_URL = $env:PLANILLAS_DIRECT_URL.Replace('@postgres:5432', '@localhost:55432')
corepack pnpm --filter ms-planillas exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw 'Falló migrate deploy para ms-planillas.' }
corepack pnpm --filter ms-planillas exec prisma migrate status
if ($LASTEXITCODE -ne 0) { throw 'Falló migrate status para ms-planillas.' }
```

Para cada servicio, confirma que Prisma muestra `Database schema is up to date!`.
Si tu PostgreSQL no usa el puerto `55432`, cambia `localhost:55432` por el host
y puerto configurados para tu entorno.

## Precauciones

- `prisma migrate deploy` aplica las migraciones versionadas que estén
  pendientes. `prisma generate` solo genera el cliente y no actualiza la base.
- No uses `prisma migrate reset` en una base con datos que quieras conservar.
- No edites ni elimines migraciones que ya fueron aplicadas.
- Prisma no genera migraciones `down`; para revertir un cambio, usa una
  migración correctiva hacia adelante o sigue el procedimiento de recuperación
  y backup de [migraciones-sprint2.md](./migraciones-sprint2.md).

La aplicación de migraciones no inicia los servicios de la aplicación. Para
levantar el stack local después, consulta [docs/docker.md](../docker.md).
