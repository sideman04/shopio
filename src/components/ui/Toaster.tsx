import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToastStore, type ToastVariant } from '@/context/uiStore'

const VARIANTS: Record<ToastVariant, { icon: React.ReactNode; accent: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5 text-success-600" />, accent: 'border-l-success-600' },
  error: { icon: <AlertCircle className="h-5 w-5 text-danger-600" />, accent: 'border-l-danger-600' },
  info: { icon: <Info className="h-5 w-5 text-info-600" />, accent: 'border-l-info-600' },
  warning: { icon: <TriangleAlert className="h-5 w-5 text-gold-600" />, accent: 'border-l-gold-500' },
}

/**
 * Global toast viewport. Mounted once in the app shell; anything can push a
 * toast through `useToastStore` or the imperative `toast` helper.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-auto sm:items-end"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const config = VARIANTS[toast.variant]
        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-ink-200 border-l-4 bg-white p-3.5 shadow-lift animate-slide-up',
              config.accent,
            )}
          >
            <span className="mt-0.5 shrink-0">{config.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{toast.description}</p>}
              {toast.action && (
                <Link
                  to={toast.action.href}
                  onClick={() => dismiss(toast.id)}
                  className="mt-1.5 inline-block text-xs font-semibold text-ink underline underline-offset-2"
                >
                  {toast.action.label}
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
