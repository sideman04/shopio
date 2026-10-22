import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  EyeOff,
  Flag,
  MessageSquare,
  MoreHorizontal,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Stars,
  StatCard,
  Tabs,
  Textarea,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { reviewService } from '@/services'
import { useCatalogStore } from '@/context/catalogStore'
import { toast } from '@/context/uiStore'
import type { Review } from '@/types'
import { formatDate, truncate } from '@/lib/utils'

const PAGE_SIZE = 6

const STATUS_TONES: Record<Review['status'], 'success' | 'warning' | 'neutral' | 'danger'> = {
  published: 'success',
  pending: 'warning',
  hidden: 'neutral',
  rejected: 'danger',
}

const TABS: Array<{ id: string; label: string; match: (r: Review) => boolean }> = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'pending', label: 'Pending', match: (r) => r.status === 'pending' },
  { id: 'published', label: 'Published', match: (r) => r.status === 'published' },
  { id: 'hidden', label: 'Hidden', match: (r) => r.status === 'hidden' },
  { id: 'reported', label: 'Reported', match: (r) => !!r.reported },
]

/** Review moderation queue with reporting, replies and bulk actions. */
export default function AdminReviewsPage() {
  const reviews = useCatalogStore((s) => s.reviews)

  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [rating, setRating] = useState('all')
  const [product, setProduct] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

  const [readReview, setReadReview] = useState<Review | null>(null)
  const [replyReview, setReplyReview] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)
  const [bulk, setBulk] = useState<Review['status'] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [tab, search, rating, product])

  useEffect(() => {
    void Promise.allSettled([
      reviewService.fetchAdminReviews({ pageSize: 100 }),
      reviewService.fetchReviewReports(),
    ])
  }, [])

  const products = useMemo(() => {
    const map = new Map<number, string>()
    reviews.forEach((r) => {
      if (r.productName) map.set(r.productId, r.productName)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [reviews])

  const counts = useMemo(
    () => ({
      all: reviews.length,
      pending: reviews.filter((r) => r.status === 'pending').length,
      published: reviews.filter((r) => r.status === 'published').length,
      hidden: reviews.filter((r) => r.status === 'hidden').length,
      reported: reviews.filter((r) => r.reported).length,
    }),
    [reviews],
  )

  const averageRating = useMemo(
    () => (reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0),
    [reviews],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const activeTab = TABS.find((t) => t.id === tab)
    return reviews
      .filter((review) => {
        if (activeTab && !activeTab.match(review)) return false
        if (rating !== 'all' && review.rating !== Number(rating)) return false
        if (product !== 'all' && String(review.productId) !== product) return false
        if (needle) {
          const haystack = [review.customerName ?? '', review.productName ?? '', review.title ?? '', review.reviewText ?? '']
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [reviews, tab, rating, product, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const toggleOne = (id: number) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  const moderate = async (review: Review, status: Review['status']) => {
    await reviewService.moderateReview(review.id, status)
    toast.success(`Review ${status}`, `${review.customerName ?? 'Review'} on ${review.productName ?? 'product'}.`)
  }

  const openReply = (review: Review) => {
    setReplyReview(review)
    setReplyText(review.sellerReply ?? '')
  }

  const saveReply = async () => {
    if (!replyReview) return
    if (!replyText.trim()) {
      toast.error('Reply cannot be empty', 'Write a short response before saving.')
      return
    }
    setBusy(true)
    try {
      await reviewService.replyToReview(replyReview.id, replyText.trim())
      toast.success('Reply published', `Your reply to ${replyReview.customerName ?? 'the customer'} is now visible.`)
      setReplyReview(null)
      setReplyText('')
    } finally {
      setBusy(false)
    }
  }

  const dismissReport = async (review: Review) => {
    try {
      await reviewService.moderateReview(review.id, 'published')
      useCatalogStore.setState((s) => ({
        reviews: s.reviews.map((r) => (r.id === review.id ? { ...r, reported: false, reportReason: null } : r)),
      }))
      toast.success('Report dismissed', 'The review was kept and the report was cleared.')
    } catch (error) {
      toast.error('Could not dismiss report', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const remove = async (review: Review) => {
    try {
      await reviewService.moderateReview(review.id, 'rejected', 'Removed by administrator')
      toast.success('Review removed', 'The review is no longer visible in the storefront.')
      setDeleteTarget(null)
      setSelected((current) => current.filter((id) => id !== review.id))
    } catch (error) {
      toast.error('Review not removed', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const runBulk = async () => {
    if (!bulk) return
    setBusy(true)
    try {
      await Promise.all(selected.map((id) => reviewService.moderateReview(id, bulk)))
      toast.success('Reviews updated', `${selected.length} review(s) set to ${bulk}.`)
      setBulk(null)
      setSelected([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" description="Moderate customer feedback, respond to reviews and resolve reports." />

      <section aria-label="Review summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total reviews" value={String(counts.all)} icon={<MessageSquare className="h-4 w-4" />} hint="all products" />
        <StatCard label="Published" value={String(counts.published)} icon={<Check className="h-4 w-4" />} hint="visible" />
        <StatCard label="Pending" value={String(counts.pending)} icon={<Star className="h-4 w-4" />} hint="awaiting moderation" />
        <StatCard label="Reported" value={String(counts.reported)} icon={<Flag className="h-4 w-4" />} hint="flagged by shoppers" />
        <StatCard label="Average rating" value={`${averageRating.toFixed(1)} / 5`} icon={<Star className="h-4 w-4" />} hint="across all reviews" />
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        items={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          badge: (
            <Badge tone={t.id === 'reported' ? 'danger' : t.id === 'pending' ? 'warning' : 'neutral'} size="sm">
              {counts[t.id as keyof typeof counts]}
            </Badge>
          ),
        }))}
      />

      <div className="rounded-card border border-ink-200 bg-white shadow-card">
        <DataToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search product, reviewer or text">
          <label className="sr-only" htmlFor="reviews-rating-filter">Rating</label>
          <Select
            id="reviews-rating-filter"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            options={[
              { label: 'All ratings', value: 'all' },
              { label: '5 stars', value: '5' },
              { label: '4 stars', value: '4' },
              { label: '3 stars', value: '3' },
              { label: '2 stars', value: '2' },
              { label: '1 star', value: '1' },
            ]}
            className="w-36"
          />
          <label className="sr-only" htmlFor="reviews-product-filter">Product</label>
          <Select
            id="reviews-product-filter"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            options={[{ label: 'All products', value: 'all' }, ...products.map((p) => ({ label: truncate(p.name, 40), value: String(p.id) }))]}
            className="w-56"
          />
        </DataToolbar>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 bg-sand-50 px-4 py-3">
            <p className="text-sm font-medium text-ink">{selected.length} selected</p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setBulk('published')}>
                Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulk('hidden')}>
                Hide
              </Button>
              <Button size="sm" variant="danger" onClick={() => setBulk('rejected')}>
                Reject
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4 p-4">
          {paged.length === 0 ? (
            <EmptyState size="sm" icon={<MessageSquare className="h-5 w-5" />} title="No reviews in this view" description="Adjust the tab or filters." />
          ) : (
            paged.map((review) => (
              <article key={review.id} className="rounded-card border border-ink-200 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.includes(review.id)}
                    onChange={() => toggleOne(review.id)}
                    aria-label={`Select review by ${review.customerName ?? 'customer'}`}
                    className="mt-1"
                  />
                  <Avatar name={review.customerName ?? 'Customer'} src={review.customerAvatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{review.customerName ?? 'Customer'}</p>
                      <Stars rating={review.rating} size="sm" />
                      <Badge tone={STATUS_TONES[review.status]} size="sm">
                        {review.status}
                      </Badge>
                      {review.reported && (
                        <Badge tone="danger" size="sm" icon={<Flag className="h-3 w-3" />}>
                          Reported
                        </Badge>
                      )}
                    </div>
                    {review.title && <p className="mt-1.5 text-sm font-medium text-ink">{review.title}</p>}
                    <p className="mt-1 text-sm text-ink-600">{truncate(review.reviewText ?? '', 180)}</p>
                    {review.reviewText && review.reviewText.length > 180 && (
                      <button
                        type="button"
                        onClick={() => setReadReview(review)}
                        className="mt-1 text-xs font-medium text-ink underline underline-offset-2"
                      >
                        Read more
                      </button>
                    )}
                    {review.reported && review.reportReason && (
                      <p className="mt-2 text-xs text-danger-700">
                        <span className="font-medium">Report reason:</span> {review.reportReason}
                      </p>
                    )}
                    {review.sellerReply && (
                      <div className="mt-3 rounded-lg border-l-2 border-ink-300 bg-ink-50/60 px-3 py-2">
                        <p className="text-xs font-medium text-ink-500">Seller reply</p>
                        <p className="mt-0.5 text-sm text-ink-700">{review.sellerReply}</p>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-ink-500">
                      {review.productName ?? 'Product'} · {formatDate(review.createdAt)}
                    </p>
                  </div>
                  <Dropdown
                    label="Review actions"
                    trigger={
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    }
                    items={[
                      { label: 'Publish', icon: <Check className="h-4 w-4" />, onClick: () => moderate(review, 'published') },
                      { label: 'Hide', icon: <EyeOff className="h-4 w-4" />, onClick: () => moderate(review, 'hidden') },
                      { label: 'Reject', icon: <X className="h-4 w-4" />, onClick: () => moderate(review, 'rejected') },
                      { label: 'Reply', icon: <MessageSquare className="h-4 w-4" />, divider: true, onClick: () => openReply(review) },
                      ...(review.reported ? [{ label: 'Dismiss report', icon: <Check className="h-4 w-4" />, onClick: () => dismissReport(review) }] : []),
                      { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, tone: 'danger' as const, divider: true, onClick: () => setDeleteTarget(review) },
                    ]}
                  />
                </div>
              </article>
            ))
          )}
        </div>

        <div className="p-4">
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </div>
      </div>

      {/* Read more */}
      <Modal open={!!readReview} onClose={() => setReadReview(null)} title="Review" size="md">
        {readReview && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar name={readReview.customerName ?? 'Customer'} src={readReview.customerAvatar} size="sm" />
              <div>
                <p className="text-sm font-medium text-ink">{readReview.customerName ?? 'Customer'}</p>
                <Stars rating={readReview.rating} size="sm" />
              </div>
            </div>
            {readReview.title && <p className="text-base font-semibold text-ink">{readReview.title}</p>}
            <p className="text-sm leading-relaxed text-ink-700">{readReview.reviewText}</p>
            <p className="text-xs text-ink-500">
              {readReview.productName ?? 'Product'} · {formatDate(readReview.createdAt, 'long')}
            </p>
          </div>
        )}
      </Modal>

      {/* Reply */}
      <Modal
        open={!!replyReview}
        onClose={() => setReplyReview(null)}
        title="Reply to review"
        description={replyReview ? `Replying to ${replyReview.customerName ?? 'the customer'}.` : undefined}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setReplyReview(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveReply} loading={busy}>
              Publish reply
            </Button>
          </>
        }
      >
        <Textarea label="Your reply" value={replyText} onChange={(e) => setReplyText(e.target.value)} required />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        title="Delete this review?"
        description="The review is permanently removed."
        confirmLabel="Delete"
        tone="danger"
      />

      <ConfirmDialog
        open={!!bulk}
        onClose={() => setBulk(null)}
        onConfirm={runBulk}
        title={`Set ${selected.length} review(s) to ${bulk ?? ''}?`}
        description="This updates the moderation status of the selected reviews."
        confirmLabel="Apply"
        loading={busy}
      />
    </div>
  )
}
