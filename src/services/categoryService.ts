import type { Category, Paginated } from '@/types'
import { useCatalogStore } from '@/context/catalogStore'
import { api } from './apiClient'
import { mapCategory, paginate } from './mappers'

/** Category service — `/categories` and `/categories/{slug}`. */

export interface CategoryQuery {
  q?: string
  status?: Category['status']
  page?: number
  pageSize?: number
}

function remember(categories: Category[]) {
  const state = useCatalogStore.getState()
  const byId = new Map(state.categories.map((category) => [category.id, category]))
  categories.forEach((category) => byId.set(category.id, { ...byId.get(category.id), ...category }))
  state.setCategories(Array.from(byId.values()).sort((a, b) => a.sortOrder - b.sortOrder))
}

export async function listCategories(query: CategoryQuery = {}): Promise<Paginated<Category>> {
  const { page = 1, pageSize = 50, status, q } = query
  const response = await api.get<Record<string, unknown>[]>('/categories', { anonymous: true })
  let items = (response.data ?? []).map(mapCategory)

  remember(items)

  if (status) items = items.filter((category) => category.status === status)
  if (q) {
    const needle = q.toLowerCase()
    items = items.filter((category) => category.name.toLowerCase().includes(needle))
  }

  items = items.sort((a, b) => a.sortOrder - b.sortOrder)
  const total = items.length
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  try {
    const response = await api.get<Record<string, unknown>>(`/categories/${encodeURIComponent(slug)}`, {
      anonymous: true,
    })
    const category = mapCategory(response.data)
    remember([category])
    return category
  } catch {
    return undefined
  }
}

/** Active product counts keyed by category slug, from loaded catalogue data. */
export function countByCategory(): Record<string, number> {
  const counts: Record<string, number> = {}
  const { products, categories } = useCatalogStore.getState()

  categories.forEach((category) => {
    if (category.productCount !== undefined) counts[category.slug] = category.productCount
  })

  products
    .filter((product) => product.status === 'active')
    .forEach((product) => {
      if (!product.categorySlug) return
      if (counts[product.categorySlug] === undefined) {
        counts[product.categorySlug] = 0
      }
      counts[product.categorySlug] += 1
    })

  return counts
}
