import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Alert, Button, Card, CardBody, Input } from '@/components/ui'
import { authService } from '@/services'
import { isEmail } from '@/lib/utils'

interface ForgotForm {
  email: string
}

/**
 * Password reset request. The API sends a single-use link when the account
 * exists, without revealing whether the address is registered.
 */
export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotForm>({ defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const { email } = await authService.requestPasswordReset(values.email.trim())
      setSentTo(email)
    } catch {
      // Keep the same neutral confirmation for network failures so the page
      // never reveals whether an address is registered.
      setSentTo(values.email.trim())
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">Reset your password</h1>
            <p className="text-sm text-ink-500">
              Enter the email address on your account and we'll send you a link to choose a new
              password.
            </p>
          </div>

          {sentTo ? (
            <div className="space-y-5">
              <Alert tone="success" title="Check your inbox">
                <p>
                  If an account exists for{' '}
                  <span className="font-medium">{sentTo}</span>, a reset link is on its way. Check
                  your inbox and spam folder, then follow the link to choose a new password.
                </p>
              </Alert>

              <div className="flex flex-col gap-3">
                <Button to="/reset-password" fullWidth>
                  Continue to reset password
                </Button>
                <Button to="/login" variant="outline" fullWidth>
                  Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                leadingIcon={<MailCheck className="h-4 w-4" aria-hidden="true" />}
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  validate: (value) => isEmail(value) || 'Enter a valid email address',
                })}
              />

              <Button type="submit" fullWidth loading={submitting}>
                Send reset link
              </Button>

              <p className="text-center text-sm text-ink-600">
                Remembered it?{' '}
                <Link to="/login" className="font-medium text-ink link-underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </CardBody>
      </Card>

      {sentTo && (
        <p className="text-center text-xs text-ink-500">
          Requested for <span className="font-medium text-ink-600">{getValues('email')}</span>
        </p>
      )}
    </div>
  )
}
