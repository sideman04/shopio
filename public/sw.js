/*
 * Shopio service worker.
 *
 * Production: precaches the app shell and serves static assets cache-first so
 * the storefront opens offline. Navigations are network-first so published
 * builds are picked up immediately, with the cached shell as the fallback.
 *
 * Development: registered as `/sw.js?dev=1` and stays network-only, which
 * keeps the app installable on localhost without interfering with Vite HMR.
 *
 * Public catalogue API responses are cached network-first so the storefront can
 * still render products, categories and banners offline. Authenticated API
 * traffic (cart, orders, account, seller and admin data) is never cached.
 */

const IS_DEV = new URL(self.location.href).searchParams.get('dev') === '1'
const VERSION = IS_DEV ? 'shopio-dev' : 'shopio-v3'

const STATIC_CACHE = `${VERSION}-static`
const RUNTIME_CACHE = `${VERSION}-runtime`
const IMAGE_CACHE = `${VERSION}-images`
const API_CACHE = `${VERSION}-api`
const MAX_IMAGE_ENTRIES = 80
const MAX_API_ENTRIES = 120

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
]

/**
 * Warm the storefront with the exact request URLs it uses on first load. These
 * are best-effort: if the backend is unreachable the service worker still
 * installs and the regular runtime cache fills in on later visits.
 */
const PRECACHE_API_URLS = [
  '/api/v1/categories',
  '/api/v1/banners',
  '/api/v1/products?per_page=60&sort=popularity',
  '/api/v1/products?sort=popularity&page=1&per_page=12',
  '/api/v1/products?sort=popularity&page=1&per_page=8',
  '/api/v1/products?sort=newest&page=1&per_page=8',
  '/api/v1/products?sort=rating&rating_min=4&page=1&per_page=8',
]

const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'manifest'])

/* -------------------------------------------------------------------------- */
/* Precache                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Cache the shell plus the hashed JS/CSS bundles referenced by index.html.
 * Vite fingerprints those filenames, so they are discovered at install time
 * instead of being hard-coded here.
 */
async function precacheAppShell() {
  const cache = await caches.open(STATIC_CACHE)

  await Promise.all(
    PRECACHE_URLS.map(async (url) => {
      try {
        await cache.add(url)
      } catch (error) {
        console.warn('[Shopio SW] Could not precache:', url, error)
      }
    }),
  )

  const response = await fetch('/index.html', { cache: 'reload' })
  if (!response.ok) return

  const html = await response.clone().text()
  await cache.put('/index.html', response.clone())

  await Promise.all(
    extractBuildAssets(html).map(async (assetUrl) => {
      try {
        await cache.add(assetUrl)
      } catch (error) {
        console.warn('[Shopio SW] Could not precache asset:', assetUrl, error)
      }
    }),
  )
}

/**
 * Cache the public catalogue endpoints used by the home and shop pages. This
 * runs during install so a freshly installed app has something to show on the
 * very first offline launch.
 */
async function precachePublicApi() {
  const cache = await caches.open(API_CACHE)

  await Promise.all(
    PRECACHE_API_URLS.map(async (url) => {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        if (response.ok) await cache.put(url, response)
      } catch (error) {
        console.info('[Shopio SW] API precache skipped:', url, error)
      }
    }),
  )
}

function extractBuildAssets(html) {
  const assets = new Set()
  const pattern = /(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g
  let match
  while ((match = pattern.exec(html)) !== null) {
    assets.add(match[1])
  }
  return [...assets]
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

self.addEventListener('install', (event) => {
  if (IS_DEV) {
    event.waitUntil(self.skipWaiting())
    return
  }

  event.waitUntil(
    Promise.allSettled([precacheAppShell(), precachePublicApi()])
      .then((results) => {
        results.forEach((result) => {
          if (result.status === 'rejected') {
            // A single missing asset must not block the rest of the install.
            console.warn('[Shopio SW] Precache failed:', result.reason)
          }
        })
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

/* -------------------------------------------------------------------------- */
/* Fetch routing                                                              */
/* -------------------------------------------------------------------------- */

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Only HTTP(S) requests can be handled by the Cache API.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // API traffic: cache public catalogue reads, keep everything else live.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    if (IS_DEV) return

    if (isPublicApiRequest(url.pathname)) {
      event.respondWith(publicApiNetworkFirst(request))
    } else {
      event.respondWith(networkOnlyApi(request))
    }
    return
  }

  // Development mode stays network-only.
  if (IS_DEV) return

  // SPA navigations: fresh HTML when online, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  // Same-origin build assets, styles, fonts and manifest.
  if (
    isSameOrigin(url) &&
    (STATIC_DESTINATIONS.has(request.destination) || url.pathname.startsWith('/assets/'))
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Product photography (Unsplash and the backend media directory).
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES))
    return
  }

  // Web fonts requested by the Google Fonts stylesheet.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event, request, RUNTIME_CACHE))
  }
})

/* -------------------------------------------------------------------------- */
/* Strategies                                                                 */
/* -------------------------------------------------------------------------- */

function isSameOrigin(url) {
  return url.origin === self.location.origin
}

/**
 * Only public catalogue endpoints may be stored. In particular this excludes
 * `/products/{id}/review-eligibility`, which shares the `/products` prefix but
 * requires authentication.
 */
function isPublicApiRequest(pathname) {
  if (pathname === '/api/v1/products') return true
  if (/^\/api\/v1\/products\/[^/]+$/.test(pathname)) return true
  if (/^\/api\/v1\/products\/[^/]+\/reviews$/.test(pathname)) return true
  if (pathname === '/api/v1/categories') return true
  if (/^\/api\/v1\/categories\/[^/]+$/.test(pathname)) return true
  if (pathname === '/api/v1/banners') return true
  if (/^\/api\/v1\/stores\/[^/]+$/.test(pathname)) return true
  if (pathname === '/api/v1/countries') return true
  if (pathname === '/api/v1/regions') return true
  if (pathname === '/api/v1/cities') return true
  if (/^\/api\/v1\/cities\/\d+$/.test(pathname)) return true
  return false
}

/**
 * Public API: fresh JSON when online, the last successful response when not.
 * Query strings are part of the cache key, so each filter/page is cached
 * separately.
 */
async function publicApiNetworkFirst(request) {
  const cache = await caches.open(API_CACHE)

  try {
    const response = await fetch(request)

    if (response && response.ok) {
      await cache.put(request, response.clone())
      await trimCache(cache, MAX_API_ENTRIES)
    }

    return response
  } catch {
    const cached = await cache.match(request)
    return cached || offlineApiResponse()
  }
}

/**
 * Authenticated API endpoints are never cached, but returning a clean JSON
 * error instead of letting the fetch reject keeps the browser console free of
 * raw offline network failures.
 */
async function networkOnlyApi(request) {
  try {
    return await fetch(request)
  } catch {
    return offlineApiResponse()
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)

    if (response && response.ok) {
      const runtime = await caches.open(RUNTIME_CACHE)
      await runtime.put(request, response.clone())

      // Keep the latest app shell available for offline launches.
      const staticCache = await caches.open(STATIC_CACHE)
      await staticCache.put('/index.html', response.clone())
    }

    return response
  } catch {
    const cached =
      (await caches.match(request)) ||
      (await caches.match('/index.html')) ||
      (await caches.match('/'))

    return cached || offlineResponse()
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)

    if (response && (response.ok || response.type === 'opaque')) {
      const cache = await caches.open(cacheName)
      await cache.put(request, response.clone())
      if (maxEntries) await trimCache(cache, maxEntries)
    }

    return response
  } catch {
    // A neutral placeholder is nicer than a broken-image icon when an image
    // has never been viewed online.
    if (cacheName === IMAGE_CACHE) return imagePlaceholderResponse()
    return Response.error()
  }
}

async function staleWhileRevalidate(event, request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const network = fetch(request)
    .then(async (response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    event.waitUntil(network)
    return cached
  }

  return (await network) || Response.error()
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)))
}

function offlineApiResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'You are offline. Connect to the internet to load this page.',
      data: null,
      meta: {},
      request_id: null,
    }),
    {
      status: 503,
      statusText: 'Offline',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Shopio-Offline': '1',
      },
    },
  )
}

function imagePlaceholderResponse() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#F6EFE6"/><g fill="#C7A67F"><rect x="215" y="250" width="170" height="120" rx="10" opacity="0.5"/><circle cx="255" cy="288" r="14" opacity="0.6"/><path d="M225 360l52-58 40 44 30-32 48 46z" opacity="0.7"/></g></svg>`
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function offlineResponse() {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shopio — You are offline</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #f7f7f5;
        color: #111;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      main { max-width: 420px; text-align: center; }
      .mark {
        width: 56px; height: 56px; margin: 0 auto 20px;
        display: grid; place-items: center;
        border-radius: 16px; background: #111; color: #fff;
        font-size: 28px; font-weight: 700;
      }
      h1 { margin: 0; font-size: 22px; letter-spacing: -0.02em; }
      p { margin: 12px 0 0; color: #555; line-height: 1.6; font-size: 14px; }
      button {
        margin-top: 24px; padding: 11px 20px; border: 0; border-radius: 10px;
        background: #111; color: #fff; font: inherit; font-weight: 600; cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">S</div>
      <h1>You are offline</h1>
      <p>Shopio could not reach the network. Check your connection and try again — previously visited pages are still available.</p>
      <button type="button" onclick="window.location.reload()">Try again</button>
    </main>
  </body>
</html>`,
    {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}
