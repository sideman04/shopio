import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Alert, Button, Card, CardBody, Checkbox, Input } from '@/components/ui'
import { authService, cartService } from '@/services'
import { useAuthStore } from '@/context'
import { toast } from '@/context/uiStore'
import { isEmail } from '@/lib/utils'

interface RegisterForm {
  fullName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  agree: boolean
}

/**
 * Customer registration. Sellers are onboarded through a separate, richer flow
 * so this form always creates a customer account.
 */
export default function RegisterPage() {
  const navigate = useNavigate()
  const loading = useAuthStore((s) => s.loading)
  const clearError = useAuthStore((s) => s.clearError)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<RegisterForm>({
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      agree: false,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    clearError()
    try {
      await authService.register({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
        passwordConfirmation: values.confirmPassword,
        acceptTerms: values.agree,
        phone: values.phone.trim() || undefined,
      })
      const session = useAuthStore.getState().session
      if (session) {
        await cartService.mergeGuestCart()
        toast.success('Account created', 'Welcome to Shopio.')
        navigate('/account', { replace: true })
      } else {
        toast.success('Account created', 'Check your email to verify your address, then sign in.')
        navigate('/login', { replace: true })
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'We could not create your account.')
    }
  })

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">Create your account</h1>
            <p className="text-sm text-ink-500">
              Join Shopio to track orders, save favourites and check out faster.
            </p>
          </div>

          {formError && (
            <Alert
              tone="danger"
              title="We couldn't create your account"
              onDismiss={() => setFormError(null)}
            >
              {formError}
            </Alert>
          )}

          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <Input
              label="Full name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Grace Mollel"
              error={errors.fullName?.message}
              {...register('fullName', {
                required: 'Your name is required',
                minLength: { value: 2, message: 'Please enter your full name' },
              })}
            />

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
              label="Phone number"
              hint="Optional — used for delivery updates only."
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+255 7xx xxx xxx"
              error={errors.phone?.message}
              {...register('phone', {
                validate: (value) =>
                  !value ||
                  value.replace(/\D/g, '').length >= 9 ||
                  'Enter a valid phone number',
              })}
            />

            <Input
              label="Password"
              hint="At least 10 characters, including a letter and a number."
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a password"
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

            <Input
              label="Confirm password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
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

            <div className="space-y-2">
              <Checkbox
                label="I agree to Shopio's terms and privacy policy."
                error={errors.agree?.message}
                {...register('agree', {
                  validate: (value) => value || 'Please accept the terms to continue',
                })}
              />
              <p className="text-xs text-ink-500">
                Read the{' '}
                <Link to="/terms" className="link-underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="link-underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>

            <Button type="submit" fullWidth loading={loading}>
              Create account
            </Button>
          </form>

          <p className="text-sm text-ink-600">
            Want to sell on Shopio?{' '}
            <Link to="/seller/register" className="font-medium text-ink link-underline">
              Register as a seller
            </Link>
            .
          </p>
        </CardBody>
      </Card>

      <p className="text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-ink link-underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
