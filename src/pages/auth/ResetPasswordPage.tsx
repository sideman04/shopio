import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { Alert, Button, Card, CardBody, Input } from '@/components/ui'
import { authService } from '@/services'
import { cn } from '@/lib/utils'

interface ResetForm {
  password: string
  confirmPassword: string
}

interface Strength {
  tier: 1 | 2 | 3
  label: 'Weak' | 'Fair' | 'Strong'
  bar: string
  text: string
}

/** Derive a simple, transparent strength rating from length and variety. */
function evaluateStrength(password: string): Strength {
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (variety >= 2) score += 1
  if (variety >= 3) score += 1

  if (score <= 1) return { tier: 1, label: 'Weak', bar: 'bg-danger-600', text: 'text-danger-600' }
  if (score <= 3) return { tier: 2, label: 'Fair', bar: 'bg-gold-500', text: 'text-gold-600' }
  return { tier: 3, label: 'Strong', bar: 'bg-success-600', text: 'text-success-600' }
}

/**
 * Choose-a-new-password screen. The token is issued by the backend's
 * `/auth/forgot-password` flow and verified when the reset is submitted.
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<ResetForm>({ defaultValues: { password: '', confirmPassword: '' } })

  const password = watch('password')
  const strength = evaluateStrength(password)

  const onSubmit = handleSubmit(async (values) => {
    if (!token) {
      setError('This reset link is missing its token. Request a new email and try again.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await authService.resetPassword(token, values.password, values.confirmPassword)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not reset your password.')
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">Choose a new password</h1>
            <p className="text-sm text-ink-500">
              Pick a strong password you haven't used before. You'll use it to sign in next time.
            </p>
          </div>

          {!token && (
            <Alert tone="warning" title="Reset link incomplete">
              Open the link from your password reset email, or request a new one.
            </Alert>
          )}

          {error && (
            <Alert tone="danger" title="We couldn't reset your password" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          {done ? (
            <div className="space-y-5">
              <Alert tone="success" title="Password updated">
                Your password has been changed. You can now sign in with your new password.
              </Alert>
              <Button to="/login" fullWidth>
                Sign in with your new password
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <div>
                <Input
                  label="New password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 10 characters"
                  leadingIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
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
                    minLength: { value: 10, message: 'Password must be at least 10 characters' },
                    validate: (value) =>
                      (/[A-Za-z]/.test(value) && /\d/.test(value)) ||
                      'Use at least one letter and one number',
                  })}
                />

                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1.5" aria-hidden="true">
                      {[1, 2, 3].map((segment) => (
                        <span
                          key={segment}
                          className={cn(
                            'h-1.5 flex-1 rounded-full',
                            segment <= strength.tier ? strength.bar : 'bg-ink-200',
                          )}
                        />
                      ))}
                    </div>
                    <p role="status" className={cn('mt-1 text-xs font-medium', strength.text)}>
                      Password strength: {strength.label}
                    </p>
                  </div>
                )}
              </div>

              <Input
                label="Confirm new password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                error={errors.confirmPassword?.message}
                trailingAddon={
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    aria-pressed={showConfirm}
                    className="rounded-md p-1 text-ink-500 transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                }
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (value) =>
                    value === getValues('password') || 'Passwords do not match',
                })}
              />

              <Button type="submit" fullWidth loading={submitting}>
                Reset password
              </Button>

              <p className="text-center text-sm text-ink-600">
                Changed your mind?{' '}
                <Link to="/login" className="font-medium text-ink link-underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
