import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  Banner,
  Category,
  Coupon,
  Product,
  ProductOptionType,
  ProductStatus,
  Review,
} from '@/types'

/**
 * Catalogue cache.
 *
 * This store holds no seed data. It is a read-through cache populated
 * by the service layer from the PHP API, so components can keep selecting the
 * same state while every value originates at the server.
 */

export interface ProductFormValues {
  name: string
  categoryId: number
  shortDescription: string
  description: string
  brand: string
  conditionType: Product['conditionType']
  status: ProductStatus
  /** Uploaded image URLs; first is primary. */
  images: string[]
  price: number
  compareAtPrice?: number | null
  sku: string
  stock: number
  lowStockThreshold?: number
  options: ProductOptionType[]
  sellerId: number
}

interface CatalogState {
  products: Product[]
  categories: Category[]
  coupons: Coupon[]
  banners: Banner[]
  reviews: Review[]

  setProducts: (products: Product[]) => void
  upsertProduct: (product: Product) => void
  removeProduct: (id: number) => void

  setCategories: (categories: Category[]) => void
  upsertCategory: (category: Category) => void
  removeCategory: (id: number) => void

  setCoupons: (coupons: Coupon[]) => void
  upsertCoupon: (coupon: Coupon) => void
  removeCoupon: (id: number) => void

  setBanners: (banners: Banner[]) => void
  upsertBanner: (banner: Banner) => void
  removeBanner: (id: number) => void

  setReviews: (reviews: Review[]) => void
  upsertReview: (review: Review) => void
  removeReview: (id: number) => void

  setProductStatus: (id: number, status: ProductStatus, reason?: string) => void
  adjustStock: (variantId: number, delta: number) => void
  setVariantStock: (variantId: number, stock: number) => void
}

function replaceById<T extends { id: number }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id)
  if (index === -1) return [next, ...items]
  const copy = [...items]
  copy[index] = next
  return copy
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  categories: [],
  coupons: [],
  banners: [],
  reviews: [],

  setProducts(products) {
    set({ products })
  },

  upsertProduct(product) {
    set({ products: replaceById(get().products, product) })
  },

  removeProduct(id) {
    set({ products: get().products.filter((product) => product.id !== id) })
  },

  setCategories(categories) {
    set({ categories })
  },

  upsertCategory(category) {
    set({ categories: replaceById(get().categories, category) })
  },

  removeCategory(id) {
    set({ categories: get().categories.filter((category) => category.id !== id) })
  },

  setCoupons(coupons) {
    set({ coupons })
  },

  upsertCoupon(coupon) {
    set({ coupons: replaceById(get().coupons, coupon) })
  },

  removeCoupon(id) {
    set({ coupons: get().coupons.filter((coupon) => coupon.id !== id) })
  },

  setBanners(banners) {
    set({ banners })
  },

  upsertBanner(banner) {
    set({ banners: replaceById(get().banners, banner) })
  },

  removeBanner(id) {
    set({ banners: get().banners.filter((banner) => banner.id !== id) })
  },

  setReviews(reviews) {
    set({ reviews })
  },

  upsertReview(review) {
    set({ reviews: replaceById(get().reviews, review) })
  },

  removeReview(id) {
    set({ reviews: get().reviews.filter((review) => review.id !== id) })
  },

  setProductStatus(id, status, reason) {
    set({
      products: get().products.map((product) =>
        product.id === id
          ? {
              ...product,
              status,
              rejectionReason: status === 'rejected' ? (reason ?? product.rejectionReason ?? null) : null,
              updatedAt: new Date().toISOString(),
            }
          : product,
      ),
    })
  },

  adjustStock(variantId, delta) {
    set({
      products: get().products.map((product) => ({
        ...product,
        variants: product.variants.map((variant) =>
          variant.id === variantId
            ? { ...variant, stock: Math.max(0, variant.stock + delta) }
            : variant,
        ),
      })),
    })
  },

  setVariantStock(variantId, stock) {
    set({
      products: get().products.map((product) => ({
        ...product,
        variants: product.variants.map((variant) =>
          variant.id === variantId ? { ...variant, stock: Math.max(0, stock) } : variant,
        ),
      })),
    })
  },
}))

/* -------------------------------------------------------------------------- */
/* Selectors                                                                   */
/* -------------------------------------------------------------------------- */

export function useProducts() {
  return useCatalogStore((s) => s.products)
}

export function useCategories() {
  return useCatalogStore((s) => s.categories)
}

export function useActiveProducts() {
  return useCatalogStore(useShallow((s) => s.products.filter((p) => p.status === 'active')))
}

export function useProductBySlug(slug: string | undefined) {
  return useCatalogStore((s) => s.products.find((p) => p.slug === slug))
}

export function useProductById(id: number | null | undefined) {
  return useCatalogStore((s) => (id == null ? undefined : s.products.find((p) => p.id === id)))
}

export function useSellerProducts(sellerId: number | null | undefined) {
  return useCatalogStore(
    useShallow((s) => (sellerId == null ? [] : s.products.filter((p) => p.sellerId === sellerId))),
  )
}

/** Counts per category slug, used by the category page and admin table. */
export function useCategoryCounts() {
  return useCatalogStore(
    useShallow((s) => {
      const counts: Record<string, number> = {}
      s.categories.forEach((category) => {
        if (category.productCount !== undefined) counts[category.slug] = category.productCount
      })
      s.products.forEach((p) => {
        if (!p.categorySlug || p.status !== 'active') return
        if (counts[p.categorySlug] === undefined) counts[p.categorySlug] = 0
        counts[p.categorySlug] += 1
      })
      return counts
    }),
  )
}
