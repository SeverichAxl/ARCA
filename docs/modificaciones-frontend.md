# Modificaciones del frontend

## Objetivo

Mejorar la facilidad de uso y la legibilidad del frontend, incluyendo la creación de usuarios y la selección entre tema claro y oscuro.

## Cambios realizados

### Visibilidad de contraseña al crear usuarios

- Se agregó un control para mostrar u ocultar la contraseña inicial en el formulario de creación de usuarios.
- El control conserva el valor escrito y expone etiquetas accesibles que indican la acción disponible.
- Al cerrar correctamente el formulario, se limpia la contraseña y se restablece el control.

### Tema claro y oscuro

- Se agregó un alternador de tema en el encabezado de la aplicación y en la pantalla de inicio de sesión.
- El tema oscuro sigue siendo el predeterminado.
- La preferencia del usuario se guarda en `localStorage` con la clave `arca.theme` y se aplica al documento al cargar la aplicación.
- Se definieron colores para superficies, texto, bordes y estados semánticos en ambos temas.

### Contraste de textos e iconos

- Se reemplazaron colores pastel fijos por tokens semánticos de información, éxito, advertencia y error en componentes de vacaciones, dashboard, planillas, carga de archivos y estados vacíos.
- Se ajustaron los indicadores y gráficos de métricas para que sus iconos, etiquetas y líneas usen colores legibles en ambos temas.
- Se mejoró el contraste del botón de cierre de notificaciones de error.
- Se conservaron los fondos oscuros intencionales del panel de costo de nómina y del panel de marca del inicio de sesión.

## Verificación

- Pruebas del frontend: 125 aprobadas.
- Lint: sin errores ni advertencias.
- Typecheck: correcto.
- Build de producción: correcto.

## Actualizar Docker

Para incluir los cambios en el contenedor, reconstruir y levantar únicamente el frontend:

```powershell
docker compose --profile apps up -d --build --no-deps web-frontend
```
