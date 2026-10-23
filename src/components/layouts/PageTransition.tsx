import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

interface PageTransitionProps {
  children: React.ReactNode
}

/**
 * Gives every route a small, consistent entrance without adding a motion
 * dependency. Filter and sort updates keep their context instead of replaying
 * a full page transition.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const transitionKey = location.pathname
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const page = pageRef.current
    if (!page) return

    // Animate the meaningful blocks within each route. Most dashboard pages
    // use a `.space-y-6` root; storefront pages use a single page wrapper.
    const first = page.firstElementChild
    const content = first?.classList.contains('space-y-6') ? first : page
    const targets = Array.from(content.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    )
    if (targets.length === 0) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'))
      return
    }

    targets.forEach((target) => target.classList.add('motion-reveal'))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -48px 0px' },
    )

    targets.forEach((target) => observer.observe(target))

    return () => observer.disconnect()
  }, [transitionKey])

  return (
    <div key={transitionKey} ref={pageRef} className="page-transition">
      {children}
    </div>
  )
}
