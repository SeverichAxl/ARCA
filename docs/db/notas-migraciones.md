# Notas de migraciones manuales

- Solo el arquitecto genera migraciones.
- Prisma no representa el índice parcial `uq_area_raiz_nombre`. Si una
  migración generada propone `DROP INDEX uq_area_raiz_nombre`, se debe borrar
  esa línea del SQL generado.
- Los CHECK, REVOKE y triggers de las migraciones de refuerzo no aparecen en
  `schema.prisma` ni en los diccionarios generados. No deben eliminarse al
  regenerar la documentación.
- Las migraciones de refuerzo se crean manualmente cuando el schema de Prisma
  no cambia; se aplican con `prisma migrate deploy`.
