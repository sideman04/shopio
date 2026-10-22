#!/usr/bin/env bash
#
# Provision a Shopio database from the authoritative schema plus migrations.
#
# Usage:
#   scripts/provision-database.sh [database_name] [--recreate] [--admin-user=USER] [--admin-host=HOST]
#
# The authoritative schema is applied VERBATIM except for the database name, so
# the supplied `shopio_database_v2_normalized.sql` remains the single source of
# truth. Backend-only tables are then added by the versioned migrations.
#
# This script intentionally uses the mysql/mariadb CLI because the authoritative
# schema uses the client-side `DELIMITER` construct for triggers/functions.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SCHEMA_FILE="${BACKEND_DIR}/database/schema/shopio_database_v2_normalized.sql"
MIGRATIONS_DIR="${BACKEND_DIR}/database/migrations"

DB_NAME="${1:-shopio_v2}"
shift || true

RECREATE=0
ADMIN_USER="${DB_ADMIN_USERNAME:-root}"
ADMIN_PASS="${DB_ADMIN_PASSWORD:-}"
ADMIN_HOST="${DB_ADMIN_HOST:-127.0.0.1}"

for arg in "$@"; do
  case "$arg" in
    --recreate) RECREATE=1 ;;
    --admin-user=*) ADMIN_USER="${arg#*=}" ;;
    --admin-host=*) ADMIN_HOST="${arg#*=}" ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "Schema file not found: $SCHEMA_FILE" >&2
  exit 1
fi

CLIENT_BIN="$(command -v mariadb || command -v mysql)"
if [[ -z "$CLIENT_BIN" ]]; then
  echo "Neither mariadb nor mysql client found on PATH." >&2
  exit 1
fi

mysql_admin() {
  if [[ -n "$ADMIN_PASS" ]]; then
    "$CLIENT_BIN" -h"$ADMIN_HOST" -u"$ADMIN_USER" -p"$ADMIN_PASS" "$@"
  else
    "$CLIENT_BIN" -h"$ADMIN_HOST" -u"$ADMIN_USER" "$@"
  fi
}

validate_db_name() {
  [[ "$1" =~ ^[A-Za-z0-9_]+$ ]] || { echo "Invalid database name: $1" >&2; exit 2; }
}

validate_db_name "$DB_NAME"

echo "==> Provisioning database '${DB_NAME}' (admin user: ${ADMIN_USER}@${ADMIN_HOST})"

if [[ "$RECREATE" == "1" ]]; then
  echo "==> Dropping existing database '${DB_NAME}'"
  mysql_admin -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`;"
fi

echo "==> Applying authoritative schema (shopio_database_v2_normalized.sql)"
# Rewrite only the database name; every table/column/index/trigger/function/view
# definition is preserved exactly as supplied.
sed -E "s/(CREATE DATABASE IF NOT EXISTS |USE )\`?shopio_v2\`?/\1\`${DB_NAME}\`/g" "$SCHEMA_FILE" \
  | mysql_admin

echo "==> Applying migrations"
shopt -s nullglob
for migration in "$MIGRATIONS_DIR"/*.sql; do
  echo "    -> $(basename "$migration")"
  mysql_admin "$DB_NAME" < "$migration"
done

echo "==> Done. Tables in '${DB_NAME}':"
mysql_admin "$DB_NAME" -N -e "SHOW FULL TABLES;" | awk '{print "    "$1" ("$2")"}'
