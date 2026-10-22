import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { SmartImage } from '@/components/ui/SmartImage'
import { useCategories, useCategoryCounts } from '@/context/catalogStore'
import { formatNumber } from '@/lib/utils'

/**
 * Category index. Each card links through to the category's product listing and
 * shows how many active products it currently holds.
 */
export default function CategoriesPage() {
  const categories = useCategories()
  const counts = useCategoryCounts()

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts])

  return (
    <div>
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: 'Categories' }]} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Shop by category</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            {formatNumber(total)} active products across {categories.length} curated categories — every
            seller on Shopio is verified before their store goes live.
          </p>
        </div>
      </div>

      <div className="container-page py-10">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const count = counts[category.slug] ?? 0
            return (
              <li key={category.id}>
                <Link
                  to={`/categories/${category.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-card border border-ink-200 bg-white shadow-card transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 focus-visible:ring-offset-2"
                >
                  <SmartImage
                    src={category.imageUrl ?? undefined}
                    alt={category.name}
                    wrapperClassName="aspect-[16/10]"
                    fallbackLabel={category.name}
                    className="transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-semibold text-ink group-hover:underline">
                        {category.name}
                      </h2>
                      <span className="shrink-0 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600">
                        {count} items
                      </span>
                    </div>
                    {category.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500">
                        {category.description}
                      </p>
                    )}
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                      Browse {category.name}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
