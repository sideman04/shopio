import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { BadgeCheck, Camera, MailCheck, ShieldAlert } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
  PageHeader,
  Select,
  Switch,
} from '@/components/ui'
import { toast, useAuthStore } from '@/context'
import { authService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import { formatDate, isEmail } from '@/lib/utils'

interface ProfileForm {
  fullName: string
  email: string
  phone: string
  language: string
  timezone: string
  marketingEmails: boolean
}

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Swahili', value: 'sw' },
  { label: 'French', value: 'fr' },
]

const TIMEZONE_OPTIONS = [
  { label: 'Africa/Dar es Salaam (EAT)', value: 'Africa/Dar_es_Salaam' },
  { label: 'Africa/Nairobi (EAT)', value: 'Africa/Nairobi' },
  { label: 'Africa/Kampala (EAT)', value: 'Africa/Kampala' },
  { label: 'UTC', value: 'UTC' },
]

const DEFAULTS: ProfileForm = {
  fullName: '',
  email: '',
  phone: '',
  language: 'en',
  timezone: 'Africa/Dar_es_Salaam',
  marketingEmails: true,
}

/** Personal information form for the signed-in customer. */
export default function AccountProfilePage() {
  const user = useAuthStore((s) => s.session?.user)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({ defaultValues: DEFAULTS })

  useEffect(() => {
    if (!user) return
    let prefs = { language: 'en', timezone: 'Africa/Dar_es_Salaam', marketingEmails: true }
    try {
      const raw = window.localStorage.getItem(`shopio:profile:${user.id}`)
      if (raw) prefs = { ...prefs, ...(JSON.parse(raw) as Partial<typeof prefs>) }
    } catch {
      // Storage may be unavailable; fall back to defaults for this session.
    }
    reset({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? '',
      ...prefs,
    })
  }, [user, reset])

  const onSubmit = async (values: ProfileForm) => {
    try {
      await authService.updateProfile({
        fullName: values.fullName.trim(),
        phone: values.phone.trim() || null,
      })
      if (user) {
        window.localStorage.setItem(
          `shopio:profile:${user.id}`,
          JSON.stringify({
            language: values.language,
            timezone: values.timezone,
            marketingEmails: values.marketingEmails,
          }),
        )
      }
      toast.success('Profile updated', 'Your details have been saved.')
    } catch (error) {
      toast.error('Could not update profile', errorMessage(error))
    }
  }

  if (!user) return null

  const verified = Boolean(user.emailVerifiedAt)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal information"
        description="Keep your contact details up to date so orders and updates reach you."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile photo</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap items-center gap-4">
            <Avatar name={user.fullName} src={user.avatarUrl} size="xl" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{user.fullName}</p>
              <p className="truncate text-sm text-ink-500">{user.email}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="sm:ml-auto"
              onClick={() =>
                toast.info('Profile photo', 'Contact support to update your profile photo.')
              }
            >
              <Camera className="h-4 w-4" /> Change photo
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Full name"
              autoComplete="name"
              error={errors.fullName?.message}
              {...register('fullName', { required: 'Please enter your full name.' })}
            />
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              hint="Contact support to change your email address."
              readOnly
              className="bg-ink-50"
              error={errors.email?.message}
              {...register('email', {
                required: 'Please enter your email address.',
                validate: (value) => isEmail(value) || 'Enter a valid email address.',
              })}
            />
            <Input
              label="Phone number"
              type="tel"
              autoComplete="tel"
              placeholder="+255 7XX XXX XXX"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Select label="Language" options={LANGUAGE_OPTIONS} {...register('language')} />
            <Select label="Timezone" options={TIMEZONE_OPTIONS} {...register('timezone')} />
            <div className="sm:col-span-2">
              <Controller
                control={control}
                name="marketingEmails"
                render={({ field }) => (
                  <div className="rounded-lg border border-ink-200 p-4">
                    <Switch
                      checked={field.value}
                      onChange={field.onChange}
                      label="Marketing emails"
                      description="Receive offers, price drops and product recommendations by email."
                    />
                  </div>
                )}
              />
            </div>
          </CardBody>
          <CardFooter className="justify-end">
            <Button type="submit" loading={isSubmitting}>
              Save changes
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Email verification</CardTitle>
          {verified ? (
            <Badge tone="success" icon={<BadgeCheck className="h-3.5 w-3.5" />}>
              Verified
            </Badge>
          ) : (
            <Badge tone="warning">Unverified</Badge>
          )}
        </CardHeader>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm text-ink-600">
            {verified
              ? `Your email was verified on ${formatDate(user.emailVerifiedAt ?? '', 'long')}.`
              : 'Verify your email address to unlock order notifications and faster checkout.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await authService.resendVerification(user.email)
                toast.success('Verification email sent', 'Check your inbox for the verification link.')
              } catch (error) {
                toast.error('Could not send verification email', errorMessage(error))
              }
            }}
          >
            <MailCheck className="h-4 w-4" /> Resend verification
          </Button>
        </CardBody>
      </Card>

      <Card className="border-danger-100">
        <CardHeader>
          <CardTitle className="text-danger-700">Danger zone</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-ink">Deactivate account</p>
            <p className="mt-0.5 text-sm text-ink-500">
              Temporarily disable your account. Contact support if you need to deactivate it.
            </p>
          </div>
          <Button type="button" variant="danger" onClick={() => setConfirmOpen(true)}>
            <ShieldAlert className="h-4 w-4" /> Deactivate account
          </Button>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          toast.info(
            'Contact support to deactivate',
            'Our team will verify your request and disable the account.',
          )
        }}
        title="Deactivate your account?"
        description="Account deactivation is handled by support so we can confirm your identity."
        confirmLabel="Deactivate"
        tone="danger"
      />
    </div>
  )
}
