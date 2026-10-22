# Security Model

This document describes what the backend protects against, the assumptions it
makes, and the limitations you should know before trusting it in production.

---

## Threat model & assumptions

- The API is the **only** trusted decision point. Frontend guards, hidden buttons
  and route guards are conveniences, not controls.
- Client input is hostile: every identifier is validated, every path parameter is
  cast to its expected type, and every query is parameterised.
- The network is untrusted. TLS termination, HSTS and CORS are configured at the
  edge/proxy per the production checklist in `SETUP.md`.
- The database and the host are trusted-but-least-privileged: the app account has
  DML + `EXECUTE` only, never DDL or `GRANT`.
- Secrets live only in the process environment (`.env`), never in source control,
  never in logs, never in API responses.
- Provider callbacks (webhooks) are untrusted until their signature and freshness
  are verified.

---

## Controls in place

**Authentication & sessions**

- Server-managed opaque sessions; the raw token is stored **hashed** server-side.
- Delivered as an `HttpOnly`, `Secure` (in production), `SameSite` cookie for
  browsers and/or a bearer token for API clients. Never `localStorage`.
- No custom JWT is implemented.
- Sessions have idle + absolute expiry, are revocable on logout/password reset,
  and are bound to the requesting context.
- Login failures are generic (no account enumeration); unknown accounts still pay
  the cost of a dummy password verification (timing equalisation).
- Failed logins lock out progressively; suspended/disabled accounts are refused.

**Passwords**

- Argon2id when available, otherwise bcrypt (`PASSWORD_ALGO=auto`), with an
  optional server-side pepper.
- Hashes are upgraded opportunistically via `needsRehash()`.

**CSRF**

- Double-submit token for cookie-backed writes only. Bearer clients are exempt by
  design because a cross-site request cannot set the `Authorization` header.

**Authorisation**

- Role checks (`admin` / `seller` / `customer`) are enforced in middleware, and
  the `admin` role can never be granted through public registration.
- Object ownership (BOLA/IDOR) is enforced per resource; non-owned resources
  return `404` so existence is not leaked.
- `admin` accounts are created **only** by the trusted seeder.

**Input, SQL & mass assignment**

- All SQL uses PDO prepared statements (native prepares).
- Writes use explicit allowlists; `status`, `password_hash`, `email`, `role`,
  `seller_id` and similar fields cannot be mass-assigned.
- Path identifiers are cast to their expected scalar type.

**Payments, refunds & inventory**

- A payment is successful **only** after a signature-verified provider webhook.
- Webhooks require `HMAC-SHA256` over `"{timestamp}.{raw_body}"`, a fresh
  timestamp, and are replay-protected by `(provider, event_id)`.
- Refunds are bounded by the captured amount minus amounts already refunded, and
  the check runs with the payment row locked inside a transaction.
- Inventory `quantity_on_hand` changes only through the movement ledger (DB
  triggers); `quantity_reserved` changes only through guarded, row-locked
  conditional updates. Checkout cannot oversell under concurrency.

**Transport, uploads & headers**

- Uploads: server-side MIME detection (`finfo`), allowlist, size and dimension
  checks, generated filenames, stored outside the document root; the client
  filename is never used.
- Baseline response headers: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`,
  `Cross-Origin-Resource-Policy`, `X-Permitted-Cross-Domain-Policies`, a locked
  `Content-Security-Policy`, and HSTS over HTTPS. The runtime is not advertised.
- CORS uses an explicit allowlist and refuses wildcards when credentials are on.

**Observability**

- Security-relevant actions (auth, role changes, refunds, payouts, uploads, order
  status changes) are written to an audit log.
- Logs are structured and deliberately exclude secrets, tokens and raw SQL values.

---

## Known limitations

Be explicit about these when assessing risk or extending the system.

1. **Reservation movement type unused.** The schema defines a
   `release_reservation` movement type, but releases are recorded by decreasing
   `quantity_reserved` and updating the reservation status rather than writing a
   ledger row. This keeps the invariant simple but means released holds do not
   appear as inventory movements.

2. **`sometimes` validation is effectively required.** In the validator,
   `sometimes|required` behaves as `required`, and `sometimes` on its own does
   not always skip missing fields. Some PATCH endpoints therefore expect a full
   body (for example address updates). This is stricter than REST purists prefer
   but never under-validates.

3. **Concurrent refund *requests*.** The refundable-balance check counts refunds
   in `approved`, `processing` and `succeeded` states (plus the payment row lock).
   Multiple refunds left in the `requested` state are not summed against the
   balance until an admin acts on them, so an operator should review the refund
   queue before approving overlapping requests.

4. **Rejected payouts keep their items locked.** Once items are snapshotted into
   `payout_items`, they are excluded from future payouts even if the payout is
   later rejected. Recovering a rejected payout requires an explicit remedial
   step; treat rejections as terminal and prefer correcting before requesting.

5. **Admin `delivered` does not mark items delivered.** The admin order status
   override changes the order, not per-item fulfillment. Payout eligibility is
   driven by per-item `fulfillment_status = 'delivered'` set by the seller, so an
   order can be `delivered` while its items are not yet payout-eligible.

6. **No image re-encoding or malware scanning.** Uploads are validated and stored
   as-is. Without `gd`/`imagick` (often unavailable on mobile PHP builds) the
   server cannot strip EXIF or re-encode. Serve uploads from a separate origin
   and consider an AV scan in hardened deployments.

7. **The `sandbox` payment provider is for local/dev/test only.** It performs no
   network calls. A production deployment must implement a real `GatewayInterface`
   adapter and set `PAYMENT_DEFAULT_PROVIDER` accordingly.

8. **Bearer tokens are as strong as their storage.** The API issues session
   tokens; there is no separate long-lived refresh-token rotation scheme. Treat
   bearer tokens as secrets, keep `SESSION_TTL` short, and revoke on compromise.

9. **CSRF applies to cookie sessions only.** This is correct, but it means the
   `SameSite`/`Secure` cookie flags and a strict CORS allowlist are load-bearing
   for browser security.

10. **Rate limiting is database-backed.** It is effective and consistent when all
    app instances share the database, but it is not a substitute for an edge
    WAF/DDoS layer, and it adds a small per-request write.

11. **`webhook_events` retains raw payloads.** These may contain customer data;
    apply a retention policy and restrict access to the table.

12. **Email/SMS are pluggable.** Default drivers (`log`/`null`) do not deliver;
    production must configure a real mail driver (and an SMS provider for phone
    verification).

13. **No account-deletion/anonymisation workflow** is implemented beyond what the
    schema supports; treat data-subject requests as an operational process.

---

## Reporting a vulnerability

Do not open a public issue for security problems. Send a private report to the
maintainers describing the impact, a reproduction, and any suggested fix. Please
avoid accessing or modifying data that is not yours while researching.
