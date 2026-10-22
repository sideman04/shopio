import type { Product } from '@/types'
import { cn } from '@/lib/utils'
import { ProductCard } from './ProductCard'
import { ProductGridSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PackageSearch } from 'lucide-react'

interface ProductGridProps {
  products: Product[]
  loading?: boolean
  columns?: 3 | 4
  className?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: { label: string; to?: string; onClick?: () => void }
  skeletonCount?: number
}

/** Responsive product grid with built-in loading and empty states. */
export function ProductGrid({
  products,
  loading,
  columns = 4,
  className,
  emptyTitle = 'No products found',
  emptyDescription = 'Try adjusting your filters or search for something else.',
  emptyAction,
  skeletonCount = 8,
}: ProductGridProps) {
  if (loading) return <ProductGridSkeleton count={skeletonCount} />

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<PackageSearch className="h-5 w-5" />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6',
        columns === 4 ? 'lg:grid-cols-3 xl:grid-cols-4' : 'lg:grid-cols-3',
        className,
      )}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
