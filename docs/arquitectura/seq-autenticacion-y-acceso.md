# Secuencia - Autenticación, acceso y refresh

Esta secuencia reúne el login, una petición protegida y la rotación del refresh
token. El login aplica rate limiting, verificación Argon2id y bloqueo temporal;
emite un access RS256 y un refresh opaco guardado como hash. En una petición
protegida, el gateway verifica el JWT con la clave pública local y falla cerrado,
comprueba el permiso y firma las cabeceras internas; el servicio verifica la
firma y la propiedad del objeto. El refresh rota y detecta el reuso revocando la
familia. Hoy login y refresh responden 501; la emisión, el bloqueo, la rotación
y el HMAC están planificados.

## Diagrama

```mermaid
sequenceDiagram
    autonumber
    actor USR as Usuario
    participant FE as Frontend Next.js
    participant GW as API Gateway
    participant AUTH as ms-auth
    participant DB as db_auth
    participant SVC as Servicio de negocio

    Note over FE,AUTH: Hoy POST /auth/login y POST /auth/refresh responden 501. El esquema y el seed existen. La emisión, el bloqueo, la rotación y el HMAC están planificados.

    USR->>FE: Ingresa usuario y contraseña
    FE->>GW: POST /api/auth/login
    GW->>GW: Aplica rate limit por IP
    Note over GW: Rate limit por cuenta - planificado
    GW->>AUTH: POST /auth/login
    AUTH->>DB: Busca Usuario por username
    alt Cuenta con bloqueo temporal vigente
        AUTH-->>GW: 423 AUTH_ACCOUNT_LOCKED
        GW-->>FE: 423 Cuenta bloqueada temporalmente
    else Cuenta sin bloqueo vigente
        AUTH->>AUTH: Verifica Argon2id - planificado
        alt Credenciales inválidas
            AUTH->>DB: Incrementa intentosFallidos - planificado
            AUTH-->>GW: 401 AUTH_INVALID_CREDENTIALS
            GW-->>FE: 401 Credenciales inválidas
            FE-->>USR: Mensaje genérico
        else Credenciales válidas
            AUTH->>AUTH: Emite access token RS256 con kid, iss, aud y exp - planificado
            AUTH->>DB: Guarda hash SHA-256 del refresh opaco y familyId - planificado
            AUTH-->>GW: 200 accessToken y refreshToken
            GW-->>FE: 200 accessToken y refreshToken
            FE-->>USR: Sesión iniciada
        end
    end
    Note over AUTH: Tras MAX_FAILED_LOGIN_ATTEMPTS fallos se fija bloqueadoHasta por LOGIN_LOCK_MINUTES - planificado.

    Note over FE,SVC: Petición protegida a un recurso de negocio.
    FE->>GW: GET /api/personal/employees/:id con Bearer access
    GW->>GW: Verifica firma RS256 con la clave pública local y falla cerrado
    alt Token inválido o expirado
        GW-->>FE: 401 AUTH_TOKEN_INVALID o AUTH_TOKEN_EXPIRED
    else Token válido
        GW->>GW: Comprueba permiso personal:read - planificado, TODO RBAC
        alt Permiso ausente
            GW-->>FE: 403 FORBIDDEN
        else Permiso presente
            GW->>GW: Firma cabeceras internas con HMAC - planificado
            GW->>SVC: Reenvía X-User-Id, X-Empleado-Id, X-Rol, X-Permisos, X-Timestamp y X-Internal-Signature
            SVC->>SVC: Verifica firma HMAC y tolerancia de 60 segundos - planificado
            SVC->>SVC: Verifica propiedad del objeto - planificado
            alt Objeto ajeno o fuera de ámbito
                SVC-->>GW: 404 NOT_FOUND
                GW-->>FE: 404 NOT_FOUND
            else Objeto propio o dentro del ámbito
                SVC-->>GW: 200 con los datos autorizados
                GW-->>FE: 200 con los datos autorizados
                FE-->>USR: Muestra el recurso
            end
        end
    end
    Note over SVC: Hoy cada servicio verifica el JWT RS256 con su guard. La firma HMAC y la mediación de propiedad están planificadas.

    Note over FE,AUTH: Rotación del refresh token.
    FE->>GW: POST /api/auth/refresh con refreshToken
    GW->>AUTH: POST /auth/refresh
    AUTH->>DB: Busca el hash SHA-256 del refresh presentado
    alt Token inexistente, vencido o revocado
        AUTH-->>GW: 401 AUTH_REFRESH_INVALID
        GW-->>FE: 401 AUTH_REFRESH_INVALID
    else Token ya reemplazado
        AUTH->>DB: Revoca toda la familia - planificado
        AUTH-->>GW: 401 AUTH_REFRESH_REUSED
        GW-->>FE: 401 AUTH_REFRESH_REUSED
        FE-->>USR: Debe iniciar sesión de nuevo
    else Token vigente
        AUTH->>DB: Marca reemplazadoPor y crea el nuevo refresh - planificado
        AUTH->>AUTH: Emite un nuevo access RS256 - planificado
        AUTH-->>GW: 200 nuevos tokens
        GW-->>FE: 200 nuevos tokens
    end
```

## Decisiones relacionadas

- [ADR-002 - Mensajería con RabbitMQ y Outbox](../adr/ADR-002-mensajeria.md)
- [ADR-003 - Autenticación, RBAC y auditoría](../adr/ADR-003-autenticacion-rbac-auditoria.md)
- [ADR-005 - TLS en tránsito](../adr/ADR-005-tls-en-transito.md)
- [ADR-006 - Protección de datos sensibles](../adr/ADR-006-proteccion-de-datos-sensibles.md)
- [ADR-007 - Privilegios mínimos y refuerzos de BD](../adr/ADR-007-privilegios-minimos-y-refuerzos-de-bd.md)

## Estado

**Implementado:** `JwtAuthGuard` y verificación RS256 en gateway y servicios;
rate limit global por IP con `@nestjs/throttler`; esquema `db_auth` con
`Usuario`, `Rol`, `Permiso`, `RefreshToken` y `AuditoriaLog`; seed de siete
roles y 38 permisos; auditoría inmutable con `REVOKE` y triggers.

**Planificado:** `POST /auth/login` y `POST /auth/refresh` responden 501;
faltan Argon2id en login, bloqueo temporal por intentos, emisión RS256 con
`kid`, refresh opaco con hash, rotación, detección de reuso y revocación de
familia. También faltan rate limit por cuenta, verificación efectiva de
permisos, firma HMAC de cabeceras internas, tolerancia de 60 segundos y
mediación de propiedad en todos los servicios.

**Leyenda:** los pasos con la marca `planificado` no existen todavía en el
código; los demás se apoyan en el esquema o en componentes actuales. La
validación visual de este diagrama se hará en mermaid.live.
