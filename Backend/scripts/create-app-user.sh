#!/usr/bin/env bash
#
# Create the least-privilege application database account.
#
# The application account gets DML only (SELECT/INSERT/UPDATE/DELETE) plus
# EXECUTE for the supplied stored functions. It gets NO DDL, NO GRANT OPTION and
# is never root. Migrations must be run with a separate deployment account
# (DB_ADMIN_USERNAME / DB_ADMIN_PASSWORD).
#
# Usage:
#   scripts/create-app-user.sh <database> <username> <password> [host]
#
set -euo pipefail

DB_NAME="${1:?database name required}"
APP_USER="${2:?application username required}"
APP_PASS="${3:?application password required}"
APP_HOST="${4:-127.0.0.1}"

ADMIN_USER="${DB_ADMIN_USERNAME:-root}"
ADMIN_PASS="${DB_ADMIN_PASSWORD:-}"
ADMIN_HOST="${DB_ADMIN_HOST:-127.0.0.1}"

CLIENT_BIN="$(command -v mariadb || command -v mysql)"

if [[ -n "$ADMIN_PASS" ]]; then
  ADMIN_CMD=("$CLIENT_BIN" -h"$ADMIN_HOST" -u"$ADMIN_USER" -p"$ADMIN_PASS")
else
  ADMIN_CMD=("$CLIENT_BIN" -h"$ADMIN_HOST" -u"$ADMIN_USER")
fi

for host in "$APP_HOST" localhost; do
  "${ADMIN_CMD[@]}" <<SQL
CREATE USER IF NOT EXISTS '${APP_USER}'@'${host}' IDENTIFIED BY '${APP_PASS}';
ALTER USER '${APP_USER}'@'${host}' IDENTIFIED BY '${APP_PASS}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO '${APP_USER}'@'${host}';
GRANT EXECUTE ON \`${DB_NAME}\`.* TO '${APP_USER}'@'${host}';
SQL
  echo "==> Granted DML+EXECUTE on ${DB_NAME} to ${APP_USER}@${host}"
done

"${ADMIN_CMD[@]}" -e "FLUSH PRIVILEGES; SHOW GRANTS FOR '${APP_USER}'@'${APP_HOST}';"
