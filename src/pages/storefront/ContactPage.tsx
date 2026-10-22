import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Clock, Mail, MapPin } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { accountService } from '@/services'
import { toast } from '@/context/uiStore'

interface ContactForm {
  name: string
  email: string
  subject: string
  message: string
}

const SUBJECTS = [
  { label: 'Order or delivery question', value: 'order' },
  { label: 'Returns and refunds', value: 'returns' },
  { label: 'Selling on Shopio', value: 'seller' },
  { label: 'Technical issue', value: 'technical' },
  { label: 'Something else', value: 'other' },
]

const CHANNELS = [
  {
    icon: Mail,
    title: 'Email support',
    value: 'support@shopio.co.tz',
    description: 'We reply within one business day.',
  },
  {
    icon: MapPin,
    title: 'Head office',
    value: 'Dar es Salaam, Tanzania',
    description: 'Visits by appointment only.',
  },
]

/** Contact page with a validated support form backed by the support API. */
export default function ContactPage() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({ defaultValues: { subject: 'order' } })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await accountService.submitSupport({
        name: values.name,
        email: values.email,
        subject: SUBJECTS.find((s) => s.value === values.subject)?.label ?? values.subject,
        message: values.message,
      })
      reset({ name: '', email: '', subject: 'order', message: '' })
      setSent(true)
      toast.success('Message sent', 'Our support team will reply within one business day.')
    } catch (error) {
      toast.error('Message not sent', error instanceof Error ? error.message : 'Please try again.')
    }
  })

  return (
    <div className="pb-16">
      <div className="border-b border-ink-200 bg-sand-50">
        <div className="container-page py-8 sm:py-10">
          <Breadcrumbs items={[{ label: 'Contact' }]} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Contact us</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-600">
            Questions about an order, a return or selling on Shopio? Send us a message and our team will get
            back to you. For instant answers, try the help centre first.
          </p>
        </div>
      </div>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div className="rounded-card border border-ink-200 bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink">Send us a message</h2>

          {sent && (
            <Alert tone="success" className="mt-4" onDismiss={() => setSent(false)}>
              Thanks — your message has been received. We'll reply by email shortly.
            </Alert>
          )}

          <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Your name"
                autoComplete="name"
                error={errors.name?.message}
                {...register('name', { required: 'Please tell us your name.' })}
              />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email', {
                  required: 'We need an email address to reply.',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: 'Enter a valid email address.' },
                })}
              />
            </div>

            <Select
              label="What is this about?"
              options={SUBJECTS}
              error={errors.subject?.message}
              {...register('subject', { required: 'Choose a topic.' })}
            />

            <Textarea
              label="Message"
              rows={6}
              placeholder="Include your order number if your question is about a specific order."
              error={errors.message?.message}
              {...register('message', {
                required: 'Please write a short message.',
                minLength: { value: 15, message: 'Please add a little more detail (15+ characters).' },
              })}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={isSubmitting}>
                Send message
              </Button>
              <p className="text-xs text-ink-500">
                We usually reply within one business day.
              </p>
            </div>
          </form>
        </div>

        {/* Channels */}
        <aside className="space-y-6">
          <ul className="space-y-4">
            {CHANNELS.map((channel) => (
              <li key={channel.title} className="flex gap-4 rounded-card border border-ink-200 bg-white p-5 shadow-card">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink">
                  <channel.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">{channel.title}</h3>
                  <p className="mt-0.5 text-sm font-medium text-ink-700">{channel.value}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{channel.description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-card border border-ink-200 bg-sand-100 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Clock className="h-4 w-4 text-ink-500" aria-hidden="true" />
              Support hours
            </h3>
            <dl className="mt-3 space-y-1.5 text-sm text-ink-600">
              <div className="flex justify-between">
                <dt>Monday – Friday</dt>
                <dd className="font-medium text-ink">8am – 6pm</dd>
              </div>
              <div className="flex justify-between">
                <dt>Saturday</dt>
                <dd className="font-medium text-ink">9am – 2pm</dd>
              </div>
              <div className="flex justify-between">
                <dt>Sunday</dt>
                <dd className="font-medium text-ink">Closed</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}
