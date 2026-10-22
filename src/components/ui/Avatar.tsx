import { cn, initials } from '@/lib/utils'
import { avatarUrl } from '@/content/images'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
} as const

/** Avatar with a deterministic generated fallback so it is never broken. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <img
      src={src || avatarUrl(name || 'Shopio User')}
      alt={name}
      title={name}
      className={cn('shrink-0 rounded-full bg-ink-100 object-cover', SIZES[size], className)}
      onError={(event) => {
        // Fall back to the generated avatar if a remote image fails.
        const target = event.currentTarget
        if (target.dataset.fallback) return
        target.dataset.fallback = 'true'
        target.src = avatarUrl(name || initials(name))
      }}
    />
  )
}
