import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag, MessageSquare, Star } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Stars,
  Textarea,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { useAuthStore, useCatalogStore, useSellerProducts } from '@/context'
import { toast } from '@/context/uiStore'
import { reviewService, sellerService } from '@/services'
import type { Review } from '@/types'
import { formatNumber, relativeTime } from '@/lib/utils'

const PAGE_SIZE = 6

const RATING_OPTIONS = [
  { label: 'All ratings', value: 'all' },
  { label: '5 stars', value: '5' },
  { label: '4 stars', value: '4' },
  { label: '3 stars', value: '3' },
  { label: '2 stars', value: '2' },
  { label: '1 star', value: '1' },
]

const RESPONDED_OPTIONS = [
  { label: 'All reviews', value: 'all' },
  { label: 'Awaiting reply', value: 'awaiting' },
  { label: 'Replied', value: 'replied' },
]

const REPORT_REASONS = [
  { label: 'Spam or promotional content', value: 'Spam or promotional content' },
  { label: 'Offensive language', value: 'Offensive language' },
  { label: 'Contains misleading claims', value: 'Contains misleading claims' },
  { label: 'Not a genuine review', value: 'Not a genuine review' },
  { label: 'Other', value: 'Other' },
]

function statusTone(status: Review['status']): 'success' | 'warning' | 'neutral' | 'danger' {
  if (status === 'published') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'neutral'
}

export default function SellerReviewsPage() {
  const user = useAuthStore((s) => s.session?.user)
  const sellerId = user?.sellerId ?? null
  const products = useSellerProducts(sellerId)

  useEffect(() => {
    if (!sellerId) return
    void Promise.allSettled([
      sellerService.fetchSellerProducts({ pageSize: 100 }),
      reviewService.fetchSellerReviews({ pageSize: 100 }),
    ])
  }, [sellerId])
  const reviews = useCatalogStore((s) => s.reviews)

  const [search, setSearch] = useState('')
  const [rating, setRating] = useState('all')
  const [responded, setResponded] = useState('all')
  const [page, setPage] = useState(1)

  const [replyTarget, setReplyTarget] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState('')
  const [savingReply, setSavingReply] = useState(false)

  const [reportTarget, setReportTarget] = useState<Review | null>(null)
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value)

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const sellerReviews = useMemo(
    () =>
      reviews
        .filter((review) => productById.has(review.productId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reviews, productById],
  )

  const averageRating = sellerReviews.length
    ? sellerReviews.reduce((total, review) => total + review.rating, 0) / sellerReviews.length
    : 0

  const breakdown = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((star) => {
        const count = sellerReviews.filter((review) => review.rating === star).length
        return {
          star,
          count,
          percent: sellerReviews.length ? Math.round((count / sellerReviews.length) * 100) : 0,
        }
      }),
    [sellerReviews],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return sellerReviews.filter((review) => {
      if (rating !== 'all' && review.rating !== Number(rating)) return false
      if (responded === 'awaiting' && review.sellerReply) return false
      if (responded === 'replied' && !review.sellerReply) return false
      if (needle) {
        const haystack = `${review.productName ?? ''} ${review.customerName ?? ''} ${review.title ?? ''}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [sellerReviews, search, rating, responded])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const openReply = (review: Review) => {
    setReplyTarget(review)
    setReplyText(review.sellerReply ?? '')
  }

  const saveReply = async () => {
    if (!replyTarget || !replyText.trim()) {
      toast.error('Reply required', 'Write a short reply before saving.')
      return
    }
    setSavingReply(true)
    await reviewService.replyToReview(replyTarget.id, replyText.trim())
    setSavingReply(false)
    toast.success('Reply published', 'Your response is now visible on the product page.')
    setReplyTarget(null)
  }

  const submitReport = async () => {
    if (!reportTarget) return
    try {
      await reviewService.reportReview(reportTarget.id, reportReason)
      toast.success('Review reported', 'The review was sent to Shopio moderation.')
      setReportTarget(null)
    } catch (error) {
      toast.error('Report not sent', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Respond to customer feedback and report content that breaks the rules."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardBody className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="text-4xl font-bold text-ink">{averageRating.toFixed(1)}</p>
            <Stars rating={averageRating} size="md" />
            <p className="text-sm text-ink-500">
              Based on {formatNumber(sellerReviews.length)} review{sellerReviews.length === 1 ? '' : 's'}
            </p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rating breakdown</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {breakdown.map((row) => (
              <div key={row.star} className="flex items-center gap-3">
                <span className="flex w-12 shrink-0 items-center gap-1 text-sm text-ink-600">
                  {row.star}
                  <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" aria-hidden="true" />
                </span>
                <div className="h-2.5 flex-1 rounded-full bg-ink-100">
                  <div className="h-2.5 rounded-full bg-ink" style={{ width: `${row.percent}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-ink-500">
                  {row.count} ({row.percent}%)
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <DataToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder="Search by product or reviewer"
        >
          <Select
            aria-label="Filter by rating"
            value={rating}
            options={RATING_OPTIONS}
            onChange={(event) => {
              setRating(event.target.value)
              setPage(1)
            }}
          />
          <Select
            aria-label="Filter by response"
            value={responded}
            options={RESPONDED_OPTIONS}
            onChange={(event) => {
              setResponded(event.target.value)
              setPage(1)
            }}
          />
        </DataToolbar>

        {pageItems.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Star className="h-5 w-5" />}
              title={sellerReviews.length === 0 ? 'No reviews yet' : 'No reviews match your filters'}
              description={
                sellerReviews.length === 0
                  ? 'Reviews for your products will appear here once customers leave feedback.'
                  : 'Try a different rating or response filter.'
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {pageItems.map((review) => {
              const product = productById.get(review.productId)
              return (
                <li key={review.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={review.customerName ?? 'Customer'} src={review.customerAvatar} size="md" />
                      <div>
                        <p className="text-sm font-medium text-ink">{review.customerName}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <Stars rating={review.rating} size="sm" />
                          <span className="text-xs text-ink-400">{relativeTime(review.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <Badge tone={statusTone(review.status)}>{review.status}</Badge>
                  </div>

                  {review.title && <p className="text-sm font-semibold text-ink">{review.title}</p>}
                  <p className="text-sm leading-relaxed text-ink-600">{review.reviewText}</p>

                  {product && (
                    <p className="text-xs text-ink-500">
                      On{' '}
                      <Link to={`/product/${product.slug}`} className="font-medium text-ink link-underline">
                        {review.productName ?? product.name}
                      </Link>
                    </p>
                  )}

                  {review.sellerReply && (
                    <div className="rounded-lg bg-sand-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Your reply</p>
                      <p className="mt-1 text-sm text-ink-700">{review.sellerReply}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openReply(review)}>
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      {review.sellerReply ? 'Edit reply' : 'Reply'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReportTarget(review)}>
                      <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                      Report
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="border-t border-ink-200 p-4">
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
            />
          </div>
        )}
      </Card>

      {/* Reply modal */}
      <Modal
        open={!!replyTarget}
        onClose={() => setReplyTarget(null)}
        title={replyTarget?.sellerReply ? 'Edit reply' : 'Reply to review'}
        description={replyTarget?.productName ?? undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setReplyTarget(null)} disabled={savingReply}>
              Cancel
            </Button>
            <Button onClick={saveReply} loading={savingReply}>
              Publish reply
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
            <Stars rating={replyTarget?.rating ?? 5} size="sm" />
            <p className="mt-1.5">{replyTarget?.reviewText}</p>
          </div>
          <Textarea
            label="Your reply"
            rows={4}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Thank the customer and address their feedback."
          />
        </div>
      </Modal>

      {/* Report modal */}
      <Modal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        title="Report review"
        description="Tell us why this review should be reviewed by moderation."
        footer={
          <>
            <Button variant="outline" onClick={() => setReportTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitReport}>Send report</Button>
          </>
        }
      >
        <Select
          label="Reason"
          options={REPORT_REASONS}
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
        />
      </Modal>
    </div>
  )
}
