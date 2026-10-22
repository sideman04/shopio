# API Reference

Base URL: `{APP_URL}{API_PREFIX}` → default `http://localhost:8000/api/v1`.
All request and response bodies are JSON (`application/json`) unless noted
(multipart for uploads). Currency amounts are **decimal strings** (e.g.
`"199.99"`), never JSON numbers — do not parse them as floats.

---

## Response envelope

**Success**

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": { },
  "meta": { }
}
```

**Error**

```json
{
  "success": false,
  "message": "The given data was invalid.",
  "errors": { "field": ["Reason."] },
  "request_id": "b1f2…"
}
```

`request_id` correlates a client error with the server log line; include it in
support requests. Some errors add extra top-level keys (for example rate limiting
adds `retry_after`).

**Pagination** (list endpoints) appears under `meta.pagination`:

```json
{
  "pagination": {
    "total": 137, "page": 2, "per_page": 20,
    "total_pages": 7, "has_more": true
  }
}
```

List endpoints accept `?page=` (default 1) and `?per_page=` (default 20, max 100),
plus endpoint-specific filters.

---

## Authentication

The API supports two interchangeable credential styles over one session model:

| Client | How it authenticates | CSRF |
| --- | --- | --- |
| Browser SPA | `shopio_session` **HttpOnly** cookie set on login | Required on writes (double-submit) |
| API/mobile | `Authorization: Bearer <token>` from the login/register body | Not required |

Sessions are opaque, server-generated, stored hashed server-side and expire
(`SESSION_TTL`, default 2h; absolute `SESSION_ABSOLUTE_TTL`, default 14 days).
Logout and password reset revoke sessions. Never store tokens in `localStorage`.

**CSRF (cookie clients).** A readable `shopio_csrf` cookie is issued at login.
Echo its value in the header named by `CSRF_HEADER_NAME` (default
`x-csrf-token`) on every `POST`/`PUT`/`PATCH`/`DELETE`. A missing or mismatched
token yields `419`.

### Register

`POST /auth/register`

```json
{
  "full_name": "Amina Hassan",
  "email": "amina@example.com",
  "password": "correct horse battery",
  "password_confirmation": "correct horse battery",
  "accept_terms": 1,
  "store_name": "Amina Crafts"        // optional → also grants the seller role
}
```

`201` → `{ "user", "verificationRequired", "token", "csrfToken", "expiresAt" }`
and sets the session + CSRF cookies. The `admin` role can **never** be obtained
here. When email verification is required, the account cannot sign in until the
email is verified.

### Sign in / out

| Endpoint | Body | Result |
| --- | --- | --- |
| `POST /auth/login` | `{ "email", "password" }` | `200` `{ user, token, csrfToken, expiresAt }` |
| `POST /auth/logout` | — | `200`, clears cookies, revokes the session |
| `GET /auth/me` | — | `200` `{ user, roles, … }` |

Login failures are **generic** (`401`, same message for unknown email and wrong
password). Suspended/disabled accounts receive `403`. Repeated failures trigger
lockout (`429`).

### Password & verification

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/forgot-password` | Always generic; emails a reset link if the account exists. |
| `POST /auth/reset-password` | `{ token, email, password, password_confirmation }`. |
| `POST /auth/verify-email` | `{ token }`. |
| `POST /auth/resend-verification` | Always generic. |
| `POST /auth/change-password` | Authenticated; requires `current_password`. |
| `POST /auth/phone/verify` / `POST /auth/phone/confirm` | Phone verification. |

---

## Endpoint map

Routes are grouped by surface; all require a valid session unless marked public.
`admin` routes require the `admin` role; `seller` routes require the `seller`
role. Ownership is enforced per resource (**BOLA/IDOR** protection returns `404`,
not `403`, so existence is not disclosed).

### Public

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. |
| `GET` | `/products`, `/products/{slug}`, `/products/{slug}/reviews` | Only active products from approved, active sellers. |
| `GET` | `/categories`, `/categories/{slug}` | |
| `GET` | `/banners`, `/stores/{slug}` | |
| `GET` | `/countries`, `/regions`, `/cities`, `/cities/{id}` | |
| `POST` | `/auth/register`, `/auth/login`, plus password/verification routes | Rate limited. |
| `POST` | `/webhooks/payments/{provider}` | Signature-verified; see below. |
| `POST` | `/internal/maintenance` | Requires `X-Cron-Token`. |
| `POST` | `/support` | Optional auth; rate limited (5/hour/IP). |

### Cart (authenticated)

`GET /cart` · `POST /cart/items` · `PATCH|PUT /cart/items/{id}` ·
`DELETE /cart/items/{id}` · `DELETE /cart`

### Orders & payments (authenticated)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/orders` | Own orders; filters `status`, `payment_status`, `q`. |
| `POST` | `/orders` | Checkout. Rate limited; supports **Idempotency-Key**. |
| `GET` | `/orders/{id}` | Own order (else `404`). |
| `POST` | `/orders/{id}/cancel` | Releases stock holds. |
| `POST` | `/orders/{id}/payments` | Start a payment; supports **Idempotency-Key**. |
| `GET` | `/orders/{id}/refunds` | Own refunds. |
| `POST` | `/orders/{id}/refunds` | Request a refund; supports **Idempotency-Key**. |

### Customer (authenticated)

`GET|PATCH /customers/profile` · `GET|POST /customers/addresses` ·
`PATCH|DELETE /customers/addresses/{id}` · notifications
(`GET`, `POST …/read-all`, `POST …/{id}/read`) · wishlist
(`GET`, `POST`, `DELETE …/{productId}`) · `POST /coupons/validate` ·
reviews (`GET /products/{id}/review-eligibility`, `POST /products/{id}/reviews`,
`POST /reviews/{id}/report`).

### Uploads (authenticated)

`POST /uploads/images` — `multipart/form-data` with a `file` field. Detected
MIME must be JPEG, PNG or WebP; the filename is generated server-side. Returns
`{ url, path, mimeType, sizeBytes, width, height }`.

### Seller (role `seller`)

Onboarding: `POST /sellers/register`. Workspace:
`GET|PATCH /sellers/store`, `/sellers/dashboard`, `/sellers/analytics`,
`/sellers/orders`, `/sellers/orders/{id}`, `PATCH /sellers/orders/{id}/items/{itemId}`,
`/sellers/payouts/summary|payouts` (`POST /sellers/payouts` supports **Idempotency-Key**),
`/sellers/reviews`, `POST /sellers/reviews/{id}/reply`.
Catalogue & inventory: `/sellers/products` (CRUD + `submit`, images, variants,
options), `/sellers/inventory` (+ `adjust`, `threshold`).

### Admin (role `admin`)

Overview/analytics, users (`PATCH …/{id}/status`, `PUT …/{id}/roles`), sellers
(`PATCH /admin/sellers/{id}` verification), products (`PATCH …/{id}` moderation),
categories, orders (`GET`, `GET {id}`, `PATCH …/{id}/status`), transactions,
promotions, reviews & reports, banners, settings, activity, refunds
(`PATCH /admin/refunds/{id}`), payouts (`PATCH /admin/payouts/{id}`), support.

---

## Idempotency

Send `Idempotency-Key: <opaque>` on `POST /orders`, `POST /orders/{id}/payments`,
`POST /orders/{id}/refunds` and `POST /sellers/payouts`.

- Replaying the **same** key + body returns the original response without
  re-running the side effect.
- Reusing a key with a **different** body returns `409`.
- Omitting the key executes normally each time (no automatic protection).

Keys expire after `IDEMPOTENCY_TTL_SECONDS` (default 24h).

---

## Money & currency

- Amounts are strings with two decimals; the default currency is `TZS`.
- Order totals live in `v_order_totals`: `grand_total = items_subtotal −
  items_discount + shipping + tax + other_adjustments`. Coupons appear as
  `other_adjustments` (negative).
- Never do floating-point arithmetic client-side; format only for display.

---

## Payment webhooks

`POST /webhooks/payments/{provider}` receives provider callbacks. The sandbox
provider (used for local dev and tests) is a faithful security boundary:

- Headers: `X-Shopio-Signature`, `X-Shopio-Timestamp` (unix seconds).
- Signature: `HMAC-SHA256(secret, "{timestamp}.{raw_body}")`, hex.
- The timestamp must be within `PAYMENT_WEBHOOK_TOLERANCE` (default 300s).
- Verification failures return `400` with an opaque body.
- Duplicate `event_id`s are ignored (replay protection); the response reports
  `"status": "duplicate"`.
- Only a verified `payment.succeeded` marks an order paid and settles stock
  holds; a client can never declare its own payment successful.

---

## Status codes

| Code | Meaning |
| --- | --- |
| `200` | OK |
| `201` | Created |
| `204` | No content (deletes) |
| `400` | Malformed/unsigned webhook, bad JSON |
| `401` | Not authenticated |
| `403` | Authenticated but not permitted (role/status) |
| `404` | Not found **or** not owned (existence concealed) |
| `409` | State conflict (illegal transition, idempotency reuse, duplicate) |
| `413` | Payload too large |
| `419` | CSRF failure |
| `422` | Validation failed / business rule rejected |
| `429` | Rate limited (see `retry_after`, `Retry-After`) |
| `500` | Unexpected server error |

---

## Rate limits

Limits are enforced server-side and keyed as noted; exceeding a limit returns
`429` with `retry_after` (seconds) and a `Retry-After` header.

| Scope | Key | Limit |
| --- | --- | --- |
| Login | IP + user | 20 / 5 min (plus progressive lockout) |
| Register | IP | 10 / hour |
| Password reset / verification | IP | 10 / hour |
| Generic writes | user | 120 / min |
| Checkout | user | 20 / 5 min |
| Uploads | user | 60 / hour |
| Support messages | IP | 5 / hour |
