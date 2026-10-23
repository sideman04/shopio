import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Percent,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  Input,
  Select,
  Textarea,
} from '@/components/ui'
import { businessCategories } from '@/content/marketing'
import { authService, geoService, sellerService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import { toast, useAuthStore } from '@/context'
import { cn, isEmail, slugify } from '@/lib/utils'
import type { City, Region } from '@/types'

interface RegisterFormValues {
  fullName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  storeName: string
  storeSlug: string
  businessCategory: string
  regionId: string
  cityId: string
  address: string
  storeDescription: string
  agree: boolean
}

const STEPS = [
  { id: 0, label: 'Your account', icon: UserRound },
  { id: 1, label: 'Your store', icon: Store },
  { id: 2, label: 'Verification', icon: ShieldCheck },
] as const

const STEP_FIELDS: Array<Array<keyof RegisterFormValues>> = [
  ['fullName', 'email', 'phone', 'password', 'confirmPassword'],
  ['storeName', 'storeSlug', 'businessCategory', 'regionId', 'cityId', 'address', 'storeDescription'],
  ['agree'],
]

export default function SellerRegisterPage() {
  const user = useAuthStore((s) => s.session?.user)
  const signedIn = Boolean(user)
  const [step, setStep] = useState(signedIn ? 1 : 0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [regions, setRegions] = useState<Region[]>([])
  const [cities, setCities] = useState<City[]>([])

  // Geography is reference data served by the API, not bundled with the app.
  useEffect(() => {
    let active = true
    geoService
      .fetchRegions()
      .then((rows) => active && setRegions(rows))
      .catch(() => undefined)
    geoService
      .fetchCities()
      .then((rows) => active && setCities(rows))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    mode: 'onTouched',
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      password: '',
      confirmPassword: '',
      storeName: '',
      storeSlug: '',
      businessCategory: '',
      regionId: '',
      cityId: '',
      address: '',
      storeDescription: '',
      agree: false,
    },
  })

  const storeName = watch('storeName')
  const regionId = watch('regionId')

  // The URL is assigned from the store name; the backend resolves collisions.
  useEffect(() => {
    setValue('storeSlug', slugify(storeName ?? ''), { shouldValidate: false })
  }, [storeName, setValue])

  const cityOptions = useMemo(
    () => cities.filter((c) => String(c.regionId) === regionId).map((c) => ({ label: c.name, value: String(c.id) })),
    [regionId],
  )

  const next = async () => {
    const valid = await trigger(STEP_FIELDS[step])
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => setStep((s) => Math.max(s - 1, 0))

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      const storeInput = {
        storeName: values.storeName,
        storeDescription: values.storeDescription,
        businessCategory: values.businessCategory,
        contactPhone: values.phone,
        regionId: values.regionId ? Number(values.regionId) : null,
        cityId: values.cityId ? Number(values.cityId) : null,
        address: values.address,
      }

      if (signedIn) {
        await sellerService.registerSeller(storeInput)
      } else {
        await authService.register({
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
          password: values.password,
          passwordConfirmation: values.confirmPassword,
          acceptTerms: values.agree,
          storeName: values.storeName,
          businessCategory: values.businessCategory,
        })
      }

      // The account and store are created; add the profile details when a
      // session was issued (email verification can delay the first session).
      if (useAuthStore.getState().session) {
        await sellerService.updateSellerStore(storeInput).catch(() => undefined)
        await authService.me().catch(() => undefined)
      }

      setSubmitted(true)
      toast.success('Application submitted', 'Your store is awaiting verification.')
    } catch (error) {
      toast.error('Could not submit application', errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  })

  if (submitted) {
    const values = getValues()
    return (
      <div className="container-page py-12 sm:py-16">
        <Card className="mx-auto max-w-xl">
          <CardBody className="space-y-5 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-600">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Application received</h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                Thanks, {values.fullName || 'there'}. We have your application for{' '}
                <span className="font-medium text-ink">{values.storeName || 'your store'}</span>. Our team will
                review the details and contact you if anything else is needed.
              </p>
            </div>
            <Alert tone="info" title="What happens next">
              We verify your details and store information, then email you when your store is approved. You can
              add products as soon as it goes live.
            </Alert>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button to="/seller/dashboard">
                Go to the seller dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button to="/" variant="outline">
                Back to the storefront
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <header className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Open your Shopio store</h1>
            <p className="mt-3 text-ink-600">
              {signedIn ? 'Two short steps.' : 'Three short steps.'} You can review everything before you submit,
              and nothing is charged to start selling.
            </p>
          </header>

          {/* Stepper */}
          <ol className="mt-8 flex flex-wrap items-center gap-3" aria-label="Onboarding progress">
            {STEPS.map((item, index) => {
              const done = index < step
              const active = index === step
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                      active
                        ? 'border-ink bg-ink text-white'
                        : done
                          ? 'border-ink-200 bg-white text-ink'
                          : 'border-ink-200 bg-white text-ink-400',
                    )}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                        active ? 'bg-white text-ink' : done ? 'bg-ink text-white' : 'bg-ink-100 text-ink-500',
                      )}
                    >
                      {done ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <span className="hidden h-px w-6 bg-ink-200 sm:block" aria-hidden="true" />
                  )}
                </li>
              )
            })}
          </ol>

          <form className="mt-8 space-y-6" onSubmit={onSubmit} noValidate>
            {step === 0 && (
              <Card>
                <CardBody className="grid gap-5 sm:grid-cols-2">
                  <Input
                    className="sm:col-span-2"
                    label="Full name"
                    placeholder="e.g. Amina Mwakalinga"
                    autoComplete="name"
                    error={errors.fullName?.message}
                    {...register('fullName', {
                      required: 'Your name is required',
                      minLength: { value: 2, message: 'Please enter your full name' },
                    })}
                  />
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    error={errors.email?.message}
                    {...register('email', {
                      required: 'Email is required',
                      validate: (value) => isEmail(value) || 'Enter a valid email address',
                    })}
                  />
                  <Input
                    label="Phone number"
                    type="tel"
                    inputMode="tel"
                    placeholder="+255 7xx xxx xxx"
                    autoComplete="tel"
                    error={errors.phone?.message}
                    {...register('phone', {
                      required: 'A phone number is required for delivery updates',
                      validate: (value) =>
                        value.replace(/\D/g, '').length >= 9 || 'Enter a valid phone number',
                    })}
                  />
                  <Input
                    label="Password"
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    hint="Used to sign in to your seller account."
                    error={errors.password?.message}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    })}
                  />
                  <Input
                    label="Confirm password"
                    type="password"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    error={errors.confirmPassword?.message}
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (value) => value === getValues('password') || 'Passwords do not match',
                    })}
                  />
                </CardBody>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <CardBody className="grid gap-5 sm:grid-cols-2">
                  <Input
                    className="sm:col-span-2"
                    label="Store name"
                    placeholder="e.g. Your store name"
                    error={errors.storeName?.message}
                    {...register('storeName', {
                      required: 'Your store name is required',
                      minLength: { value: 2, message: 'Please enter a store name' },
                    })}
                  />
                  <div className="sm:col-span-2">
                    <label htmlFor="store-slug" className="mb-1.5 block text-sm font-medium text-ink">
                      Store URL
                    </label>
                    <div className="flex items-center overflow-hidden rounded-lg border border-ink-200 bg-white focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/60">
                      <span className="whitespace-nowrap bg-ink-50 px-3 text-sm text-ink-500">shopio.co.tz/store/</span>
                      <input
                        id="store-slug"
                        type="text"
                        readOnly
                        className="h-10 w-full bg-ink-50 px-3 text-sm text-ink-500 focus:outline-none"
                        placeholder="your-store"
                        {...register('storeSlug')}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-ink-500">
                      Assigned automatically from your store name. Contact support if you need a different URL.
                    </p>
                  </div>
                  <Select
                    label="Business category"
                    placeholder="Select a category"
                    options={businessCategories.map((c) => ({ label: c, value: c }))}
                    error={errors.businessCategory?.message}
                    {...register('businessCategory', { required: 'Choose a business category' })}
                  />
                  <Select
                    label="Region"
                    placeholder="Select a region"
                    options={regions.map((r) => ({ label: r.name, value: String(r.id) }))}
                    error={errors.regionId?.message}
                    {...register('regionId', {
                      validate: (value) => (regions.length === 0 || value ? true : 'Select your region'),
                      onChange: () => setValue('cityId', ''),
                    })}
                  />
                  <Select
                    label="City / district"
                    placeholder={regionId ? 'Select a city' : 'Select a region first'}
                    disabled={!regionId}
                    options={cityOptions}
                    error={errors.cityId?.message}
                    {...register('cityId', {
                      validate: (value) => (cities.length === 0 || value ? true : 'Select your city'),
                    })}
                  />
                  <Input
                    label="Business address"
                    placeholder="Street, area"
                    error={errors.address?.message}
                    {...register('address', { required: 'A business address is required' })}
                  />
                  <Textarea
                    className="sm:col-span-2"
                    label="Short store description"
                    rows={3}
                    placeholder="Tell shoppers what you sell and what makes your store different."
                    hint="Around 1–2 sentences. Shown on your public store page."
                    error={errors.storeDescription?.message}
                    {...register('storeDescription', {
                      required: 'A short description is required',
                      minLength: { value: 20, message: 'Please write at least 20 characters' },
                    })}
                  />
                </CardBody>
              </Card>
            )}

            {step === 2 && (
              <>
                <Card>
                  <CardBody className="space-y-4">
                    <h2 className="text-base font-semibold text-ink">Review your application</h2>
                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      {[
                        { label: 'Name', value: getValues('fullName') },
                        { label: 'Email', value: getValues('email') },
                        { label: 'Store name', value: getValues('storeName') },
                        { label: 'Store URL', value: `shopio.co.tz/store/${getValues('storeSlug')}` },
                        { label: 'Category', value: getValues('businessCategory') },
                        {
                          label: 'Location',
                          value: [
                            cities.find((c) => String(c.id) === getValues('cityId'))?.name,
                            regions.find((r) => String(r.id) === getValues('regionId'))?.name,
                          ]
                            .filter(Boolean)
                            .join(', '),
                        },
                      ].map((row) => (
                        <div key={row.label}>
                          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{row.label}</dt>
                          <dd className="mt-1 text-sm text-ink">{row.value || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody className="space-y-3">
                    <Checkbox
                      label="I confirm the details above are accurate and I agree to Shopio's Seller Terms and Commission Policy."
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
                  </CardBody>
                </Card>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {step > (signedIn ? 1 : 0) ? (
                <Button type="button" variant="outline" onClick={back}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>
              ) : (
                <span />
              )}

              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={next}>
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button type="submit" loading={submitting}>
                  Submit application
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Aside */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody className="space-y-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <FileText className="h-4 w-4 text-ink-500" aria-hidden="true" />
                What you'll need
              </h2>
              <ul className="space-y-3 text-sm text-ink-600">
                {[
                  'A store name and a short description of what you sell.',
                  'A business category that best matches your products.',
                  'Your region, city and business address.',
                  'A bank account or mobile money wallet in the store’s name.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <Percent className="h-4 w-4 text-ink-500" aria-hidden="true" />
                Commission, explained
              </h2>
              <p className="text-sm leading-relaxed text-ink-600">
                Commission details for your store are confirmed during approval and shown in your seller dashboard.
              </p>
              <p className="text-sm leading-relaxed text-ink-600">
                Review the current fee and payout information before you publish products.
              </p>
            </CardBody>
          </Card>

          <Alert tone="info" title="Need help?">
            Email support@shopio.co.tz and our team will walk you through onboarding.
          </Alert>
        </aside>
      </div>
    </div>
  )
}
