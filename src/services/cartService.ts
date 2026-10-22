import type { Product, ProductVariant } from '@/types'
import { useAuthStore } from '@/context/authStore'
import { useCartStore, computeTotals, type Totals } from '@/context/cartStore'
import { useWishlistStore } from '@/context/wishlistStore'
import { api } from './apiClient'
import { mapCart } from './mappers'

/**
 * Cart & wishlist services.
 *
 * Authenticated shoppers use the server cart; guests keep a local cart that is
 * merged into the server cart at sign-in. Prices and availability shown here are
 * previews — the checkout transaction revalidates everything server-side.
 */

function isAuthenticated() {
  return useAuthStore.getState().session !== null
}

async function refreshFromResponse(payload: Record<string, unknown> | null) {
  const cart = mapCart(payload)
  useCartStore.getState().setCart(cart)
  return cart
}

export async function fetchCart() {
  if (!isAuthenticated()) {
    useCartStore.getState().setServerBacked(false)
    return mapCart(null)
  }
  const response = await api.get<Record<string, unknown>>('/cart')
  return refreshFromResponse(response.data)
}

/**
 * Push any locally-built guest lines to the server cart. Called once after a
 * successful sign-in, before the first authenticated render.
 */
export async function mergeGuestCart() {
  if (!isAuthenticated()) return
  const guestItems = useCartStore.getState().items.filter((item) => item.id === undefined)

  for (const item of guestItems) {
    try {
      await api.post<Record<string, unknown>>('/cart/items', {
        variant_id: item.variantId,
        quantity: item.quantity,
      })
    } catch {
      // A line that became unavailable should not block the rest of the merge.
    }
  }

  useCartStore.getState().clear()
  await fetchCart()
}

export async function addToCart(product: Product, variant: ProductVariant, quantity = 1) {
  if (!isAuthenticated()) {
    useCartStore.getState().addItem(product, variant, quantity)
    return useCartStore.getState().items
  }

  const response = await api.post<Record<string, unknown>>('/cart/items', {
    variant_id: variant.id,
    quantity,
  })
  await refreshFromResponse(response.data)
  return useCartStore.getState().items
}

export async function updateCartItem(variantId: number, quantity: number) {
  const state = useCartStore.getState()
  const item = state.items.find((line) => line.variantId === variantId)
  if (!item) return

  if (!isAuthenticated() || item.id === undefined) {
    state.updateQuantity(variantId, quantity)
    return
  }

  if (quantity <= 0) {
    await removeCartItem(variantId)
    return
  }

  const response = await api.patch<Record<string, unknown>>(`/cart/items/${item.id}`, { quantity })
  await refreshFromResponse(response.data)
}

export async function removeCartItem(variantId: number) {
  const state = useCartStore.getState()
  const item = state.items.find((line) => line.variantId === variantId)

  if (!isAuthenticated() || item?.id === undefined) {
    state.removeItem(variantId)
    return
  }

  const response = await api.delete<Record<string, unknown>>(`/cart/items/${item.id}`)
  await refreshFromResponse(response.data)
}

export async function clearCart() {
  if (isAuthenticated()) {
    await api.delete<null>('/cart')
  }
  useCartStore.getState().clear()
}

export interface CartQuote {
  items: ReturnType<typeof useCartStore.getState>['items']
  totals: Totals
}

/** Client-side preview only; checkout totals come from the server. */
export async function quoteCart(opts: { freeShipping?: boolean; shipping?: number } = {}): Promise<CartQuote> {
  const state = useCartStore.getState()
  const subtotal = state.subtotal()
  return {
    items: state.items,
    totals: computeTotals(subtotal, state.discount, opts),
  }
}

export interface CouponResult {
  ok: boolean
  coupon?: { code: string; discountType?: string; discountValue?: number }
  discount: number
  freeShipping?: boolean
  message: string
}

export async function applyCoupon(code: string): Promise<CouponResult> {
  if (!isAuthenticated()) {
    return { ok: false, discount: 0, message: 'Sign in to apply a coupon to your cart.' }
  }

  try {
    const response = await api.post<Record<string, unknown>>('/coupons/validate', {
      code,
      subtotal: useCartStore.getState().subtotal(),
    })
    const data = response.data ?? {}
    const discount = Number(data.discount ?? 0)
    const appliedCode = String(data.code ?? code)
    useCartStore.getState().applyCoupon(appliedCode, Number.isFinite(discount) ? discount : 0)
    return {
      ok: true,
      coupon: { code: appliedCode },
      discount: Number.isFinite(discount) ? discount : 0,
      freeShipping: Boolean(data.freeShipping),
      message: response.message || 'Coupon applied successfully.',
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'That coupon could not be applied.'
    return { ok: false, discount: 0, message }
  }
}

export function removeCoupon() {
  useCartStore.getState().removeCoupon()
}

/* -------------------------------- Wishlist -------------------------------- */

export async function fetchWishlist() {
  if (!isAuthenticated()) return
  const response = await api.get<Array<Record<string, unknown>>>('/customers/wishlist', {
    query: { per_page: 100 },
  })
  const entries = (response.data ?? [])
    .map((row) => ({
      productId: Number(row.productId ?? 0),
      addedAt: String(row.addedAt ?? new Date().toISOString()),
    }))
    .filter((entry) => entry.productId > 0)
  useWishlistStore.getState().setEntries(entries)
}

export async function toggleWishlist(productId: number) {
  const store = useWishlistStore.getState()
  const has = store.has(productId)

  if (isAuthenticated()) {
    if (has) {
      await api.delete<null>(`/customers/wishlist/${productId}`)
    } else {
      await api.post<Record<string, unknown>>('/customers/wishlist', { product_id: productId })
    }
  }

  store.toggle(productId)
  return !has
}

export async function addToWishlist(productId: number) {
  if (useWishlistStore.getState().has(productId)) return
  if (isAuthenticated()) {
    await api.post<Record<string, unknown>>('/customers/wishlist', { product_id: productId })
  }
  useWishlistStore.getState().add(productId)
}

export async function removeFromWishlist(productId: number) {
  if (isAuthenticated()) {
    await api.delete<null>(`/customers/wishlist/${productId}`)
  }
  useWishlistStore.getState().remove(productId)
}
