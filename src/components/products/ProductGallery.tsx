import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import type { ProductImage } from '@/types'
import { cn } from '@/lib/utils'
import { SmartImage } from '@/components/ui/SmartImage'

interface ProductGalleryProps {
  images: ProductImage[]
  productName: string
  /** Optional badge rendered over the main image (e.g. discount). */
  overlay?: React.ReactNode
  className?: string
}

/**
 * Product image gallery: a vertical thumbnail rail on desktop, a horizontal one
 * on mobile, with arrow-key navigation and click-to-zoom on the main image.
 */
export function ProductGallery({ images, productName, overlay, className }: ProductGalleryProps) {
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const list = images.length ? images : []
  const current = list[active]

  useEffect(() => {
    setActive(0)
  }, [productName])

  if (list.length === 0) {
    return (
      <SmartImage
        src={undefined}
        alt={productName}
        wrapperClassName="aspect-square rounded-card"
        fallbackLabel={productName}
        className={className}
      />
    )
  }

  const go = (delta: number) => {
    setActive((index) => (index + delta + list.length) % list.length)
  }

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row-reverse sm:gap-4', className)}>
      <div className="relative flex-1">
        <div
          role="group"
          aria-label={`${productName} images`}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') go(1)
            if (event.key === 'ArrowLeft') go(-1)
          }}
          className="relative overflow-hidden rounded-card bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
        >
          <SmartImage
            key={current?.id}
            src={current?.imageUrl}
            alt={current?.altText ?? productName}
            wrapperClassName="aspect-square"
            className={cn('transition-transform duration-500', zoomed && 'scale-150 cursor-zoom-out')}
            onClick={() => setZoomed((z) => !z)}
            fallbackLabel={productName}
          />
          {overlay && <div className="pointer-events-none absolute left-3 top-3">{overlay}</div>}

          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
            className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink shadow-card transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile / small-tablet arrows */}
        {list.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-card transition hover:bg-white sm:hidden"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-ink shadow-card transition hover:bg-white sm:hidden"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {list.length > 1 && (
        <ul
          className="flex gap-3 overflow-x-auto no-scrollbar sm:flex-col sm:overflow-visible"
          aria-label="Product image thumbnails"
        >
          {list.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => {
                  setActive(index)
                  setZoomed(false)
                }}
                aria-label={`Show image ${index + 1} of ${list.length}`}
                aria-current={index === active}
                className={cn(
                  'h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors sm:h-20 sm:w-20',
                  index === active ? 'border-ink' : 'border-transparent hover:border-ink-300',
                )}
              >
                <SmartImage src={image.imageUrl} alt="" wrapperClassName="h-full w-full" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
