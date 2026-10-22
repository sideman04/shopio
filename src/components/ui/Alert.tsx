import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, { wrapper: string; icon: React.ReactNode }> = {
  info: { wrapper: 'border-info-100 bg-info-50 text-info-700', icon: <Info className="h-4 w-4" /> },
  success: {
    wrapper: 'border-success-100 bg-success-50 text-success-700',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  warning: {
    wrapper: 'border-gold-500/30 bg-gold-500/10 text-gold-600',
    icon: <TriangleAlert className="h-4 w-4" />,
  },
  danger: {
    wrapper: 'border-danger-100 bg-danger-50 text-danger-700',
    icon: <AlertCircle className="h-4 w-4" />,
  },
}

export interface AlertProps {
  tone?: Tone
  title?: string
  children?: React.ReactNode
  onDismiss?: () => void
  className?: string
}

export function Alert({ tone = 'info', title, children, onDismiss, className }: AlertProps) {
  const config = TONES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', config.wrapper, className)}
    >
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'leading-relaxed')}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="shrink-0 rounded p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
