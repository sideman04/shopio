import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PackageCheck, Star } from 'lucide-react'
import type { Product } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  RatingInput,
  Select,
  SmartImage,
  Stars,
  Textarea,
} from '@/components/ui'
import { toast, useAuthStore, useCatalogStore, useCustomerOrders } from '@/context'
import { orderService, reviewService } from '@/services'
import { formatDate, titleCase } from '@/lib/utils'

type ReviewTone = 'neutral' | 'success' | 'warning' | 'danger'

function reviewTone(status: string): ReviewTone {
  switch (status) {
    case 'published':
      return 'success'
    case 'pending':
      return 'warning'
    case 'rejected':
      return 'danger'
    default:
      return 'neutral'
  }
}

interface ReviewableProduct {
  productId: number
  productName: string
  productSlug: string
  imageUrl?: string
  variantName: string
}

/** Reviews written by the customer, plus the products still awaiting a review. */
export default function AccountReviewsPage() {
  const user = useAuthStore((s) => s.session?.user)
  const products = useCatalogStore((s) => s.products)
  const reviews = useCatalogStore((s) => s.reviews)
  const orders = useCustomerOrders(user?.id)

  useEffect(() => {
    void Promise.allSettled([
      reviewService.fetchMyReviews(),
      orderService.queryOrders({ pageSize: 100, scope: 'customer' }),
    ])
  }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [productId, setProductId] = useState('')
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const myReviews = useMemo(
    () => reviews.filter((review) => review.userId === user?.id),
    [reviews, user?.id],
  )

  const reviewable = useMemo<ReviewableProduct[]>(() => {
    const map = new Map<number, ReviewableProduct>()
    orders
      .filter((order) => order.status === 'delivered')
      .forEach((order) => {
        order.items.forEach((item) => {
          if (item.productId == null) return
          if (map.has(item.productId)) return
          map.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            productSlug: item.productSlug,
            imageUrl: item.imageUrl ?? undefined,
            variantName: item.variantName,
          })
        })
      })
    return Array.from(map.values())
  }, [orders])

  const reviewedIds = useMemo(() => new Set(myReviews.map((review) => review.productId)), [myReviews])
  const awaiting = reviewable.filter((item) => !reviewedIds.has(item.productId))

  const productFor = (id: number): Product | undefined => products.find((p) => p.id === id)

  const openReview = (presetProductId?: number) => {
    setProductId(String(presetProductId ?? awaiting[0]?.productId ?? reviewable[0]?.productId ?? ''))
    setRating(5)
    setTitle('')
    setReviewText('')
    setModalOpen(true)
  }

  const submit = async () => {
    if (!productId) {
      toast.error('Select a product', 'Choose which product you are reviewing.')
      return
    }
    if (!reviewText.trim()) {
      toast.error('Add your review', 'Please describe your experience with the product.')
      return
    }

    const selected = reviewable.find((item) => String(item.productId) === productId)
    setSubmitting(true)
    try {
      await reviewService.submitReview({
        productId: Number(productId),
        rating,
        title: title.trim(),
        reviewText: reviewText.trim(),
        productName: selected?.productName,
      })
      toast.success(
        'Review submitted — it will be visible once approved',
        'Reviews are moderated before they appear on the product page.',
      )
      setModalOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const hasAnything = myReviews.length > 0 || reviewable.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="My reviews"
        description="Share your experience to help other shoppers make confident choices."
        actions={
          <Button onClick={() => openReview()} disabled={reviewable.length === 0}>
            <Star className="h-4 w-4" /> Write a review
          </Button>
        }
      />

      {!hasAnything ? (
        <EmptyState
          icon={<Star className="h-5 w-5" />}
          title="Nothing to review yet"
          description="Once an order is delivered you can review the products you bought."
          action={{ label: 'Browse products', to: '/shop' }}
        />
      ) : (
        <>
          {myReviews.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-ink">
                Your reviews <span className="text-ink-400">({myReviews.length})</span>
              </h2>
              {myReviews.map((review) => {
                const product = productFor(review.productId)
                const image =
                  product?.images.find((i) => i.isPrimary)?.imageUrl ?? product?.images[0]?.imageUrl
                return (
                  <Card key={review.id}>
                    <CardBody className="space-y-4">
                      <div className="flex gap-4">
                        <SmartImage
                          src={image}
                          alt={review.productName ?? product?.name ?? 'Product'}
                          wrapperClassName="h-16 w-16 shrink-0 rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            {product ? (
                              <Link
                                to={`/product/${product.slug}`}
                                className="font-medium text-ink hover:underline"
                              >
                                {review.productName ?? product.name}
                              </Link>
                            ) : (
                              <span className="font-medium text-ink">
                                {review.productName ?? 'Product'}
                              </span>
                            )}
                            <Badge tone={reviewTone(review.status)}>{titleCase(review.status)}</Badge>
                          </div>
                          <Stars rating={review.rating} size="sm" showValue className="mt-1.5" />
                          {review.title && <p className="mt-2 font-medium text-ink">{review.title}</p>}
                          {review.reviewText && (
                            <p className="mt-1 text-sm leading-relaxed text-ink-600">{review.reviewText}</p>
                          )}
                          <p className="mt-2 text-xs text-ink-400">
                            {formatDate(review.createdAt, 'long')}
                          </p>
                        </div>
                      </div>
                      {review.sellerReply && (
                        <div className="rounded-lg bg-sand-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                            Seller response
                          </p>
                          <p className="mt-1 text-sm text-ink-600">{review.sellerReply}</p>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )
              })}
            </section>
          )}

          {reviewable.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Products you can review</CardTitle>
                <span className="text-sm text-ink-500">{awaiting.length} awaiting</span>
              </CardHeader>
              {awaiting.length === 0 ? (
                <CardBody>
                  <p className="text-sm text-ink-500">
                    You have reviewed every delivered product. Thank you for the feedback!
                  </p>
                </CardBody>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {awaiting.map((item) => (
                    <li key={item.productId} className="flex items-center gap-4 px-5 py-4">
                      <SmartImage
                        src={item.imageUrl}
                        alt={item.productName}
                        wrapperClassName="h-12 w-12 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{item.productName}</p>
                        <p className="truncate text-xs text-ink-500">{item.variantName}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openReview(item.productId)}>
                        <PackageCheck className="h-3.5 w-3.5" /> Review
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Write a review"
        description="Reviews are checked by moderation before they go live."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting}>
              Submit review
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Product"
            placeholder="Select a product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            options={reviewable.map((item) => ({ label: item.productName, value: String(item.productId) }))}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Rating</span>
            <RatingInput value={rating} onChange={setRating} />
          </div>
          <Input
            label="Title"
            placeholder="Summarise your experience"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            label="Your review"
            rows={4}
            placeholder="What did you like or dislike? How was the quality?"
            value={reviewText}
            onChange={(event) => setReviewText(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}
