# Shopio

A multi-role e-commerce marketplace — customer storefront, seller dashboard and admin console —
built with **React + Vite + TypeScript + Tailwind CSS** and backed by a **PHP REST API + MariaDB**
database.

The frontend talks to the live API at `/api/v1`; there is no bundled catalogue or account dataset.
Product, order, seller, review and dashboard data all come from the backend.

---

## Quick start

### Frontend

```bash
# 1. Install dependencies
npm install

# 2. Point the app at the API
cp .env.example .env
# VITE_API_BASE_URL=/api/v1

# 3. Start the dev server
npm run dev
```

Vite prints a local URL (default <http://localhost:5173>).

### Backend

The PHP API lives in `Backend/`. See `Backend/README.md` for database import, environment setup
and the built-in PHP server command. By default the API runs at <http://localhost:8000>.

### Local administrator

The trusted seeder creates an administrator for local development:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@shopio.local` | `Shopio@Admin2026!` |

Customer and seller accounts are created through the normal registration flows. A signed-in
customer can open a store from `/seller/register` and is upgraded to the seller role by the API.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR. |
| `npm run build` | Type-check (`tsc -b`) and produce a production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run typecheck` | Type-check only, no emit. |

---

## What works

**Storefront** — home, shop with category/price/colour/rating/availability filters, sorting and
URL-driven pagination, category pages, product detail with gallery and variants, search, wishlist,
cart, checkout and order confirmation.

**Customer account** — dashboard, orders and order detail, profile, addresses, wishlist, reviews,
notifications and security (sessions and login activity).

**Seller** — onboarding (`/sell`, `/seller/register`), dashboard, product CRUD, inventory, orders
and per-item fulfilment, analytics, store profile and location, payouts, reviews and settings.

**Admin** — overview, users, sellers and verification, products and moderation, categories, orders,
transactions, promotions, reviews, analytics, banners, settings and the activity log.

Cart, wishlist, recently viewed and recent searches persist to `localStorage`. Account, catalogue
and order data are loaded from and written to the API.

---

## Architecture

```
src/
  app/            Router (all routes)
  components/     ui/ (design system), layouts/, navigation/, products/,
                  storefront/, charts/, dashboard/, tables/, forms/, auth/
  content/        Presentation-only copy and image helpers
  context/        Zustand stores (auth, cart, wishlist, catalog, order,
                  people, system, account, ui)
  lib/            Utilities (currency, dates, slugify, cn, pwa, …)
  pages/          storefront/ auth/ customer/ seller/ admin/ legal/
  services/       API client and typed service layer
  types/          Domain types mirroring the SQL schema
  index.css       Tailwind layers + design tokens
Backend/          PHP REST API, validation, authorisation and MariaDB schema
public/           PWA manifest, service worker and icons
```

- **Design system** — shared primitives in `src/components/ui` keep focus, hover, disabled and
  loading states consistent. The palette is near-black `ink`, warm `sand` and a small `gold`
  accent, with Inter as the typeface.
- **State** — Zustand stores hold session and UI state; server data is fetched through
  `src/services/*` and cached only where appropriate.
- **Security** — the backend authenticates the session and checks roles and permissions on every
  request. Frontend route guards are navigation conveniences, not a security boundary.

---

## PWA (installable app + offline shell)

Shopio ships as a Progressive Web App:

| File | Purpose |
| --- | --- |
| `public/manifest.json` | App name, colours, standalone display, shortcuts and icons. |
| `public/sw.js` | Precaches the app shell, caches public catalogue data and serves both offline. |
| `public/icons/` | 192×192, 512×512, maskable 512×512 and Apple touch icons. |
| `src/lib/pwa.ts` | Service-worker registration, called from `src/main.tsx`. |
| `src/components/pwa/InstallPrompt.tsx` | Dismissible in-app install banner with iOS/HTTPS guidance. |
| `src/components/pwa/NetworkStatus.tsx` | Global “offline — showing saved content” indicator. |
| `src/context/installStore.ts` | `beforeinstallprompt` state and the native install action. |

### Caching strategy

- **Navigations** — network-first. Fresh HTML when online; the cached shell (or a branded offline
  page) when offline.
- **Build assets** — cache-first. The hashed JS/CSS bundles are discovered from `index.html` at
  install time, so the first offline launch works without a prior reload.
- **Images and fonts** — cache-first / stale-while-revalidate. Product images are capped in a
  bounded runtime cache; Google Fonts are revalidated in the background.
- **Public catalogue API** — network-first. Successful `products`, `categories`, `banners`,
  `stores`, `countries`, `regions` and `cities` responses are cached, so Home, Shop, Search,
  Categories and previously viewed product pages still render offline. The home/shop endpoints are
  also warmed during service-worker install.
- **Authenticated API** — never cached. Cart, orders, account, seller and admin data always come
  from the live API. If the API cannot be reached, the worker returns a clean JSON `503` envelope
  instead of letting the fetch fail in the browser console.

In development the worker is registered as `/sw.js?dev=1` and stays network-only, so it does not
interfere with Vite HMR while still making the app installable on localhost. A development build
therefore **cannot** be tested offline — use the production preview below.

### Installing on a phone

Chrome, Edge and Samsung Internet only expose the install prompt on a **secure origin** — HTTPS or
`localhost`. Opening the dev server over `http://<LAN-IP>:5173` is not a secure context, so the
service worker cannot register and the browser will not offer installation. Use an HTTPS tunnel or
a deployed HTTPS build for phone testing. The in-app banner detects this and explains what is
missing.

iOS never shows a native install prompt. Use **Share → Add to Home Screen** in Safari; the banner
shows the same instructions.

### Testing on a phone without a tunnel (Android, recommended)

USB port forwarding avoids public tunnels entirely and makes `http://localhost` a secure context
on the phone:

```bash
# Phone: enable Developer options → USB debugging, then connect with USB.
adb devices                  # authorise the phone when prompted
adb reverse tcp:4173 tcp:4173
```

Run the **production build** first (`npm run build && npm run preview`), then
open `http://localhost:4173` on the phone. Install the app from Chrome. The Vite preview proxy
forwards `/api` to the PHP server, so no second port is required.

### Testing over an HTTPS tunnel

If USB is not available, use the dev server through an HTTPS tunnel (for example
`npx localtunnel --port 5173`). Vite proxies `/api` to the local PHP server, so the same tunnel
serves both the app and its API — no second URL or CORS change is needed.

Keep the tunnel process running while testing. If the public URL returns **502 Bad Gateway**, the
tunnel client has stopped or lost its connection — restart it. A Cloudflare quick tunnel
(`cloudflared tunnel --url http://localhost:5173`) is an alternative that does not ask for a
tunnel password.

> Offline testing needs the production build. The service worker intentionally runs network-only
> in development so it cannot serve stale Vite modules.

### Testing the PWA and offline mode

```bash
npm run build
npm run preview
```

Open <http://localhost:4173>, then use DevTools → **Application → Manifest / Service Workers**.
The install control appears in the browser address bar. `localhost` counts as a secure context;
for testing on another device, serve the build over HTTPS.

To test offline:

1. Visit Home, Shop and a product detail page once while online (this fills the API cache).
2. In DevTools → **Network**, select **Offline** and reload.
3. The app shell, categories, product grids, cached product pages and images render from the
   service-worker caches. A black “You’re offline — showing saved catalogue content” bar appears.
4. Cart, checkout and account actions still require a connection and show a friendly error.

---

## API configuration

Set the API base URL in `.env`:

```bash
VITE_API_BASE_URL=/api/v1
```

Vite proxies `/api` to `http://127.0.0.1:8000` in development and preview, so requests are
same-origin. For a deployed build, either point `VITE_API_BASE_URL` at the public API URL or
reverse-proxy `/api` to the PHP backend.

The client sends session cookies, attaches the CSRF token for mutating requests and normalises API
errors. No secrets or credentials are stored in the frontend.

Product photography is loaded from Unsplash and the backend media directory; a branded fallback is
shown if an image fails. Payments use the local sandbox provider — no real charge is made. Email
delivery is written to the backend log unless SMTP is configured.
# shopio
