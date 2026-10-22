# Shopio Backend

Secure, framework-free **PHP 8.3+ REST API** for the Shopio multi-vendor
marketplace. It is built directly on the supplied normalized MySQL/MariaDB
schema (`shopio_v2`) and pairs with the React frontend in the repository root.

- Layered architecture: **Controllers → Services → Repositories**, plus
  Middleware, Validators and Policies.
- **PDO prepared statements everywhere** (native prepares, no emulation).
- Server-managed **session cookies + CSRF**, or short-lived **bearer tokens**
  for API clients. No client-side tokens, no home-grown JWT.
- Money is handled as **decimal strings via BCMath** — never floats.
- `admin` is granted **only** through the trusted seeder, never at registration.

## Requirements

- PHP **8.3+** with `pdo_mysql`, `openssl`, `mbstring`, `fileinfo`, `curl`, `bcmath`, `exif`
- MySQL **8.0+** or MariaDB **10.4+**
- Composer 2

## Quick start

```bash
cd Backend

# 1. Dependencies
composer install

# 2. Environment
cp .env.example .env
#   -> edit DB_* and PAYMENT_SANDBOX_SECRET at minimum

# 3. Database (schema + migrations) and least-privilege app user
scripts/provision-database.sh shopio_v2
scripts/create-app-user.sh shopio_v2 shopio_app 'change-me'

# 4. Create the first administrator (there is no other way to get one)
SEED_ADMIN_EMAIL=owner@example.com \
SEED_ADMIN_PASSWORD='a-strong-unique-password!' \
php database/seeders/seed_admin.php

# 5. Serve
php -S 127.0.0.1:8000 -t public public/index.php
```

Health check: `curl http://127.0.0.1:8000/api/v1/health`

## Testing & static analysis

```bash
composer test      # PHPUnit (feature + unit), runs against shopio_v2_test
composer analyse   # PHPStan (level 5)
```

Tests never touch the development database: the bootstrap refuses to run against
a database whose name does not contain `test` unless
`SHOPIO_ALLOW_UNSAFE_TEST_DB=1` is set.

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/SETUP.md`](docs/SETUP.md) | Provisioning, migrations, least-privilege DB user, local dev and production checklist. |
| [`docs/API.md`](docs/API.md) | Response envelope, auth flows, endpoint reference, errors and rate limits. |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Threat model, security assumptions and known limitations. |
| [`docs/FRONTEND_INTEGRATION.md`](docs/FRONTEND_INTEGRATION.md) | Wiring the React SPA to this API. |
| [`postman/shopio.postman_collection.json`](postman/shopio.postman_collection.json) | Importable Postman collection. |

## Layout

```
app/
  Auth/           AuthenticatedUser, token/cookie helpers
  Config/         Config (env-backed)
  Controllers/    Thin HTTP entry points
  Database/       PDO wrapper + Seeders/
  Exceptions/     HTTP-mapped exceptions
  Http/           Request, Response, Router, Kernel glue
  Middleware/     Auth, RBAC, CSRF, CORS, rate limit, idempotency, headers
  Payments/       GatewayInterface + SandboxGateway + registry
  Policies/       Ownership checks (BOLA/IDOR)
  Repositories/   All SQL lives here
  Services/       Business logic and transactions
  Support/        Container, Money, Presenter, Logger, Str
  Validators/     Request validation
database/
  schema/         Supplied authoritative schema (read-only)
  migrations/     Additive, versioned migrations
  seeders/        Trusted admin seeder
routes/api.php    Versioned route table
public/index.php  Front controller
tests/            PHPUnit suite
```
