import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface BannerLinkProps {
  href?: string | null
  className?: string
  children: ReactNode
}

/**
 * Banner actions can point at an internal route (`/shop`) or an external
 * campaign (`https://…`). React Router's `Link` is only correct for internal
 * routes, so external targets are rendered as a normal anchor.
 */
export function BannerLink({ href, className, children }: BannerLinkProps) {
  const target = href || '/shop'

  if (/^https?:\/\//i.test(target)) {
    return (
      <a href={target} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }

  return (
    <Link to={target} className={className}>
      {children}
    </Link>
  )
}
