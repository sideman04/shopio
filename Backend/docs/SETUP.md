# Setup & Operations

This guide covers provisioning, configuration, running locally, and preparing a
production deployment.

---

## 1. Prerequisites

| Component | Minimum | Notes |
| --- | --- | --- |
| PHP | 8.3 | `pdo_mysql`, `openssl`, `mbstring`, `fileinfo`, `curl`, `bcmath`, `exif` |
| MySQL | 8.0 | MariaDB 10.4+ also supported |
| Composer | 2.x | |

Optional PHP extensions:

- `argon2` — if the build provides `PASSWORD_ARGON2ID`, it is used automatically
  (`PASSWORD_ALGO=auto`). Without it the app falls back to bcrypt.
- `gd`/`imagick` — **not required**; image validation uses `finfo` + `getimagesize`.

Verify the platform:

```bash
php -v
php -m | grep -E 'pdo_mysql|openssl|mbstring|fileinfo|bcmath'
```

---

## 2. Environment

```bash
cp .env.example .env
```

`.env` is gitignored and **must never be committed**. Key settings:

| Key | Purpose |
| --- | --- |
| `APP_ENV` | `local` / `testing` / `production`. Production tightens error output. |
| `APP_DEBUG` | Must be `false` in production. |
| `API_PREFIX` | Default `/api/v1`. |
| `DB_*` | Least-privilege account (see §4). |
| `SESSION_SECURE_COOKIE` | `true` in production (HTTPS only). |
| `SESSION_SAMESITE` | `Lax` (or `Strict`) in production. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `true` in production. |
| `PASSWORD_PEPPER` | Optional; if set it must remain stable or all hashes break. |
| `CORS_ALLOWED_ORIGINS` | Explicit SPA origins; wildcards are refused with credentials. |
| `PAYMENT_SANDBOX_SECRET` | Shared secret for the signed sandbox provider webhooks. |
| `CRON_TOKEN` | Shared secret for `/api/v1/internal/maintenance`. |
| `UPLOAD_DIR` | Writable directory **outside the document root**. |

Generate strong secrets, e.g.:

```bash
php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
```

---

## 3. Database: schema + migrations

The supplied `database/schema/shopio_database_v2_normalized.sql` is the
**single source of truth** and is applied verbatim. Backend-only tables
(`stock_reservations`, `webhook_events`, `idempotency_keys`, `schema_migrations`,
…) are added by **additive, versioned migrations** in `database/migrations/`.

Automated path:

```bash
# Create/replace the schema and run every migration
scripts/provision-database.sh shopio_v2 --recreate

# Or, to create a separate test database
scripts/provision-database.sh shopio_v2_test
```

Manual path (if you prefer to run the SQL yourself):

```bash
mysql -u root -p < database/schema/shopio_database_v2_normalized.sql

for f in database/migrations/*.sql; do
  echo "-> $f"
  mysql -u root -p shopio_v2 < "$f"
done
```

**Rules for future migrations**

1. Never edit the supplied schema file in place.
2. Add a new numbered file, e.g. `database/migrations/0002_<purpose>.sql`.
3. Make it idempotent where practical (`CREATE TABLE IF NOT EXISTS`,
   `INSERT ... ON DUPLICATE KEY UPDATE`), and record it in `schema_migrations`.
4. Prefer additive changes. Destructive changes (dropping/altering columns,
   narrowing enums) must be justified, backwards-compatible and reviewed.

---

## 4. Least-privilege database account

The application account gets **DML + EXECUTE only** — no DDL, no `GRANT OPTION`,
never `root`. Schema changes use a separate deployment account.

```bash
scripts/create-app-user.sh shopio_v2 shopio_app "$(openssl rand -hex 16)" 127.0.0.1
```

Equivalent SQL:

```sql
CREATE USER IF NOT EXISTS 'shopio_app'@'127.0.0.1' IDENTIFIED BY '…';
CREATE USER IF NOT EXISTS 'shopio_app'@'localhost' IDENTIFIED BY '…';

GRANT SELECT, INSERT, UPDATE, DELETE ON `shopio_v2`.* TO 'shopio_app'@'127.0.0.1';
GRANT EXECUTE                       ON `shopio_v2`.* TO 'shopio_app'@'127.0.0.1';
-- repeat for 'localhost'

FLUSH PRIVILEGES;
```

Notes:

- The schema uses triggers and stored functions; `EXECUTE` is required.
- Grant on the **test database** too when running the suite.
- The migrations account (e.g. `shopio_deploy`) needs `ALTER`, `CREATE`,
  `INDEX`, `DROP`, `REFERENCES` — keep it out of `.env` used by the web app.

---

## 5. First administrator

There is deliberately **no code path** that grants `admin` through the API.
Use the trusted seeder:

```bash
SEED_ADMIN_EMAIL=owner@example.com \
SEED_ADMIN_PASSWORD='a-strong-12+-char-symbol-password!' \
php database/seeders/seed_admin.php
```

- Idempotent: re-running reconciles the account (role, and optionally password
  with `--reset-password`) instead of duplicating it.
- Rejects weak/short/common passwords, invalid emails and disabled accounts.
- Refuses to run while `APP_ENV=production` unless `--force` (or
  `SEED_ADMIN_FORCE=1`) is given — an intentional one-time acknowledgement.
- Never prints the password.

---

## 6. Running locally

```bash
# API server
php -S 127.0.0.1:8000 -t public public/index.php

# Tests (dedicated test DB)
composer test

# Static analysis
composer analyse
```

Smoke test:

```bash
curl -s http://127.0.0.1:8000/api/v1/health
# {"success":true,"message":"Service is healthy","data":{"status":"ok",...}}
```

### Scheduled maintenance

Reservations expire and housekeeping tables must be pruned. Run periodically
(e.g. every 15 minutes) through any scheduler:

```bash
curl -s -X POST https://api.example.com/api/v1/internal/maintenance \
  -H "X-Cron-Token: $CRON_TOKEN"
```

This releases expired stock holds and purges expired sessions, tokens,
rate-limit rows, idempotency keys and old login attempts. It is **not** mounted
behind session auth; it authenticates with the constant-time-checked token.

---

## 7. Production checklist

**Application**

- [ ] `APP_ENV=production`, `APP_DEBUG=false`.
- [ ] Serve only `public/` as the document root; `app/`, `.env`, `storage/` and
      uploads must be outside it (or blocked by `public/.htaccess`).
- [ ] Run behind HTTPS; set `SESSION_SECURE_COOKIE=true` and `HSTS_ENABLED=true`.
- [ ] Configure `TRUSTED_PROXIES` if behind a load balancer so client IPs are
      taken from `X-Forwarded-For` **only** from trusted hops.
- [ ] Set `CORS_ALLOWED_ORIGINS` to the exact SPA origin(s); no wildcards.
- [ ] Set `AUTH_REQUIRE_EMAIL_VERIFICATION=true` and wire a real `MAIL_DRIVER`
      (`smtp`) plus `FRONTEND_URL`.

**Secrets & data**

- [ ] `.env` is not in version control and is readable only by the service user.
- [ ] Rotate `PAYMENT_SANDBOX_SECRET`, `CRON_TOKEN` and DB passwords; use a real
      payment provider (`PAYMENT_DEFAULT_PROVIDER`) instead of `sandbox`.
- [ ] Database backup/restore rehearsed; triggers and stored functions included.
- [ ] App DB account is least privilege (DML + EXECUTE); migrations use a
      separate account.

**Runtime**

- [ ] `UPLOAD_DIR` writable by the service user, not web-readable, on a dedicated
      volume; back it up or serve from object storage.
- [ ] `storage/logs` rotated; `LOG_LEVEL=info` (or `warning`) in production.
- [ ] HTTPS termination, HSTS, and security headers verified (see `docs/SECURITY.md`).
- [ ] Cron/maintenance scheduled.
- [ ] Error tracking configured; ensure logs never contain tokens or passwords.

**Verification**

- [ ] `composer test` green against the production-parity config.
- [ ] `composer analyse` clean.
- [ ] Smoke: health, register/login, browse catalogue, checkout with the real
      provider, provider webhook delivery, refund and payout happy paths.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `SQLSTATE[HY093]: Invalid parameter number` | A named placeholder reused across branches. The `Database` shim rewrites repeated placeholders; if you add raw PDO calls, avoid reusing a name. |
| Passwords reject Argon2id | PHP built without Argon2. `PASSWORD_ALGO=auto` falls back to bcrypt automatically. |
| `Data truncated for column 'status'` | A value not in the column's ENUM was written. Check the schema enum before adding new states. |
| 413 on upload | Body exceeds `UPLOAD_MAX_BYTES` (+ overhead). Raise the limit and PHP's `upload_max_filesize`/`post_max_size`. |
| 409 on webhook | Duplicate `event_id` (replay protection) or illegal state transition. |
| `Refusing to run tests against non-test database` | The test DB name must contain `test`; set `TEST_DB_DATABASE` accordingly. |
| PHPStan "turbo-ext" warning | Harmless: the optional native extension cannot be `dlopen`ed on this platform. |
