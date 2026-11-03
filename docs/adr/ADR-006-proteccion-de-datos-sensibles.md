# ADR-006: Protección de datos sensibles

Estado: Aceptado · Fecha: 2026-11-01 · Responsable: Arquitecto de Software

## 1. Contexto

HU-04 a HU-08 / RF-06 a RF-10 incluyen CI, remuneración, historial laboral,
finiquito y firmas. Los datos personales no deben replicarse en eventos si el
consumidor no los necesita. La autorización para ver sueldos debe mantenerse
separada de la autorización para ver el expediente. RNF-05 contempla el
volumen aproximado de 200 empleados y permite valorar el coste de descifrar en
la aplicación.

## 2. Decisión

- Cifrar los datos sensibles almacenados con AES-256-GCM y un IV aleatorio por
  valor; usar llaves distintas por servicio.
- Calcular `ci_hash` con HMAC para unicidad y búsqueda exacta por CI
  normalizada. No ofrecer búsquedas parciales del CI.
- Enmascarar recursivamente los payloads de auditoría antes de persistirlos o
  publicarlos; no incluir CI ni sueldo en los eventos de empleado.
- Guardar el identificador público de Cloudinary, no una URL permanente.
  Generar URLs firmadas y de corta duración cuando se solicite el archivo.
- Aceptar que la remuneración cifrada no puede filtrarse, ordenarse ni
  agregarse en SQL. El dashboard la descifrará en la aplicación; esto se
  considera aceptable para el volumen aproximado de 200 empleados.

## 3. Alternativas consideradas

1. **Guardar CI y remuneración en claro con controles de acceso a la API:**
   descartado porque la base de datos, las copias y los registros ampliarían la
   exposición de esos valores.
2. **Cifrar CI sin un hash de búsqueda:** descartado porque impediría comprobar
   unicidad y localizar un CI exacto sin descifrar los registros.
3. **Usar una llave común para todos los servicios:** descartado porque una
   filtración de un servicio expondría también los datos cifrados de los demás.
4. **Guardar URLs permanentes de archivos:** descartado porque un enlace
   duradero podría reutilizarse fuera de una solicitud autorizada.

## 4. Consecuencias

**Positivas**

- El CI puede buscarse por igualdad exacta sin almacenar su valor en claro.
- Las llaves separadas limitan el alcance de una exposición entre servicios.
- Los eventos de empleado pueden actualizar referencias sin transportar CI ni
  datos salariales.
- Las URLs temporales evitan mantener una URL pública permanente del archivo.

**Negativas**

- La aplicación debe administrar y proteger varias llaves y las operaciones de
  lectura requieren descifrado controlado.
- La remuneración cifrada no es filtrable, ordenable ni agregable en SQL; el
  dashboard debe descifrarla en la aplicación y operar sobre los datos
  recuperados.
- La búsqueda por CI solo admite coincidencia exacta y depende de la custodia
  de la llave HMAC.
- El enmascarado debe aplicarse a todas las rutas de auditoría y no solo al
  contrato del evento.

## 5. Estado de implementación

**Implementado:** `@arca/crypto-utils` implementa AES-256-GCM con IV aleatorio,
HMAC-SHA256 y SHA-256. El schema de personal guarda CI y remuneración cifrados,
un `ci_hash` único y el `firmaPublicId`; la copia local de vacaciones y los
eventos de empleado no contienen CI ni sueldo. El contrato de API exige
enmascarar CI, remuneración, contraseñas y tokens.

**Planificado / pendiente:** completar el flujo de escritura/lectura de
negocio, la administración efectiva de llaves separadas por cada servicio, el
enmascarado en todos los productores de auditoría y la generación de URLs
firmadas de corta duración. El descifrado del dashboard no está implementado
en la lógica de negocio actual.

## 6. Trazabilidad

- **RF / HU:** HU-04 a HU-08 / RF-06 a RF-10; HU-02 / RF-05 para auditoría.
- **RNF:** RNF-05 (operación con el volumen aproximado documentado).
- **API:** [personal](../api/personal.md), [eventos](../api/eventos.md),
  [auth y auditoría](../api/auth.md).
- **BD:** [decisiones de BD](../db/decisiones-bd.md),
  [mejoras pendientes](../db/mejoras-pendientes.md),
  [schema de personal](../../services/ms-personal/prisma/schema.prisma).
- **Código:** [crypto-utils](../../packages/crypto-utils/src/index.ts),
  [DTOs de eventos](../../packages/common-dtos/src/index.ts).
- **Otros ADR:** [ADR-002](./ADR-002-mensajeria.md),
  [ADR-003](./ADR-003-autenticacion-rbac-auditoria.md).
