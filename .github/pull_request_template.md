## Descripción

<!-- Explique qué cambia y por qué. -->

## Historia / Issue

<!-- feature/<ID-historia>-descripcion -->

## Tipo de cambio

- [ ] Nueva funcionalidad
- [ ] Corrección de bug
- [ ] Refactorización
- [ ] Documentación
- [ ] Infraestructura / CI

## Checklist del DoD

- [ ] Los criterios de aceptación de la historia están cumplidos.
- [ ] Swagger actualizado en los servicios afectados (si aplica).
- [ ] Las operaciones de escritura registran auditoría (`AUDITORIA_REGISTRADA`).
- [ ] Se agregaron o actualizaron tests (unitarios y/o de integración).
- [ ] El endpoint `/health` del servicio sigue respondiendo.
- [ ] `pnpm lint`, `pnpm build` y `pnpm test` pasan localmente.
- [ ] `prisma validate` pasa en los servicios modificados.
- [ ] Se actualizó `.env.example` con las nuevas variables (si aplica).
- [ ] No se incluyen secretos, claves ni archivos `.env` reales.
- [ ] El PR cuenta con al menos una revisión aprobada.

## Evidencia

<!-- Capturas, logs, comandos ejecutados o enlaces relevantes. -->
