import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/context/uiStore'
import { accountService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import { isEmail } from '@/lib/utils'

/**
 * Newsletter sign-up. Submissions are recorded through the support intake so
 * they reach the team's inbox rather than being dropped on the client.
 */
export function NewsletterForm({ className }: { className?: string }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    setError(undefined)
    setLoading(true)
    try {
      await accountService.submitSupport({
        name: 'Newsletter subscriber',
        email: email.trim(),
        subject: 'Newsletter subscription',
        message: 'Please add this address to the Shopio newsletter.',
      })
      setEmail('')
      toast.success('Subscribed', 'You will receive our latest offers and updates by email.')
    } catch (err) {
      toast.error('Could not subscribe', errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Input
          type="email"
          name="newsletter-email"
          autoComplete="email"
          placeholder="Enter your email address"
          aria-label="Email address for the newsletter"
          value={email}
          error={error}
          leadingIcon={<Mail className="h-4 w-4" />}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError(undefined)
          }}
          className="sm:max-w-sm"
        />
        <Button type="submit" loading={loading} className="sm:mt-0">
          Subscribe
        </Button>
      </div>
    </form>
  )
}
