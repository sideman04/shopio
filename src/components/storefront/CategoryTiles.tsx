import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { Category } from '@/types'
import { cn } from '@/lib/utils'
import { SmartImage } from '@/components/ui/SmartImage'

interface CategoryTilesProps {
  categories: Category[]
  className?: string
}

/**
 * Top-category tiles. The first tile is wider on desktop for editorial rhythm;
 * all tiles share a consistent 4:5 image container with a hover lift.
 */
export function CategoryTiles({ categories, className }: CategoryTilesProps) {
  return (
    <ul
      className={cn(
        'motion-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-5',
        className,
      )}
    >
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            to={`/categories/${category.slug}`}
            className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2"
          >
            <div className="relative overflow-hidden rounded-card bg-ink-100">
              <SmartImage
                src={category.imageUrl ?? undefined}
                alt={category.name}
                wrapperClassName="aspect-[5/4] bg-sand-50 sm:aspect-square"
                fallbackLabel={category.name}
                className="transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink opacity-0 transition-opacity group-hover:opacity-100">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-ink group-hover:underline">{category.name}</h3>
              {category.productCount != null && (
                <p className="mt-0.5 text-xs text-ink-500">{category.productCount} products</p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
