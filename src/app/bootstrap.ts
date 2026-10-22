import { useAuthStore } from '@/context/authStore'
import { useCartStore } from '@/context/cartStore'
import { accountService, authService, cartService, catalogService, categoryService } from '@/services'

/**
 * One-time application bootstrap.
 *
 * Restores the cookie-backed session, warms the public catalogue caches and, for
 * a signed-in user, hydrates the account surfaces (cart, wishlist, addresses,
 * notifications). The promise is shared so React StrictMode's double effect does
 * not fire duplicate requests.
 */

let bootstrapPromise: Promise<void> | null = null
let bootstrapped = false

async function run() {
  const user = await authService.me()

  await Promise.allSettled([
    categoryService.listCategories(),
    catalogService.fetchBanners(),
    catalogService.fetchCatalogue(),
  ])

  if (user) {
    await Promise.allSettled([
      cartService.fetchCart(),
      cartService.fetchWishlist(),
      accountService.fetchAddresses(),
      accountService.fetchNotifications(),
    ])
  } else {
    useCartStore.getState().setServerBacked(false)
  }

  useAuthStore.getState().markInitialized()
}

export function bootstrap(): Promise<void> {
  if (bootstrapped) return Promise.resolve()
  if (!bootstrapPromise) {
    bootstrapPromise = run()
      .catch(() => {
        // The storefront must remain usable when the API is unavailable; pages
        // render their own error/empty states.
      })
      .finally(() => {
        bootstrapped = true
        useAuthStore.getState().markInitialized()
      })
  }
  return bootstrapPromise
}

/** Test/dev helper: force the next call to bootstrap again. */
export function resetBootstrap() {
  bootstrapped = false
  bootstrapPromise = null
}
