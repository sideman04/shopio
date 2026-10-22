import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface SmartImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | undefined
  alt: string
  /** Aspect wrapper class, e.g. "aspect-[4/5]". Omit for intrinsic sizing. */
  wrapperClassName?: string
  /** Ratio used for the generated placeholder when the image fails. */
  fallbackLabel?: string
}

/**
 * Image with a graceful fallback.
 *
 * Product photography is loaded from a CDN, so a network failure would
 * otherwise leave a broken-image icon. On error we render a neutral, branded
 * placeholder derived from the alt text instead.
 */
export function SmartImage({ src, alt, className, wrapperClassName, fallbackLabel, ...props }: SmartImageProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Reset state when the source changes (e.g. switching gallery thumbnails).
  useEffect(() => {
    setFailed(false)
    setLoaded(false)
  }, [src])

  if (!src || failed) {
    const label = (fallbackLabel ?? alt ?? 'Shopio').slice(0, 28)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#F6EFE6"/><g fill="#C7A67F"><rect x="215" y="250" width="170" height="120" rx="10" opacity="0.5"/><circle cx="255" cy="288" r="14" opacity="0.6"/><path d="M225 360l52-58 40 44 30-32 48 46z" opacity="0.7"/></g><text x="300" y="424" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="19" fill="#8A8A8A">${label}</text></svg>`
    const placeholder = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    return (
      <div className={cn('overflow-hidden bg-sand-100', wrapperClassName)}>
        <img
          src={placeholder}
          alt={alt}
          className={cn('h-full w-full object-cover', className)}
          loading="lazy"
          decoding="async"
          {...props}
        />
      </div>
    )
  }

  const image = (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      onLoad={() => setLoaded(true)}
      loading="lazy"
      decoding="async"
      className={cn(
        'h-full w-full object-cover transition-opacity duration-300',
        loaded ? 'opacity-100' : 'opacity-0',
        className,
      )}
      {...props}
    />
  )

  if (!wrapperClassName) return image

  return (
    <div className={cn('relative overflow-hidden bg-ink-100', wrapperClassName)}>
      {!loaded && <span className="skeleton absolute inset-0" aria-hidden="true" />}
      {image}
    </div>
  )
}
