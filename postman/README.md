# Colección Postman de ARCA

Importa `ARCA Sprint 1 API.postman_collection.json` y ambos archivos de entorno en Postman. Selecciona **ARCA - Local** para Docker local o **ARCA - Demo** después de sustituir `https://demo.example.invalid/api` por el dominio HTTPS autorizado del entorno de demo.

## Uso del flujo de vacaciones

1. Inicia sesión con una cuenta de prueba y conserva su `accessToken` en el entorno. El script de la solicitud Login lo guarda automáticamente si devuelve HTTP 200.
2. Consulta el saldo y crea una solicitud con fechas disponibles. La colección guarda `solicitudId` cuando recibe HTTP 201.
3. Inicia sesión como jefe inmediato para aprobar en el primer nivel.
4. Inicia sesión como RRHH_OPERATIVO para la aprobación final. La aprobación final descuenta el saldo.
5. Para probar una excepción, crea una solicitud con `solicitarExcepcion: true` y justificación usando el contrato de [vacaciones](../docs/api/vacaciones.md), guarda `excepcionId` y resuélvela antes de las aprobaciones.

Usa empleados, solicitudes y credenciales de prueba. No compartas ni versionas entornos exportados con contraseñas o tokens cargados.

## Alcance y disponibilidad

La colección cubre las operaciones necesarias para probar TSK-VAC-101 a TSK-VAC-103 y ejemplos de auth y personal. Los contratos completos se encuentran en [auth](../docs/api/auth.md), [personal](../docs/api/personal.md) y [vacaciones](../docs/api/vacaciones.md).

En el checkout que originó esta colección, `POST /api/auth/login` y `POST /api/auth/refresh` son placeholders que responden 501; los handlers de negocio de personal descritos en el contrato tampoco están disponibles aún. La API de vacaciones implementa saldo, creación de solicitud, aprobaciones, rechazo y resolución de excepciones. Una ruta planificada puede responder 404/501; esa respuesta evidencia que el flujo aún no está disponible, no que la prueba de aceptación haya pasado.

Las URLs no son datos sensibles de aplicación y se mantienen en entornos Postman separados; `.env.example` conserva las variables de configuración de servicios. El cotejo de configuración confirma que todas las variables interpoladas por Docker Compose ya están declaradas allí, por lo que este sprint no requiere agregar nuevas variables de runtime.
