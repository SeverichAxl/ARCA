# Migraciones de Contratos y Planillas (TSK-ARQ-202)

Las bases `db_contratos` y `db_planillas` son aisladas. Cada servicio es el
único dueño de su esquema y credenciales; no comparta URLs ni use una URL de
runtime como usuario migrador.

## Aplicar y verificar

Con PostgreSQL local iniciado y `.env` configurado, ejecute desde la raíz en
PowerShell:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^(CONTRATOS_DATABASE_URL|CONTRATOS_DIRECT_URL|PLANILLAS_DATABASE_URL|PLANILLAS_DIRECT_URL)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}

$env:DATABASE_URL = $env:CONTRATOS_DATABASE_URL.Replace('@postgres:5432', '@localhost:55432')
$env:DIRECT_URL = $env:CONTRATOS_DIRECT_URL.Replace('@postgres:5432', '@localhost:55432')
corepack pnpm --filter ms-contratos exec prisma migrate deploy
corepack pnpm --filter ms-contratos exec prisma migrate status

$env:DATABASE_URL = $env:PLANILLAS_DATABASE_URL.Replace('@postgres:5432', '@localhost:55432')
$env:DIRECT_URL = $env:PLANILLAS_DIRECT_URL.Replace('@postgres:5432', '@localhost:55432')
corepack pnpm --filter ms-planillas exec prisma migrate deploy
corepack pnpm --filter ms-planillas exec prisma migrate status
```

`migrate deploy` aplica únicamente migraciones versionadas; `generate` solo
genera el cliente y no cambia la base de datos. No cambie de servicio entre
asignar las variables y ejecutar su migración. Confirme el destino antes del
despliegue y tome un backup recuperable.

## Rollback y recuperación

Prisma no genera migraciones `down`; no edite ni elimine migraciones ya aplicadas
y no use `migrate reset` sobre datos que quiera conservar. Las migraciones de
Sprint 2 son aditivas. Si una versión necesita retirarse:

1. Detenga los despliegues del servicio afectado y conserve los logs de Prisma.
2. Si el despliegue no terminó, verifique `prisma migrate status`; resuelva una
   migración fallida solo después de comprobar el estado de cada objeto en la
   base.
3. Si la migración ya se aplicó, preferir una migración correctiva hacia
   adelante. Si se requiere volver exactamente al estado previo, restaure el
   backup probado de **esa base aislada** y coordine la recuperación de datos
   escritos desde el backup.
4. Verifique nuevamente `prisma migrate status`, health check del servicio y
   conteos/consultas de negocio antes de reabrir tráfico.

No ejecutar `DROP DATABASE`, `migrate reset` ni SQL destructivo como rollback
automático. El refuerzo opcional de inmutabilidad de planillas está fuera del
historial Prisma; su reversión documentada está en
`services/ms-planillas/prisma/migrations-extra/README.md`.

## Semillas de demo

La creación de usuarios pertenece a ms-auth; los servicios de contratos y
planillas no duplican usuarios ni credenciales. Para parámetros de demo de
planillas, generar primero un usuario/sistema en ms-auth y, en la misma ventana
de PowerShell, configurar:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^(PLANILLAS_DATABASE_URL|PLANILLAS_DIRECT_URL)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}

$env:DATABASE_URL = $env:PLANILLAS_DATABASE_URL.Replace('@postgres:5432', '@localhost:55432')
$env:DIRECT_URL = $env:PLANILLAS_DIRECT_URL.Replace('@postgres:5432', '@localhost:55432')
$env:RUN_SEED = 'true'
$env:SEED_ACTOR_ID = '<UUID existente de ms-auth>'
corepack pnpm --filter ms-planillas prisma:seed
```

El seed es repetible y no sobrescribe parámetros ya existentes. La escala de
bono se crea inactiva hasta que se apruebe su parametrización; los valores de
referencia del backlog no constituyen asesoría normativa.
