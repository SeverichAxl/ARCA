# ADR-005: TLS en tránsito

Estado: Propuesto · Fecha: 2026-11-01 · Responsable: Arquitecto de Software

## 1. Contexto

RNF-04 establece TLS 1.3 como requisito de transporte y su uso es obligatorio
en producción. La demo local publicada por Docker Compose usa HTTP para el
gateway, frontend y conexiones entre servicios. Esa decisión de conveniencia
local no elimina el requisito: **RNF-04 NO se cumple en local**.

## 2. Decisión

- Exigir TLS 1.3 en los puntos de entrada y conexiones de producción que
  transporten datos de ARCA.
- No declarar conforme la demo local mientras se ejecute en HTTP.
- Para habilitar HTTPS local, considerar un proxy inverso Caddy o Traefik y
  certificados de desarrollo generados con `mkcert`; no tratar los
  certificados de desarrollo como configuración de producción.

## 3. Alternativas consideradas

1. **Aceptar HTTP también en producción:** descartado porque incumple RNF-04.
2. **Instalar Caddy o Traefik con `mkcert` para la demo local:** no seleccionado
   para Sprint 1; añade proxy, gestión de certificados de confianza local y
   configuración adicional a una demo que hoy usa HTTP. Se mantiene como
   alternativa para cerrar la brecha local.
3. **Terminar TLS solo en el navegador y usar HTTP entre servicios en
   producción:** descartado como decisión general porque deja sin protección
   el tráfico interno; la arquitectura de despliegue deberá definir también
   esos enlaces.

## 4. Consecuencias

**Positivas**

- El requisito de cifrado en producción queda explícito y no se confunde con
  el comportamiento actual de la demo.
- La alternativa de proxy permite habilitar HTTPS local sin integrar
  certificados de desarrollo en las imágenes de aplicación.

**Negativas**

- La demo local transmite por HTTP y, por tanto, no satisface RNF-04.
- La terminación TLS en producción requiere certificados, renovación,
  configuración del proxy o balanceador y verificación de todos los enlaces
  de red relevantes.
- HTTPS local con `mkcert` introduce un paso de confianza del certificado en
  cada máquina de desarrollo.

## 5. Estado de implementación

**Implementado:** el Compose expone el gateway en HTTP y el proxy de la
aplicación selecciona transporte HTTP o HTTPS de acuerdo con el esquema de la
URL del servicio.

**Planificado / pendiente:** TLS 1.3 y certificados para producción; no hay una
configuración de terminación TLS en el Compose actual. La opción de Caddy o
Traefik con `mkcert` para la demo local no está implementada. **RNF-04 NO se
cumple en la demo local.**

## 6. Trazabilidad

- **RF / HU:** requisito transversal a las historias que envían credenciales,
  datos personales o información laboral.
- **RNF:** RNF-04.
- **API:** [auth](../api/auth.md),
  [convenciones de seguridad de API](../api/README.md).
- **BD:** [decisiones de BD](../db/decisiones-bd.md) registra TLS como
  pendiente para producción y HTTP para la demo local.
- **Otros ADR:** [ADR-001](./ADR-001-microservicios-y-hexagonal.md),
  [ADR-003](./ADR-003-autenticacion-rbac-auditoria.md).
- **Despliegue:** [docker-compose.yml](../../docker-compose.yml),
  [Plan de implementación](../backlog/Plan%20de%20implementaci%C3%B3n%20%E2%80%93%20Sistema%20de%20Gesti%C3%B3n%20Humana%20ARCA%20Ltda%20.docx.pdf).
