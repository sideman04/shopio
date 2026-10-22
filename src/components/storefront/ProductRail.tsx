import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Product } from '@/types'
import { cn } from '@/lib/utils'
import { ProductCard } from '@/components/products/ProductCard'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ProductCardSkeleton } from '@/components/ui/Skeleton'

interface ProductRailProps {
  title: string
  eyebrow?: string
  description?: string
  products: Product[]
  loading?: boolean
  viewAllHref?: string
  className?: string
}

/**
 * Horizontally scrolling product rail used for New arrivals, Best sellers and
 * related products. Scrolls with the keyboard and snaps on touch devices.
 */
export function ProductRail({
  title,
  eyebrow,
  description,
  products,
  loading,
  viewAllHref,
  className,
}: ProductRailProps) {
  return (
    <section className={cn('container-page', className)} aria-labelledby={`rail-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="flex items-end justify-between gap-4">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={description}
          className="mb-6 flex-1"
        />
        {viewAllHref && (
          <Link
            to={viewAllHref}
            className="group mb-6 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-ink-600"
          >
            View all
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  )
}
