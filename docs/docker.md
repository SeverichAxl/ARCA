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
