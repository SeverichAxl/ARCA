#!/bin/bash
# Se ejecuta una sola vez al crear el volumen de Postgres (docker-entrypoint-initdb.d).
# Por servicio: un dueño/migrador (DIRECT_URL) y un usuario de runtime con DML (DATABASE_URL).
# Ningún usuario tiene acceso a la base de otro servicio.
set -euo pipefail

: "${AUTH_DB_OWNER_PASSWORD:?AUTH_DB_OWNER_PASSWORD es obligatorio}"
: "${AUTH_DB_APP_PASSWORD:?AUTH_DB_APP_PASSWORD es obligatorio}"
: "${PERSONAL_DB_OWNER_PASSWORD:?PERSONAL_DB_OWNER_PASSWORD es obligatorio}"
: "${PERSONAL_DB_APP_PASSWORD:?PERSONAL_DB_APP_PASSWORD es obligatorio}"
: "${VACACIONES_DB_OWNER_PASSWORD:?VACACIONES_DB_OWNER_PASSWORD es obligatorio}"
: "${VACACIONES_DB_APP_PASSWORD:?VACACIONES_DB_APP_PASSWORD es obligatorio}"
: "${CONTRATOS_DB_OWNER_PASSWORD:?CONTRATOS_DB_OWNER_PASSWORD es obligatorio}"
: "${CONTRATOS_DB_APP_PASSWORD:?CONTRATOS_DB_APP_PASSWORD es obligatorio}"
: "${PLANILLAS_DB_OWNER_PASSWORD:?PLANILLAS_DB_OWNER_PASSWORD es obligatorio}"
: "${PLANILLAS_DB_APP_PASSWORD:?PLANILLAS_DB_APP_PASSWORD es obligatorio}"

create_service_db() {
  local db="$1" owner="$2" app="$3" owner_pw="$4" app_pw="$5"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE ${owner} LOGIN CREATEDB PASSWORD '${owner_pw}';
CREATE ROLE ${app} LOGIN PASSWORD '${app_pw}';
CREATE DATABASE ${db} OWNER ${owner};
REVOKE ALL ON DATABASE ${db} FROM PUBLIC;
GRANT CONNECT ON DATABASE ${db} TO ${app};
SQL
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<SQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO ${owner};
GRANT USAGE ON SCHEMA public TO ${app};
ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${app};
ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${app};
SQL
}

create_service_db db_auth       ms_auth_owner       ms_auth_app       "$AUTH_DB_OWNER_PASSWORD"       "$AUTH_DB_APP_PASSWORD"
create_service_db db_personal    ms_personal_owner   ms_personal_app   "$PERSONAL_DB_OWNER_PASSWORD"   "$PERSONAL_DB_APP_PASSWORD"
create_service_db db_vacaciones  ms_vacaciones_owner ms_vacaciones_app "$VACACIONES_DB_OWNER_PASSWORD" "$VACACIONES_DB_APP_PASSWORD"
create_service_db db_contratos   ms_contratos_owner  ms_contratos_app  "$CONTRATOS_DB_OWNER_PASSWORD"  "$CONTRATOS_DB_APP_PASSWORD"
create_service_db db_planillas   ms_planillas_owner  ms_planillas_app  "$PLANILLAS_DB_OWNER_PASSWORD"  "$PLANILLAS_DB_APP_PASSWORD"
