# Docker en desarrollo

## Día a día: infraestructura en Docker y aplicaciones locales

Para evitar reconstruir las imágenes de las aplicaciones durante el trabajo normal:

```powershell
pnpm infra:up
pnpm dev
```

PostgreSQL y RabbitMQ se ejecutan en Docker; los servicios NestJS y Next.js se ejecutan en el equipo local. Detén la infraestructura con `docker compose stop postgres rabbitmq rabbitmq-init` cuando no la necesites. Los datos se conservan en los volúmenes.

## Build y ejecución completa

Construye las dos imágenes secuencialmente y luego inicia las aplicaciones:

```powershell
pnpm apps:build
pnpm infra:up
pnpm apps:up
```

`apps:build` construye una vez la imagen compartida de backend y después la imagen del frontend. Las aplicaciones están en el perfil `apps`; PostgreSQL, RabbitMQ y su inicializador no usan perfil.

Para detener el stack:

```powershell
pnpm apps:down
```

Este comando no elimina volúmenes. La imagen de backend contiene los seis procesos y es más grande que la imagen de un servicio individual, pero Docker almacena una sola copia compartida en lugar de seis imágenes separadas.

`NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_AUTH_API_URL` y `NEXT_PUBLIC_API_URL` se pasan como argumentos de build de la imagen frontend. Las variables `NEXT_PUBLIC_*` quedan incorporadas en el resultado de Next.js y un cambio requiere reconstruir la imagen; no se pueden cambiar solo con variables de runtime. El código actual usa `NEXT_PUBLIC_AUTH_MODE` y `NEXT_PUBLIC_AUTH_API_URL`. `NEXT_PUBLIC_API_URL` no está referenciada actualmente en el código del frontend.

El servicio `ms-personal` guarda por defecto firmas y documentos en el volumen Docker `personal-files`, montado en `/app/storage/personal`. El directorio pertenece al usuario no root de la imagen; no elimines ese volumen si necesitas conservar esos archivos.

## Flujo diario sin reconstruir imágenes

Si las imágenes ya están construidas, levanta el stack sin recompilar:

```powershell
pnpm apps:up:demo
```

`apps:up:demo` ejecuta `docker compose --profile apps up -d --no-build` y usa `arca-backend:local` y `arca-web-frontend:local`. Para validar otras etiquetas sin reemplazar las locales, define `ARCA_BACKEND_IMAGE` y `ARCA_FRONTEND_IMAGE` antes del comando. Para desarrollo con recarga en caliente, `pnpm infra:up` + `pnpm dev` (o `pnpm dev:all` para los seis procesos backend) evita reconstruir imágenes.

## Rendimiento de los builds

### Entorno de referencia

Medido con Docker Desktop en Windows, **4 vCPU y ~6,2 GB de RAM** para el motor Linux, disco `D:` y red de ~16 MB/s. Con menos de **6 vCPU u 8 GB de RAM**, construye una imagen a la vez. `pnpm apps:build` ya encadena backend y frontend secuencialmente; no los paralelices en ese entorno.

### Antes y después

| Escenario | Antes | Después | Mejora |
|---|---:|---:|---:|
| Backend: cambio en un servicio | 147,5 s | **51,3 s** | **-65 %** |
| Backend: sin cambios (todo cacheado) | — | **19,0 s** | — |
| Frontend: cambio en una página | 311,3 s | **272,7 s** | **-12 %** |
| `pnpm apps:build` con caché caliente | — | **44,1 s** | — |
| Backend: build limpio (`--no-cache`) | 819,6 s | no concluyente¹ | — |
| Frontend: build limpio (`--no-cache`) | 784,1 s | no concluyente² | — |

¹ El build limpio del backend se interrumpió ~8 h por una suspensión del equipo; los pasos de compilación medidos no son comparables. Los pasos que sí se midieron bajaron: `base` 150,8 → 72,6 s y `deps install` 254,3 → 173,3 s.
² El build limpio del frontend coincidió con una caída de red: `apt`/`corepack`/`pnpm` tardaron 2-3 veces más que en la medición base. La etapa de Next.js fue similar (333 s vs 323 s) y el incremento no se debió a los cambios del Dockerfile.

Los builds limpios siguen siendo útiles para reproducir un problema, pero no representan el flujo diario: `--no-cache` no reutiliza los cache mounts y vuelve a descargar todo.

### Qué cambió

- `docker/Dockerfile.service`
  - La etapa `deps` copia solo manifiestos y ejecuta `pnpm install --filter '!web-frontend'`; el backend ya no descarga Next/React/Radix/Recharts.
  - Se eliminó `python3 make g++` de `deps`: `argon2` usa su prebuild y no compila.
  - Cada servicio tiene su rama `gen-<servicio>` / `build-<servicio>`. Un cambio en `services/ms-auth/src` solo recompila `ms-auth`; Prisma y los demás servicios quedan cacheados.
  - El runtime copia los `dist` y `prisma` por servicio. Un `COPY` marcador fuerza a completar `deps` antes del install de producción y se usa `--prefer-offline` para tolerar un store incompleto.
- `docker/Dockerfile.frontend`
  - Cache mounts para `apt`, `corepack` y `.next/cache`; este último acelera el webpack de los rebuilds.
  - `NEXT_TELEMETRY_DISABLED=1` y `NODE_OPTIONS=--max-old-space-size=4096`.
  - `DOCKER_FAST_BUILD=1` omite la comprobación de tipos **solo** en Docker; CI sigue ejecutando `pnpm lint` y `pnpm build` sin esa variable.
- `docker-compose.yml`: las etiquetas de imagen son parametrizables (`ARCA_BACKEND_IMAGE`, `ARCA_FRONTEND_IMAGE`) y el build del frontend recibe `DOCKER_FAST_BUILD` (1 por defecto).
- `package.json`: `dev:all` y `apps:up:demo`.
- `scripts/docker-timing.mjs` / `.ps1`: resumen de tiempos a partir de `--progress=plain`.

### Caché y limpieza

Los cache mounts (`pnpm-store`, `apt-archives`, `apt-lists`, `corepack`, `next-cache`) son la razón principal de la mejora incremental. No los borres con `docker builder prune -af` como rutina: el siguiente build paga otra vez la descarga y la compilación. BuildKit aplica su política de recolección; si necesitas acotar el espacio, configura una política GC con `keepStorage`/`defaultKeepStorage` (por ejemplo, 30-50 GB) en lugar de vaciarla a mano. `docker system prune` también elimina imágenes y contenedores; no lo uses para “limpiar” entre builds.

`docker compose down` conserva los volúmenes; `docker compose down -v` los elimina. No uses `down -v` si necesitas conservar PostgreSQL, RabbitMQ o `personal-files`.

### Notas de verificación

- Node local: 24.15.0; CI: 20; imágenes: 22.23.4. La diferencia no la introduce este cambio.
- Prisma genera el cliente por servicio en `services/<servicio>/prisma/generated/client`. El código importa esa ruta, no `@prisma/client`; ambos reportan 6.19.3 en la imagen.
- Las imágenes no contienen archivos `.env` (verificado con `find /app -name '.env*'`).

## Limpieza de espacio

Estos comandos eliminan cachés de build o imágenes no utilizadas y pueden hacer más lento el siguiente build:

```powershell
docker builder prune -af
docker image prune -f
```

No uses `docker system prune --volumes` ni `docker compose down -v`: pueden borrar volúmenes con los datos de PostgreSQL o RabbitMQ. No limpies volúmenes como método para recuperar espacio sin confirmar antes que sus datos ya no se necesitan.

## Disco virtual de WSL2

Docker Desktop guarda imágenes, cachés y volúmenes en un disco virtual WSL2. Configura **Settings → Resources → Advanced → Disk image location** para ubicarlo en una unidad con espacio suficiente. No muevas el archivo `.vhdx` manualmente.

Para compactar el disco virtual cuando Docker Desktop ya no lo esté usando:

1. Sal de Docker Desktop y cierra las aplicaciones que usan WSL.
2. En PowerShell ejecuta `wsl --shutdown`.
3. En una terminal de PowerShell elevada, si está disponible el módulo Hyper-V, ejecuta:

   ```powershell
   Optimize-VHD -Path 'D:\DockerData\DockerDesktopWSL\disk\docker_data.vhdx' -Mode Quick
   ```

   Reemplaza la ruta por la ubicación real del disco de Docker Desktop. Alternativamente, desde `diskpart`, selecciona el archivo correcto y usa `compact vdisk`:

   ```text
   select vdisk file="D:\DockerData\DockerDesktopWSL\disk\docker_data.vhdx"
   compact vdisk
   exit
   ```

   Usa solo uno de los métodos y confirma la ruta antes de compactar.

## Límites de memoria WSL2

Puedes limitar memoria, CPU y swap desde `%UserProfile%\.wslconfig`. Ajusta los valores según la RAM disponible en tu equipo:

```ini
[wsl2]
memory=8GB
processors=4
swap=4GB
```

Después de cambiar este archivo, ejecuta `wsl --shutdown` para aplicar la configuración al siguiente inicio de WSL.

## Ubicación del repositorio

Mantén el repositorio fuera de OneDrive y de otras carpetas sincronizadas. La sincronización de muchos archivos pequeños (incluido `node_modules`) puede ralentizar la transferencia del contexto y los builds. En Windows, usa una ruta local como `D:\proyectos\arco`.
