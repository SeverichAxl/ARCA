#!/bin/sh
set -eu

SERVICE="${SERVICE:?SERVICE must be set}"
SCHEMA="/app/services/$SERVICE/prisma/schema.prisma"

if [ -f "$SCHEMA" ]; then
  prisma migrate deploy --schema "$SCHEMA"
  if [ "${RUN_SEED:-false}" = "true" ]; then
    (cd "/app/services/$SERVICE" && prisma db seed)
  fi
fi

exec "$@"
