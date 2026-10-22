import type { Banner, Product, Seller } from '@/types'
import { useCatalogStore } from '@/context/catalogStore'
import { usePeopleStore } from '@/context/peopleStore'
import { api } from './apiClient'
import { mapBanner, mapProductSummary, mapSeller } from './mappers'

/** Public catalogue reads that populate global caches. */

export async function fetchBanners(placement?: Banner['placement']): Promise<Banner[]> {
  const response = await api.get<Record<string, unknown>[]>('/banners', {
    anonymous: true,
    query: { placement },
  })
  const banners = (response.data ?? []).map(mapBanner)
  useCatalogStore.getState().setBanners(banners)
  return banners
}

export async function fetchStore(slug: string): Promise<Seller | undefined> {
  try {
    const response = await api.get<Record<string, unknown>>(`/stores/${encodeURIComponent(slug)}`, {
      anonymous: true,
    })
    const seller = mapSeller(response.data)
    usePeopleStore.getState().upsertSeller(seller)
    return seller
  } catch {
    return undefined
  }
}

/** Warm the catalogue cache (used for facets and suggestions). */
export async function fetchCatalogue(perPage = 60): Promise<Product[]> {
  const response = await api.get<Record<string, unknown>[]>('/products', {
    anonymous: true,
    query: { per_page: perPage, sort: 'popularity' },
  })
  const products = (response.data ?? []).map(mapProductSummary)

  // Keep any fully hydrated detail records. Bootstrap can finish after the
  // product page has already fetched its variants; replacing the store with
  // summaries would empty the variant selector and stock state.
  const state = useCatalogStore.getState()
  const merged = new Map(products.map((product) => [product.id, product]))
  state.products.forEach((existing) => {
    const fresh = merged.get(existing.id)
    if (fresh && existing.variants.length > 0 && fresh.variants.length === 0) {
      merged.set(existing.id, existing)
    }
  })
  state.setProducts(Array.from(merged.values()))
  return products
}
