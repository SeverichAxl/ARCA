# Diagramas de arquitectura - ARQ-106

Índice de los diagramas C4 y de secuencia del Sistema de Gestión Humana de
ARCA Ltda. Los diagramas usan `flowchart` con `subgraph` y `classDef` para los
niveles C4, y `sequenceDiagram` con `autonumber` para los flujos. No se usa la
sintaxis experimental `C4Context` ni `C4Container`, porque no renderiza de
forma estable en GitHub. Todo componente que todavía no existe en el código se
marca como planificado y se dibuja con trazo punteado.

## Índice

| Documento | Contenido |
|---|---|
| [C4 nivel 1 - Contexto](c4-1-contexto.md) | Actores, sistema y sistemas externos |
| [C4 nivel 2 - Contenedores](c4-2-contenedores.md) | Frontend, gateway, cinco servicios, bases, RabbitMQ y Cloudinary |
| [C4 nivel 3 - ms-personal](c4-3-personal.md) | Componentes por capa hexagonal de personal |
| [C4 nivel 3 - ms-vacaciones](c4-3-vacaciones.md) | Componentes por capa hexagonal de vacaciones |
| [Secuencia - Alta de funcionario](seq-alta-funcionario.md) | Alta, Outbox, evento y copia local en vacaciones |
| [Secuencia - Solicitud de vacaciones](seq-solicitud-vacaciones.md) | Solicitud, jefe, RRHH y ruta de excepción |
| [Secuencia - Autenticación y acceso](seq-autenticacion-y-acceso.md) | Login, petición protegida y refresh |

## Leyenda común

| Elemento | Significado |
|---|---|
| Trazo continuo verde | Componente implementado |
| Trazo punteado naranja | Componente planificado o stub sin lógica |
| Trazo gris | Sistema externo |
| Trazo punteado naranja con etiqueta de supuesto | Sistema externo sin integración en el MVP |
| Nodo azul | Actor o rol |
| Cilindro azul | Base de datos PostgreSQL |
| Flecha con etiqueta `REST` | Llamada HTTP a través del API Gateway |
| Flecha con etiqueta `AMQP` | Mensaje asíncrono por RabbitMQ |
| Flecha punteada | Flujo o integración planificada |
| Texto `planificado` en una secuencia | Paso que todavía no existe en el código |

Cada diagrama incluye además su propia leyenda visual. La leyenda distingue
implementado, planificado, externo y base de datos. Un componente marcado como
planificado no debe interpretarse como una funcionalidad disponible.

## Cómo visualizar Mermaid

- **GitHub:** los bloques cercados con el lenguaje `mermaid` se renderizan
  automáticamente en la vista de archivo y en los README. No requiere instalar
  nada.
- **mermaid.live:** copie el contenido del bloque `mermaid` y péguelo en
  <https://mermaid.live>. Es la vía recomendada para validar la sintaxis y
  revisar el render fuera de GitHub.
- **Visual Studio Code:** puede usar una extensión de vista previa de Mermaid
  si ya está instalada en el equipo; no se añadió ninguna dependencia al
  monorepo para esta tarea.

No se ejecutó `mermaid-cli` ni otro validador local porque no está instalado en
el repositorio y no se instalaron dependencias nuevas. La validación visual se
hará en mermaid.live.

## Alcance y fuentes

Los diagramas se basan en `docs/api/*.md`, en especial `eventos.md`,
`personal.md`, `vacaciones.md` y `auth.md`; en `docs/db/*`; en `docs/adr/*`; en
`docker-compose.yml`; y en la estructura real de `services/`, `apps/` y
`packages/`. El detalle de los eventos, payloads, estados y errores está en
[docs/api/eventos.md](../api/eventos.md) y
[docs/api/README.md](../api/README.md).

La integración con el Core de ARCA no existe en el MVP y se mantiene como
supuesto. La integración con Cloudinary está planificada: hoy solo hay
variables de entorno, sin cliente ni llamadas en el código.
