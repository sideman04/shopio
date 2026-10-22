# Frontend integration

How to point the React SPA (repository root) at this PHP API. The UI is not
changed by anything here — only the service layer and environment.

---

## 1. Point the client at the API

Create `.env` in the repository root:

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

The SPA's `src/services/apiClient.ts` already builds URLs as
`{VITE_API_BASE_URL}{endpoint}` and its `endpoints` map (`/auth/login`,
`/products`, `/orders`, …) matches this API's paths exactly.

> Note the version segment: the API is served under **`/api/v1`**, so the base
> URL must include it.

Every service talks to this API; there is no offline mode or bundled dataset.

---

## 2. Authentication

### Recommended for the browser: cookie session + CSRF

The API supports server-managed sessions delivered as `HttpOnly` cookies. This
keeps the token out of JavaScript entirely.

1. Configure CORS to allow your origin with credentials
   (`CORS_ALLOWED_ORIGINS=http://localhost:5173`, `CORS_ALLOW_CREDENTIALS=true`).
2. Send credentials with every request: `fetch(..., { credentials: 'include' })`.
3. After login/register, read the **readable** `shopio_csrf` cookie and echo its
   value in the `X-CSRF-Token` header on every `POST`/`PUT`/`PATCH`/`DELETE`.
4. Do not add an `Authorization` header in this mode.

```ts
function csrfToken(): string {
  return document.cookie.match(/(?:^|;\s*)shopio_csrf=([^;]+)/)?.[1] ?? ''
}

await fetch(`${API_BASE_URL}/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})

// later, for a write:
await fetch(`${API_BASE_URL}/orders`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
  body: JSON.stringify(checkoutPayload),
})
```

### Alternative: bearer token in memory

The existing `apiClient` already attaches `Authorization: Bearer <token>`.
Login/register return `{ token, csrfToken, expiresAt }`; store `token` **in
memory only** (the client's `setAuthToken`) and re-login after a reload. Never
persist it to `localStorage`. Bearer requests do **not** need CSRF.

> Whichever mode you choose, do not mix them: a request authenticated by cookie
> must carry CSRF; a request with a bearer token must not rely on cookies.

---

## 3. The response envelope

Every response is `{ success, message, data, meta }` (errors:
`{ success, message, errors, request_id }`). Unwrap the envelope in the service
layer rather than in components:

```ts
const { data } = await apiClient.get<{ data: Product[] }>('/products', { anonymous: true })
```

- `errors` maps `field → string[]` — feed straight into form validation.
- `request_id` should be surfaced in the error toast and included in bug reports.
- List endpoints put `total`/`page`/`per_page`/`total_pages`/`has_more` under
  `meta.pagination`.

---

## 4. Money, currency and dates

- Amounts are **strings** (`"199.99"`), not numbers. Keep them as strings when
  round-tripping (cart, checkout, refunds) and only parse for display.
- Default currency is `TZS`; VAT/shipping defaults come from the backend
  (`v_order_totals`). Do not recompute totals client-side — display the
  server-computed `grandTotal`, `itemsSubtotal`, `shipping`, `tax`, adjustments.
- Timestamps are UTC ISO-8601 strings; format for the user's locale in the UI.

---

## 5. Endpoint mapping

| UI area | Endpoint(s) |
| --- | --- |
| Login / register | `POST /auth/login`, `POST /auth/register`, `GET /auth/me`, `POST /auth/logout` |
| Password reset | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Catalogue | `GET /products`, `GET /products/{slug}`, `GET /products/{slug}/reviews`, `GET /categories`, `GET /stores/{slug}`, `GET /banners` |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/{id}`, `DELETE /cart/items/{id}` |
| Checkout | `POST /orders` (send an `Idempotency-Key` header) |
| Orders | `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/cancel`, `POST /orders/{id}/payments` |
| Refunds | `GET|POST /orders/{id}/refunds` |
| Customer | `GET|PATCH /customers/profile`, `/customers/addresses`, `/customers/notifications`, `/customers/wishlist`, `POST /coupons/validate` |
| Reviews | `GET /products/{id}/review-eligibility`, `POST /products/{id}/reviews` |
| Uploads | `POST /uploads/images` (multipart, field name `file`) |
| Seller | `/sellers/register`, `/sellers/dashboard|analytics|store|orders|products|inventory|payouts|reviews` |
| Admin | `/admin/overview|analytics|users|sellers|products|categories|orders|transactions|promotions|reviews|banners|settings|activity|refunds|payouts|support` |

---

## 6. Retryable operations & idempotency

For `POST /orders`, `POST /orders/{id}/payments`, `POST /orders/{id}/refunds` and
`POST /sellers/payouts`, generate a UUID per user action and send it as
`Idempotency-Key`. On network retry, reuse the **same** key so the backend returns
the original result instead of double-charging. A `409` means the key was reused
with a different body — generate a fresh key.

---

## 7. Error handling & rate limits

```ts
import { ApiError } from '@/services/apiClient'

try {
  await apiClient.post('/orders', payload, { headers: { 'Idempotency-Key': key } })
} catch (e) {
  if (e instanceof ApiError) {
    if (e.status === 422) showFieldErrors((e.payload as any).errors)
    else if (e.status === 429) showToast(`Slow down — retry in ${(e.payload as any).retry_after}s`)
    else showToast(`${e.message} (ref: ${(e.payload as any).request_id})`)
  }
}
```

- `401` → clear the in-memory token and route to login.
- `403` → the user is authenticated but lacks the role/status.
- `404` → not found **or not owned** (the API hides existence).
- `409` → state conflict / idempotency reuse; refresh the resource.
- `419` → CSRF token missing/stale (cookie mode); re-fetch it.
- `429` → honour the `Retry-After` header.

---

## 8. Things the frontend must not do

- Do not compute or trust client-side totals, stock or commission.
- Do not store tokens in `localStorage`/`sessionStorage`.
- Do not assume an action succeeded without a server response.
- Create real users through registration; never hard-code credentials.
  The administrator is provisioned with the backend seeder (see `SETUP.md`).
- Do not handle payment webhooks — those are server-to-server only.

---

## 9. Local end-to-end smoke

```bash
# terminal 1 — API
cd Backend && php -S 127.0.0.1:8000 -t public public/index.php

# terminal 2 — SPA
VITE_API_BASE_URL=http://localhost:8000/api/v1 npm run dev
```

Then: register → browse → add to cart → checkout → start a payment → send a
signed webhook from the sandbox provider (or use the Postman collection's signed
request) → confirm the order shows as paid.
