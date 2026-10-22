import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product, ProductVariant } from '@/types'
import type { CartPayload } from '@/services/mappers'

/**
 * Cart state.
 *
 * Authenticated shoppers use the server cart (PTCH/DELETE `/cart/items/{id}`).
 * Guests keep a local cart, persisted so it survives a refresh, which is merged
 * into the server cart on sign-in. No product or price data is duplicated: lines are
 * either built from a live product response or hydrated from `/cart`.
 */

interface CartState {
  items: CartItem[]
  couponCode: string | null
  discount: number
  /** True when the store mirrors the authenticated server cart. */
  serverBacked: boolean

  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void
  setItems: (items: CartItem[]) => void
  setCart: (payload: CartPayload) => void
  updateQuantity: (variantId: number, quantity: number) => void
  removeItem: (variantId: number) => void
  clear: () => void
  applyCoupon: (code: string, discount: number) => void
  removeCoupon: () => void
  count: () => number
  subtotal: () => number
  hasItem: (variantId: number) => boolean
  setServerBacked: (value: boolean) => void
}

function imageOf(product: Product): string {
  return (
    product.images.find((image) => image.isPrimary)?.imageUrl ??
    product.images[0]?.imageUrl ??
    product.primaryImage ??
    ''
  )
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      discount: 0,
      serverBacked: false,

      addItem(product, variant, quantity = 1) {
        const { items } = get()
        const existing = items.find((item) => item.variantId === variant.id)
        const maxStock = Math.max(1, variant.stock)

        if (existing) {
          set({
            items: items.map((item) =>
              item.variantId === variant.id
                ? { ...item, quantity: Math.min(item.quantity + quantity, maxStock) }
                : item,
            ),
          })
          return
        }

        const line: CartItem = {
          id: undefined,
          variantId: variant.id,
          productId: product.id,
          name: product.name,
          slug: product.slug,
          imageUrl: imageOf(product),
          variantName: variant.variantName,
          sku: variant.sku,
          unitPrice: variant.price,
          compareAtPrice: variant.compareAtPrice,
          quantity: Math.min(quantity, maxStock),
          stock: maxStock,
          options: variant.options ?? {},
          sellerId: product.sellerId,
          sellerName: product.sellerName,
        }
        set({ items: [...items, line] })
      },

      setItems(items) {
        set({ items })
      },

      setCart(payload) {
        set({
          items: payload.items,
          serverBacked: true,
        })
      },

      updateQuantity(variantId, quantity) {
        set({
          items: get().items.map((item) =>
            item.variantId === variantId
              ? { ...item, quantity: Math.max(1, Math.min(quantity, Math.max(1, item.stock))) }
              : item,
          ),
        })
      },

      removeItem(variantId) {
        set({ items: get().items.filter((item) => item.variantId !== variantId) })
      },

      clear() {
        set({ items: [], couponCode: null, discount: 0, serverBacked: false })
      },

      applyCoupon(code, discount) {
        set({ couponCode: code, discount })
      },

      removeCoupon() {
        set({ couponCode: null, discount: 0 })
      },

      count() {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },

      subtotal() {
        return get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
      },

      hasItem(variantId) {
        return get().items.some((item) => item.variantId === variantId)
      },

      setServerBacked(value) {
        set({ serverBacked: value })
      },
    }),
    {
      name: 'shopio.cart',
      partialize: (state) => ({
        items: state.items.filter((item) => item.id === undefined),
        couponCode: state.couponCode,
        discount: state.discount,
      }),
    },
  ),
)

/** Convenience hooks used across the storefront. */
export function useCartCount() {
  return useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0))
}

export function useCartSubtotal() {
  return useCartStore((s) => s.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))
}

/* -------------------------------------------------------------------------- */
/* Order totals — mirrors the `v_order_totals` view                            */
/* -------------------------------------------------------------------------- */

export const VAT_RATE = 0.18
export const FREE_SHIPPING_THRESHOLD = 1_000_000
export const BASE_SHIPPING = 25_000

export interface Totals {
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
}

export function computeTotals(
  subtotal: number,
  discount = 0,
  opts: { shipping?: number; freeShipping?: boolean; vatRate?: number } = {},
): Totals {
  const { vatRate = VAT_RATE } = opts
  const taxable = Math.max(0, subtotal - discount)
  const shipping =
    opts.freeShipping || subtotal >= FREE_SHIPPING_THRESHOLD
      ? 0
      : (opts.shipping ?? (subtotal > 0 ? BASE_SHIPPING : 0))
  const tax = Math.round(taxable * vatRate)
  return {
    subtotal,
    discount,
    shipping,
    tax,
    total: taxable + shipping + tax,
  }
}
