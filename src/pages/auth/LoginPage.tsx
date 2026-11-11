import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Alert, Button, Card, CardBody, Checkbox, Input } from '@/components/ui'
import { authService, cartService } from '@/services'
import { homeRouteForRole, useActiveRole, useAuthStore, useIsAuthenticated } from '@/context'
import { LOCAL_DEMO } from '@/services/localDemo'
import type { RoleCode } from '@/types'
import { toast } from '@/context/uiStore'
import { isEmail } from '@/lib/utils'

interface LoginForm {
  email: string
  password: string
  remember: boolean
}

interface LocationState {
  from?: string
  requiredRole?: RoleCode
}

/**
 * Sign-in page. Credentials are verified by the PHP API; the browser only keeps
 * the HttpOnly session cookie and an in-memory bearer token.
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthenticated = useIsAuthenticated()
  const activeRole = useActiveRole()

  const loading = useAuthStore((s) => s.loading)
  const storeError = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)

  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const locationState = location.state as LocationState | null
  const from = locationState?.from

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: { email: '', password: '', remember: false },
  })

  // Clear any stale error left over from a previous visit.
  useEffect(() => {
    clearError()
  }, [clearError])

  // Already signed in? Send the user back where they came from (for example
  // checkout), otherwise to their role's home. Skip this while a fresh sign-in
  // is still finishing so the guest cart can merge before we navigate.
  if (isAuthenticated && !submitting && !LOCAL_DEMO) {
    return <Navigate to={from ?? homeRouteForRole(activeRole)} replace />
  }

  const displayedError = formError ?? storeError

  const signIn = async (email: string, password: string, demoRole?: 'admin' | 'seller') => {
    setFormError(null)
    setSubmitting(true)
    try {
      const { user } = await authService.login(email, password)
      // Merge anything added to the guest cart before signing in.
      await cartService.mergeGuestCart()
      const role = demoRole ?? user.roles[0] ?? 'customer'
      const destination =
        from && (!locationState?.requiredRole || user.roles.includes(locationState.requiredRole))
          ? from
          : homeRouteForRole(role)
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}`)
      navigate(destination, { replace: true })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmit = handleSubmit(({ email, password }) => signIn(email, password))

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-ink-500">
              Sign in to manage your orders, wishlist and account.
            </p>
          </div>

          {LOCAL_DEMO && (
            <div className="space-y-3 rounded-xl bg-ink-50 p-4">
              <p className="text-sm font-semibold text-ink">Demo sign-in</p>
              <p className="text-xs text-ink-500">Choose a role to enter directly. No password is needed.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => void signIn('admin@shopio.test', 'demo', 'admin')}
                >
                  Demo admin
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => void signIn('seller@shopio.test', 'demo', 'seller')}
                >
                  Demo seller
                </Button>
              </div>
            </div>
          )}

          {displayedError && (
            <Alert
              tone="danger"
              title="We couldn't sign you in"
              onDismiss={() => {
                setFormError(null)
                clearError()
              }}
            >
              {displayedError}
            </Alert>
          )}

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                validate: (value) => isEmail(value) || 'Enter a valid email address',
              })}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              error={errors.password?.message}
              trailingAddon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="rounded-md p-1 text-ink-500 transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              }
              {...register('password', {
                required: 'Password is required',
              })}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Checkbox label="Remember me" {...register('remember')} />
              <Link to="/forgot-password" className="text-sm font-medium text-ink link-underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" fullWidth loading={loading || submitting}>
              Sign in
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="text-center text-sm text-ink-600">
        New to RAGIZE?{' '}
        <Link to="/register" className="font-medium text-ink link-underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
