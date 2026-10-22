import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import type { RoleCode } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { homeRouteForRole, useActiveRole, useAuthStore } from '@/context/authStore'

const ROLE_LABEL: Record<RoleCode, string> = {
  customer: 'customer account',
  seller: 'seller account',
  admin: 'administrator',
}

/**
 * Route guard for the three dashboards.
 *
 * Client-side routing convenience only. This hides pages from the wrong role
 * in the UI; it is not a security boundary. The PHP backend authenticates the
 * session and authorises every request server-side, so nothing here should be
 * treated as protecting data.
 */
export function ProtectedRoute({ role, children }: { role: RoleCode; children: React.ReactNode }) {
  const location = useLocation()
  const authenticated = useAuthStore((s) => !!s.session)
  const user = useAuthStore((s) => s.session?.user ?? null)
  const activeRole = useActiveRole()
  const switchRole = useAuthStore((s) => s.switchRole)

  const hasRole = !!user?.roles.includes(role)

  // A user may hold several roles; keep the acting role in step with the area
  // they are viewing. Done in an effect so we never update the store mid-render.
  useEffect(() => {
    if (hasRole && activeRole !== role) switchRole(role)
  }, [hasRole, activeRole, role, switchRole])

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname, requiredRole: role }} />
  }

  if (!hasRole) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold text-ink">This area needs a {ROLE_LABEL[role]}</h1>
          <p className="mt-2 text-sm text-ink-500">
            You are signed in as <span className="font-medium text-ink">{user?.email}</span>, which does not
            include the {role} role.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            {role === 'seller' && user?.roles.includes('customer') && (
              <Button to="/seller/register" variant="primary">
                Open a store
              </Button>
            )}
            <Button to={homeRouteForRole(activeRole)} variant={role === 'seller' ? 'outline' : 'primary'}>
              Go to my dashboard
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

/** Convenience wrapper for pages that just need any signed-in user. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const authenticated = useAuthStore((s) => !!s.session)
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
