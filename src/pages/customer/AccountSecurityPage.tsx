import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui'
import { toast, useAuthStore } from '@/context'
import { accountService, authService } from '@/services'
import { errorMessage } from '@/services/apiClient'
import { cn, formatDate } from '@/lib/utils'

interface PasswordForm {
  current: string
  next: string
  confirm: string
}

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']

function strengthOf(value: string) {
  let score = 0
  if (value.length >= 8) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return score
}

/** Best-effort device label derived from the session's user-agent string. */
function describeDevice(userAgent: string | null): { label: string; icon: typeof Monitor } {
  const ua = (userAgent ?? '').toLowerCase()
  const mobile = /iphone|ipad|ipod|android|mobile/.test(ua)

  let os = 'Unknown OS'
  if (/windows/.test(ua)) os = 'Windows'
  else if (/iphone|ipad|ipod/.test(ua)) os = 'iOS'
  else if (/android/.test(ua)) os = 'Android'
  else if (/mac os x|macintosh/.test(ua)) os = 'macOS'
  else if (/linux/.test(ua)) os = 'Linux'

  let browser = 'Unknown browser'
  if (/edg\//.test(ua)) browser = 'Edge'
  else if (/chrome|crios/.test(ua)) browser = 'Chrome'
  else if (/firefox|fxios/.test(ua)) browser = 'Firefox'
  else if (/safari/.test(ua)) browser = 'Safari'

  return {
    label: userAgent ? `${browser} on ${os}` : 'Unknown device',
    icon: mobile ? Smartphone : Monitor,
  }
}

/** Security settings: password, 2FA, sessions, login activity and danger zone. */
export default function AccountSecurityPage() {
  const user = useAuthStore((s) => s.session?.user)

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const [sessions, setSessions] = useState<accountService.ActiveSession[]>([])
  const [activity, setActivity] = useState<accountService.LoginActivityEntry[]>([])
  const [loadingSecurity, setLoadingSecurity] = useState(true)
  const [revoking, setRevoking] = useState<number | 'all' | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ defaultValues: { current: '', next: '', confirm: '' } })

  const nextPassword = watch('next') ?? ''
  const strength = strengthOf(nextPassword)
  const strengthTone = useMemo(() => {
    if (strength <= 1) return 'bg-danger-600'
    if (strength === 2) return 'bg-gold-500'
    if (strength === 3) return 'bg-info-600'
    return 'bg-success-600'
  }, [strength])

  const loadSecurity = async () => {
    setLoadingSecurity(true)
    try {
      const [nextSessions, nextActivity] = await Promise.all([
        accountService.fetchSessions(),
        accountService.fetchLoginActivity(),
      ])
      setSessions(nextSessions)
      setActivity(nextActivity)
    } catch (error) {
      toast.error('Could not load sign-in activity', errorMessage(error))
    } finally {
      setLoadingSecurity(false)
    }
  }

  useEffect(() => {
    void loadSecurity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authService.changePassword(values.current, values.next, values.confirm)
      toast.success('Password updated', 'Your other devices have been signed out.')
      reset()
      await loadSecurity()
    } catch (error) {
      toast.error('Could not update password', errorMessage(error))
    }
  })

  const handleRevoke = async (session: accountService.ActiveSession) => {
    setRevoking(session.id)
    try {
      await accountService.revokeSession(session.id)
      toast.success('Session ended', `${describeDevice(session.userAgent).label} was signed out.`)
      await loadSecurity()
    } catch (error) {
      toast.error('Could not end the session', errorMessage(error))
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeOthers = async () => {
    setRevoking('all')
    try {
      const count = await accountService.revokeOtherSessions()
      toast.success(
        'Other devices signed out',
        count === 0 ? 'There were no other active sessions.' : `${count} session(s) ended.`,
      )
      await loadSecurity()
    } catch (error) {
      toast.error('Could not sign out other devices', errorMessage(error))
    } finally {
      setRevoking(null)
    }
  }

  const handleDelete = () => {
    setDeleteOpen(false)
    setConfirmText('')
    toast.info(
      'Account deletion requires backend verification',
      'Contact support to have your account removed.',
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Manage your password, sign-in methods and active sessions."
      />

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardBody className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Current password"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                error={errors.current?.message}
                trailingAddon={
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                    className="rounded p-1 text-ink-500 hover:text-ink"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                {...register('current', { required: 'Enter your current password.' })}
              />
              <div className="hidden sm:block" />
              <Input
                label="New password"
                type={showNext ? 'text' : 'password'}
                autoComplete="new-password"
                error={errors.next?.message}
                trailingAddon={
                  <button
                    type="button"
                    onClick={() => setShowNext((v) => !v)}
                    aria-label={showNext ? 'Hide new password' : 'Show new password'}
                    className="rounded p-1 text-ink-500 hover:text-ink"
                  >
                    {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                {...register('next', {
                  required: 'Enter a new password.',
                  minLength: { value: 8, message: 'Use at least 8 characters.' },
                })}
              />
              <Input
                label="Confirm new password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                error={errors.confirm?.message}
                trailingAddon={
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                    className="rounded p-1 text-ink-500 hover:text-ink"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                {...register('confirm', {
                  required: 'Confirm your new password.',
                  validate: (value) => value === getValues('next') || 'Passwords do not match.',
                })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-500">Password strength</span>
                <span className="font-medium text-ink">{STRENGTH_LABELS[strength]}</span>
              </div>
              <div className="mt-1.5 flex gap-1">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={cn(
                      'h-1.5 flex-1 rounded-full',
                      index < strength ? strengthTone : 'bg-ink-100',
                    )}
                  />
                ))}
              </div>
            </div>
          </CardBody>
          <CardFooter className="justify-end">
            <Button type="submit" loading={isSubmitting}>
              <KeyRound className="h-4 w-4" /> Update password
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Active sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokeOthers}
            loading={revoking === 'all'}
            disabled={loadingSecurity || revokeOthersDisabled(sessions)}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out of all other devices
          </Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-ink-500">
              {loadingSecurity ? 'Loading your devices…' : 'No active sessions were found.'}
            </p>
          ) : (
            sessions.map((session) => {
              const device = describeDevice(session.userAgent)
              return (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center gap-4 rounded-lg border border-ink-200 p-4"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
                    <device.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-ink">{device.label}</p>
                      {session.current && <Badge tone="success">This device</Badge>}
                    </div>
                    <p className="truncate text-xs text-ink-500">
                      {session.ipAddress ?? 'Unknown IP'} · Last active{' '}
                      {formatDate(session.lastUsedAt ?? session.createdAt, 'time')}
                    </p>
                  </div>
                  {!session.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(session)}
                      loading={revoking === session.id}
                    >
                      Sign out
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </CardBody>
      </Card>

      {/* Login activity */}
      <Card>
        <CardHeader>
          <CardTitle>Login activity</CardTitle>
        </CardHeader>
        {activity.length === 0 ? (
          <CardBody>
            <EmptyState
              size="sm"
              icon={<ShieldCheck className="h-5 w-5" />}
              title={loadingSecurity ? 'Loading…' : 'No sign-in history yet'}
              description="Successful and failed sign-in attempts for your account appear here."
            />
          </CardBody>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>IP address</TH>
                <TH>When</TH>
                <TH>Result</TH>
              </TR>
            </THead>
            <TBody>
              {activity.map((entry) => (
                <TR key={entry.id}>
                  <TD className="font-medium text-ink">{entry.ipAddress ?? '—'}</TD>
                  <TD className="whitespace-nowrap">{formatDate(entry.createdAt, 'time')}</TD>
                  <TD>
                    <Badge tone={entry.successful ? 'success' : 'danger'}>
                      {entry.successful ? 'Success' : 'Failed'}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Danger zone */}
      <Card className="border-danger-100">
        <CardHeader>
          <CardTitle className="text-danger-700">Danger zone</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-ink">Delete account</p>
            <p className="mt-0.5 text-sm text-ink-500">
              Permanently remove your account and all associated data. This cannot be undone.
            </p>
          </div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete account
          </Button>
        </CardBody>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
          setConfirmText('')
        }}
        size="sm"
        title="Delete your account"
        description="This action is permanent."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false)
                setConfirmText('')
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" disabled={confirmText !== 'DELETE'} onClick={handleDelete}>
              Delete account
            </Button>
          </>
        }
      >
        <Alert tone="danger" title="This cannot be undone">
          Deleting your account removes your orders, reviews and saved addresses.
        </Alert>
        <div className="mt-4">
          <Input
            label="Type DELETE to confirm"
            value={confirmText}
            placeholder="DELETE"
            onChange={(event) => setConfirmText(event.target.value)}
          />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            {user ? `Signed in as ${user.email}` : 'Signed in'}
          </p>
        </div>
      </Modal>
    </div>
  )
}

/** Only offer "sign out other devices" when there is more than the current one. */
function revokeOthersDisabled(sessions: accountService.ActiveSession[]): boolean {
  return sessions.filter((session) => !session.current).length === 0
}
