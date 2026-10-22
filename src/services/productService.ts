import type { Paginated, Product, SortKey } from '@/types'
import { useCatalogStore } from '@/context/catalogStore'
import { api, type ApiEnvelope } from './apiClient'
import { mapProduct, mapProductSummary, paginate } from './mappers'

/**
 * Product service — `/products` and `/products/{slug}`.
 *
 * The public list endpoint returns lightweight summaries (no variants), which is
 * enough for cards and grids. Opening a product hydrates the full record with
 * variants, images and option types and caches it for the detail page.
 */

export interface ProductQuery {
  q?: string
  /** Category slugs. */
  categories?: string[]
  minPrice?: number
  maxPrice?: number
  /** Variant option values, e.g. ["Black", "Sand"]. */
  colors?: string[]
  minRating?: number
  inStockOnly?: boolean
  brands?: string[]
  sellerIds?: number[]
  tags?: string[]
  sort?: SortKey
  page?: number
  pageSize?: number
  /** Public pages only ever show active products. */
  includeInactive?: boolean
}

/** Distinct colour/option values a product is sold in. */
export function productColors(product: Product) {
  const colors = new Set<string>()
  product.optionTypes
    .filter((option) => /colou?r|colour|finish|shade/i.test(option.name))
    .forEach((option) => option.values.forEach((v) => colors.add(v)))
  return Array.from(colors)
}

function rememberProducts(products: Product[]) {
  const state = useCatalogStore.getState()
  const byId = new Map(state.products.map((product) => [product.id, product]))
  products.forEach((product) => {
    const existing = byId.get(product.id)
    // Never replace a fully hydrated product with a summary.
    if (existing && existing.variants.length > 0 && product.variants.length === 0) return
    byId.set(product.id, existing && product.variants.length === 0 ? { ...existing, ...product } : product)
  })
  state.setProducts(Array.from(byId.values()))
}

function applyClientFilters(products: Product[], query: ProductQuery): Product[] {
  const needle = query.q?.trim().toLowerCase()

  return products.filter((product) => {
    if (needle) {
      const haystack = [
        product.name,
        product.brand,
        product.categoryName,
        product.shortDescription,
        product.description,
        ...(product.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    if (query.categories?.length) {
      const slugs = new Set(query.categories)
      if (!product.categorySlug || !slugs.has(product.categorySlug)) return false
    }
    if (query.brands?.length) {
      const brands = new Set(query.brands)
      if (!product.brand || !brands.has(product.brand)) return false
    }
    if (query.sellerIds?.length && !query.sellerIds.includes(product.sellerId)) return false
    if (query.tags?.length && !query.tags.some((tag) => (product.tags ?? []).includes(tag))) return false
    if (query.colors?.length) {
      const colors = productColors(product)
      if (!query.colors.some((color) => colors.includes(color))) return false
    }
    if (query.minPrice !== undefined && (product.minPrice ?? 0) < query.minPrice) return false
    if (query.maxPrice !== undefined && (product.minPrice ?? 0) > query.maxPrice) return false
    if (query.minRating !== undefined && product.rating < query.minRating) return false
    if (query.inStockOnly && (product.availableStock ?? 0) <= 0) return false
    return true
  })
}

function applyClientSort(products: Product[], sort: SortKey = 'popularity'): Product[] {
  const list = [...products]
  switch (sort) {
    case 'price-asc':
      return list.sort((a, b) => (a.minPrice ?? 0) - (b.minPrice ?? 0))
    case 'price-desc':
      return list.sort((a, b) => (b.maxPrice ?? 0) - (a.maxPrice ?? 0))
    case 'rating':
      return list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    case 'newest':
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case 'name-asc':
      return list.sort((a, b) => a.name.localeCompare(b.name))
    case 'popularity':
    default:
      return list.sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating)
  }
}

export async function queryProducts(query: ProductQuery = {}): Promise<Paginated<Product>> {
  const { page = 1, pageSize = 12, sort = 'popularity' } = query

  // The public API supports one category and one brand per request. When a
  // shopper selects several, fetch a wide page and finish filtering client-side
  // so the UI remains correct even though the endpoint is single-valued.
  const unsupported =
    (query.categories?.length ?? 0) > 1 ||
    (query.brands?.length ?? 0) > 1 ||
    (query.colors?.length ?? 0) > 0 ||
    (query.tags?.length ?? 0) > 0 ||
    (query.sellerIds?.length ?? 0) > 0

  let response: ApiEnvelope<Record<string, unknown>[]>
  try {
    response = await api.get<Record<string, unknown>[]>('/products', {
      anonymous: true,
      query: {
        q: query.q,
        category: query.categories?.[0],
        brand: query.brands?.[0],
        sort,
        min_price: query.minPrice,
        max_price: query.maxPrice,
        rating_min: query.minRating,
        in_stock: query.inStockOnly ? 1 : undefined,
        page: unsupported ? 1 : page,
        per_page: unsupported ? 60 : pageSize,
      },
    })
  } catch (error) {
    // Offline (or a temporary API failure): filter the catalogue that was
    // already loaded so storefront pages keep working instead of throwing an
    // unhandled promise rejection.
    const cached = useCatalogStore.getState().products.filter((product) => product.status === 'active')
    if (cached.length === 0) throw error

    const filtered = applyClientSort(applyClientFilters(cached, query), sort)
    const total = filtered.length
    const start = (Math.max(1, page) - 1) * pageSize
    return {
      items: filtered.slice(start, start + pageSize),
      total,
      page: Math.max(1, page),
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  }

  let items = (response.data ?? []).map(mapProductSummary)
  rememberProducts(items)

  if (unsupported) {
    const filtered = applyClientSort(applyClientFilters(items, query), sort)
    const total = filtered.length
    const start = (Math.max(1, page) - 1) * pageSize
    return {
      items: filtered.slice(start, start + pageSize),
      total,
      page: Math.max(1, page),
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  }

  return paginate(items, response.meta, pageSize)
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  try {
    const response = await api.get<Record<string, unknown>>(`/products/${encodeURIComponent(slug)}`, {
      anonymous: true,
    })
    const product = mapProduct(response.data)
    useCatalogStore.getState().upsertProduct(product)
    return product
  } catch {
    return undefined
  }
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  if (product.categorySlug) {
    const same = await queryProducts({
      categories: [product.categorySlug],
      sort: 'popularity',
      pageSize: limit + 1,
    })
    const filtered = same.items.filter((item) => item.id !== product.id).slice(0, limit)
    if (filtered.length >= limit) return filtered
    const fallback = await queryProducts({ sort: 'popularity', pageSize: limit + 1 })
    return [...filtered, ...fallback.items.filter((item) => item.id !== product.id)].slice(0, limit)
  }

  const fallback = await queryProducts({ sort: 'popularity', pageSize: limit + 1 })
  return fallback.items.filter((item) => item.id !== product.id).slice(0, limit)
}

export interface SearchSuggestion {
  type: 'product' | 'category' | 'term'
  label: string
  sublabel?: string
  href: string
  imageUrl?: string
}

/** Lightweight suggestion list for the header search box. */
export async function getSearchSuggestions(term: string): Promise<SearchSuggestion[]> {
  const q = term.trim()
  if (q.length < 2) return []

  const [productResult, categories] = await Promise.all([
    queryProducts({ q, pageSize: 5, sort: 'popularity' }),
    Promise.resolve(useCatalogStore.getState().categories),
  ])

  const suggestions: SearchSuggestion[] = []

  categories
    .filter((category) => category.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 2)
    .forEach((category) =>
      suggestions.push({
        type: 'category',
        label: category.name,
        sublabel: 'Category',
        href: `/categories/${category.slug}`,
      }),
    )

  productResult.items.slice(0, 5).forEach((product) =>
    suggestions.push({
      type: 'product',
      label: product.name,
      sublabel: product.categoryName,
      href: `/product/${product.slug}`,
      imageUrl: product.primaryImage ?? product.images[0]?.imageUrl,
    }),
  )

  return suggestions
}

/** Facets for the filter sidebar, computed from the cached catalogue. */
export function getFilterFacets() {
  const products = useCatalogStore.getState().products.filter((p) => p.status === 'active')
  const colors = new Set<string>()
  const brandSet = new Set<string>()
  products.forEach((product) => {
    productColors(product).forEach((color) => colors.add(color))
    if (product.brand) brandSet.add(product.brand)
  })

  const prices = products.map((product) => product.minPrice ?? 0).filter((price) => price > 0)
  const max = products.map((product) => product.maxPrice ?? product.minPrice ?? 0).filter((price) => price > 0)

  return {
    colors: Array.from(colors).sort(),
    brands: Array.from(brandSet).sort(),
    priceMin: prices.length ? Math.floor(Math.min(...prices) / 10_000) * 10_000 : 0,
    priceMax: max.length ? Math.ceil(Math.max(...max) / 100_000) * 100_000 : 5_000_000,
  }
}

/** Products sharing a tag. Tags are a client-side concept in the current API. */
export async function getProductsByTag(tag: string, limit = 8): Promise<Product[]> {
  const result = await queryProducts({ tags: [tag], pageSize: limit, sort: 'popularity' })
  return result.items
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  const result = await queryProducts({ sort: 'newest', pageSize: limit })
  return result.items
}

export async function getBestSellers(limit = 8): Promise<Product[]> {
  const result = await queryProducts({ sort: 'popularity', pageSize: limit })
  return result.items
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const result = await queryProducts({ sort: 'rating', minRating: 4, pageSize: limit })
  return result.items
}

/** Price range helper shared by cards and filters. */
export function minPriceOf(product: Product): number {
  if (product.minPrice != null) return product.minPrice
  const prices = product.variants.map((variant) => variant.price).filter((price) => price > 0)
  return prices.length > 0 ? Math.min(...prices) : 0
}
