import type { Paginated, Review } from '@/types'
import { useAuthStore } from '@/context/authStore'
import { useCatalogStore } from '@/context/catalogStore'
import { api } from './apiClient'
import { mapReview, paginate } from './mappers'

/** Review service — public reviews plus seller replies and admin moderation. */

export interface ReviewInput {
  productId: number
  rating: number
  title: string
  reviewText: string
  productName?: string
  orderItemId?: number | null
}

export interface ReviewQuery {
  status?: Review['status']
  rating?: number
  q?: string
  page?: number
  pageSize?: number
}

function cache(reviews: Review[]) {
  const store = useCatalogStore.getState()
  const byId = new Map(store.reviews.map((review) => [review.id, review]))
  reviews.forEach((review) => byId.set(review.id, review))
  store.setReviews(Array.from(byId.values()))
}

export async function submitReview(input: ReviewInput): Promise<Review> {
  const response = await api.post<Record<string, unknown>>(`/products/${input.productId}/reviews`, {
    rating: input.rating,
    title: input.title || null,
    review_text: input.reviewText || null,
    order_item_id: input.orderItemId ?? null,
  })
  const review = mapReview(response.data)
  useCatalogStore.getState().upsertReview(review)
  return review
}

export async function replyToReview(reviewId: number, reply: string): Promise<Review> {
  const response = await api.post<Record<string, unknown>>(`/sellers/reviews/${reviewId}/reply`, { reply })
  const review = mapReview(response.data)
  useCatalogStore.getState().upsertReview(review)
  return review
}

export async function moderateReview(reviewId: number, status: Review['status'], note?: string): Promise<Review> {
  const response = await api.patch<Record<string, unknown>>(`/admin/reviews/${reviewId}`, {
    status,
    note: note ?? null,
  })
  const review = mapReview(response.data)
  useCatalogStore.getState().upsertReview(review)
  return review
}

export async function reportReview(reviewId: number, reason: string) {
  await api.post<null>(`/reviews/${reviewId}/report`, { reason })
}

export async function fetchProductReviews(
  slug: string,
  opts: { rating?: number; page?: number; pageSize?: number } = {},
): Promise<Paginated<Review>> {
  const { page = 1, pageSize = 10 } = opts
  const response = await api.get<Record<string, unknown>[]>(
    `/products/${encodeURIComponent(slug)}/reviews`,
    { anonymous: true, query: { rating: opts.rating, page, per_page: pageSize } },
  )
  const items = (response.data ?? []).map(mapReview)
  cache(items)
  return paginate(items, response.meta, pageSize)
}

export async function fetchSellerReviews(query: ReviewQuery = {}): Promise<Paginated<Review>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/sellers/reviews', {
    query: { status: query.status, rating: query.rating, q: query.q, page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapReview)
  cache(items)
  return paginate(items, response.meta, pageSize)
}

export async function fetchAdminReviews(query: ReviewQuery = {}): Promise<Paginated<Review>> {
  const { page = 1, pageSize = 20 } = query
  const response = await api.get<Record<string, unknown>[]>('/admin/reviews', {
    query: { status: query.status, q: query.q, page, per_page: pageSize },
  })
  const items = (response.data ?? []).map(mapReview)
  cache(items)
  return paginate(items, response.meta, pageSize)
}

export interface ReviewReport {
  id: number
  reviewId: number
  reason: string
  status: 'open' | 'reviewing' | 'dismissed' | 'action_taken'
  reportedBy?: string
  createdAt: string
  review?: Review
}

export async function fetchReviewReports(): Promise<ReviewReport[]> {
  const response = await api.get<Array<Record<string, unknown>>>('/admin/reviews/reports', {
    query: { per_page: 100 },
  })
  return (response.data ?? []).map((row) => ({
    id: Number(row.id ?? 0),
    reviewId: Number(row.reviewId ?? row.review_id ?? 0),
    reason: String(row.reason ?? ''),
    status: (row.status ?? 'open') as ReviewReport['status'],
    reportedBy: row.reportedBy ? String(row.reportedBy) : undefined,
    createdAt: String(row.createdAt ?? row.created_at ?? ''),
    review: row.review && typeof row.review === 'object' ? mapReview(row.review as Record<string, unknown>) : undefined,
  }))
}

export async function resolveReviewReport(id: number, status: ReviewReport['status']) {
  const response = await api.patch<Record<string, unknown>>(`/admin/reviews/reports/${id}`, { status })
  return response.data
}

export function reviewsForProduct(productId: number) {
  return useCatalogStore.getState().reviews.filter((review) => review.productId === productId)
}

export function publishedReviewsForProduct(productId: number) {
  return useCatalogStore
    .getState()
    .reviews.filter((review) => review.productId === productId && review.status === 'published')
}

export function reportedReviews() {
  return useCatalogStore.getState().reviews.filter((review) => review.reported)
}

/** Reviews written by the signed-in customer that are cached locally. */
export async function fetchMyReviews(): Promise<Review[]> {
  const user = useAuthStore.getState().session?.user
  if (!user) return []
  return useCatalogStore.getState().reviews.filter((review) => review.userId === user.id)
}
