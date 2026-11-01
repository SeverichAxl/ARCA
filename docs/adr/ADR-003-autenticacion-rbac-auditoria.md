# ADR-003: Autenticación, autorización RBAC y auditoría

Estado: Propuesto · Fecha: 2026-11-01 · Responsable: Arquitecto de Software

## 1. Contexto

HU-01 y HU-03 / RF-01 a RF-04 requieren controlar sesiones y operaciones de
usuarios; HU-02 / RF-05 requiere trazabilidad de auditoría. El diseño debe
limitar el acceso por permiso y por propiedad del objeto, impedir que una
cuenta con acceso al gateway alcance datos de otro funcionario y conservar
eventos de auditoría sin alteraciones.

El seed de `ms-auth` define actualmente siete roles y 38 permisos. Es la fuente
de verdad de la matriz. Esto no significa que el flujo de login, refresh ni
toda la autorización ya funcionen: ambos endpoints responden 501 y los guards
aún no verifican los permisos.

## 2. Decisión

- Emitir access tokens JWT firmados con RS256, con `kid` en el encabezado y
  validar firma, algoritmo, `iss`, `aud` y `exp`.
- Usar refresh tokens opacos, guardar únicamente su hash, rotarlos y revocar la
  familia si se presenta un token sustituido.
- Aplicar bloqueo temporal después de tres intentos fallidos durante 15
  minutos; mantenerlo distinto del estado `BLOQUEADO`, reservado al bloqueo
  manual.
- Mantener siete roles y 38 permisos en BD. La matriz y las asignaciones del
  seed son la fuente de verdad; no se codifica autorización por nombre de rol.
- Implementar guards que denieguen por defecto y que exijan el permiso
  explícito requerido por cada operación.
- Firmar con HMAC las cabeceras internas de identidad y permisos, y validarlas
  en cada servicio.
- Cada servicio comprobará además la propiedad del objeto. Si el recurso
  pertenece a otro actor o ámbito, responderá `404`, sin revelar su existencia.
- Hacer la auditoría de solo inserción mediante `REVOKE` y triggers. Enmascarar
  CI, remuneración, contraseñas y tokens antes de persistir o publicar el
  payload.

## 3. Alternativas consideradas

1. **Sesiones de servidor:** descartadas para este diseño porque requieren
   mantener y consultar estado de sesión central en cada servicio; se elige un
   access token verificable y un estado separado para revocar refresh tokens.
2. **Roles fijos en el código:** descartados porque dificultan mantener una
   matriz por operación y contradicen la matriz de permisos que el seed
   administra en BD.
3. **ABAC como modelo principal:** descartado para Sprint 1 porque el contrato
   ya define permisos RBAC y comprobaciones de propiedad como controles
   separados. Atributos como empleado y área se usan en la mediación, no como
   sustituto del permiso.

## 4. Consecuencias

**Positivas**

- La rotación y la detección de reuso limitan el valor de un refresh token
  sustraído.
- Los permisos son identificables y revisables en el seed y en BD.
- La comprobación de propiedad por servicio reduce el riesgo de confiar solo
  en el gateway.
- `REVOKE` y triggers impiden que el usuario de runtime modifique o elimine el
  registro histórico de auditoría.

**Negativas**

- La autorización se implementa en varios puntos y exige mantener coherentes
  gateway y servicios.
- La distribución de claves JWT y HMAC agrega configuración sensible por
  entorno y servicio.
- La política de no revelar recursos ajenos puede hacer más difícil distinguir
  entre un identificador inexistente y uno fuera del ámbito autorizado.
- La auditoría inmutable requiere que la conexión de runtime no tenga
  privilegios de edición y que las operaciones correctivas se diseñen sin
  alterar el historial.

## 5. Estado de implementación

**Implementado:**

- El seed declara siete roles y 38 permisos, actualiza sus asignaciones y es la
  fuente de la matriz. No elimina permisos obsoletos que ya no estén en el
  seed; su retiro requiere una acción explícita.
- El esquema modela hash de refresh token, familia, reemplazo, revocación y
  bloqueo temporal.
- Los guards globales exigen autenticación salvo rutas `@Public()`, y
  verifican JWT RS256. Las migraciones de auth revocan `UPDATE`, `DELETE` y
  `TRUNCATE` sobre `auditoria_log` y crean triggers de inmutabilidad.

**Planificado / pendiente:**

- `POST /auth/login` y `POST /auth/refresh` son placeholders que responden
  501; la emisión de JWT, el `kid`, la rotación y detección de reuso, y el
  bloqueo por intentos no están implementados en esos endpoints.
- Los verificadores no exigen `kid` y configuran `iss` y `aud` solo si existen
  las variables correspondientes.
- La verificación efectiva de `@RequirePermission` en gateway y servicios está
  marcada `TODO(RBAC)`. Tampoco están implementadas la firma HMAC de las
  cabeceras ni la mediación completa de propiedad en todos los servicios.
- No se encontró una cadena de hashes de auditoría implementada. El payload
  enmascarado está especificado en el contrato, pero no hay flujo completo que
  publique acciones auditadas desde todos los servicios.
- Maker-checker para cambios de sueldo y cadena de hashes permanecen
  pendientes, según las decisiones de BD.

## 6. Trazabilidad

- **RF / HU:** HU-01 / RF-01, RF-02 y RF-03; HU-02 / RF-05; HU-03 / RF-04.
- **RNF:** seguridad de autenticación, autorización, protección de datos y
  trazabilidad definidos para la solución.
- **API:** [auth](../api/auth.md), [errores](../api/errores.md),
  [convenciones API](../api/README.md).
- **BD:** [decisiones de BD](../db/decisiones-bd.md),
  [schema de auth](../../services/ms-auth/prisma/schema.prisma),
  [seed de auth](../../services/ms-auth/prisma/seed.ts),
  [migración inicial de auth](../../services/ms-auth/prisma/migrations/20261031095211_init/migration.sql).
- **Otros ADR:** [ADR-002](./ADR-002-mensajeria.md),
  [ADR-006](./ADR-006-proteccion-de-datos-sensibles.md),
  [ADR-007](./ADR-007-privilegios-minimos-y-refuerzos-de-bd.md).
- **Backlog:** [Sprint Backlog 1](../backlog/Sprint_Backlog_1_ARCA.docx.pdf),
  [Product Backlog](../backlog/Product_Backlog_ARCA.docx.pdf).
