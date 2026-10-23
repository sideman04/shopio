import { useEffect, useMemo, useState } from 'react'
import {
  Ban,
  Check,
  Download,
  Eye,
  KeyRound,
  MoreHorizontal,
  Send,
  ShieldCheck,
  UserCog,
  Users as UsersIcon,
} from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  DataList,
  Drawer,
  Dropdown,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  StatusBadge,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '@/components/ui'
import { DataToolbar } from '@/components/tables/DataToolbar'
import { adminService } from '@/services'
import * as authService from '@/services/authService'
import { errorMessage } from '@/services/apiClient'
import { usePeopleStore } from '@/context/peopleStore'
import { toast } from '@/context/uiStore'
import type { RoleCode, User, UserStatus } from '@/types'
import { formatDate, formatNumber, relativeTime } from '@/lib/utils'

const PAGE_SIZE = 8

const ROLE_TONES: Record<RoleCode, 'neutral' | 'info' | 'dark'> = {
  customer: 'neutral',
  seller: 'info',
  admin: 'dark',
}

const ROLE_LABELS: Record<RoleCode, string> = {
  customer: 'Customer',
  seller: 'Seller',
  admin: 'Admin',
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '')
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(','),
    )
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Admin user directory: search, filter, role management and account status. */
export default function AdminUsersPage() {
  const users = usePeopleStore((s) => s.users)

  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

  const [viewUser, setViewUser] = useState<User | null>(null)
  const [roleUser, setRoleUser] = useState<User | null>(null)
  const [roleDraft, setRoleDraft] = useState<RoleCode[]>([])
  const [confirm, setConfirm] = useState<{ ids: number[]; status: UserStatus; title: string; description: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, role, status])

  useEffect(() => {
    void adminService.fetchUsers({ pageSize: 100 }).catch(() => undefined)
  }, [])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return users.filter((user) => {
      if (role !== 'all' && !user.roles.includes(role as RoleCode)) return false
      if (status !== 'all' && user.status !== status) return false
      if (needle) {
        const haystack = [user.fullName, user.email, user.phone ?? ''].join(' ').toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [users, role, status, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const stats = useMemo(() => {
    const total = users.length
    const active = users.filter((u) => u.status === 'active').length
    const pending = users.filter((u) => u.status === 'pending').length
    const restricted = users.filter((u) => u.status === 'suspended' || u.status === 'disabled').length
    const customers = users.filter((u) => u.roles.includes('customer')).length
    const sellerAccounts = users.filter((u) => u.roles.includes('seller')).length
    return { total, active, pending, restricted, customers, sellerAccounts }
  }, [users])

  const allOnPageSelected = paged.length > 0 && paged.every((u) => selected.includes(u.id))

  const toggleOne = (id: number) => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
  }

  const togglePage = () => {
    if (allOnPageSelected) {
      setSelected((current) => current.filter((id) => !paged.some((u) => u.id === id)))
    } else {
      setSelected((current) => Array.from(new Set([...current, ...paged.map((u) => u.id)])))
    }
  }

  const applyStatus = async (ids: number[], next: UserStatus, title: string) => {
    setBusy(true)
    try {
      await Promise.all(ids.map((id) => adminService.setUserStatus(id, next)))
      toast.success(title, `${ids.length} account${ids.length === 1 ? '' : 's'} updated.`)
      setSelected([])
      setConfirm(null)
    } catch (error) {
      toast.error('Account status not updated', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const openRoles = (user: User) => {
    setRoleUser(user)
    setRoleDraft(user.roles)
  }

  const saveRoles = async () => {
    if (!roleUser) return
    if (roleDraft.length === 0) {
      toast.error('Select at least one role', 'Every account needs a role.')
      return
    }
    try {
      await adminService.setUserRoles(roleUser.id, roleDraft)
      toast.success('Roles updated', `${roleUser.fullName} now has ${roleDraft.map((r) => ROLE_LABELS[r]).join(', ')}.`)
      setRoleUser(null)
    } catch (error) {
      toast.error('Could not update roles', errorMessage(error))
    }
  }

  const handleExport = () => {
    downloadCsv('shopio-users.csv', [
      ['ID', 'Name', 'Email', 'Phone', 'Roles', 'Status', 'Joined', 'Last login'],
      ...filtered.map((u) => [
        u.id,
        u.fullName,
        u.email,
        u.phone ?? '',
        u.roles.join(' / '),
        u.status,
        u.createdAt,
        u.lastLoginAt ?? '',
      ]),
    ])
    toast.success('Export ready', `${filtered.length} users exported to CSV.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Every customer, seller and administrator account on the platform."
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <section aria-label="User summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total users" value={formatNumber(stats.total)} icon={<UsersIcon className="h-4 w-4" />} hint="all accounts" />
        <StatCard label="Active" value={formatNumber(stats.active)} icon={<Check className="h-4 w-4" />} hint="can sign in" />
        <StatCard label="Pending" value={formatNumber(stats.pending)} icon={<ShieldCheck className="h-4 w-4" />} hint="email unverified" />
        <StatCard label="Restricted" value={formatNumber(stats.restricted)} icon={<Ban className="h-4 w-4" />} hint="suspended or disabled" />
        <StatCard
          label="Customers / sellers"
          value={`${formatNumber(stats.customers)} / ${formatNumber(stats.sellerAccounts)}`}
          icon={<UserCog className="h-4 w-4" />}
          hint="by primary role"
        />
      </section>

      <div className="rounded-card border border-ink-200 bg-white shadow-card">
        <DataToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, email or phone"
        >
          <label className="sr-only" htmlFor="users-role-filter">
            Filter by role
          </label>
          <Select
            id="users-role-filter"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { label: 'All roles', value: 'all' },
              { label: 'Customers', value: 'customer' },
              { label: 'Sellers', value: 'seller' },
              { label: 'Admins', value: 'admin' },
            ]}
            className="w-40"
          />
          <label className="sr-only" htmlFor="users-status-filter">
            Filter by status
          </label>
          <Select
            id="users-status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { label: 'All statuses', value: 'all' },
              { label: 'Pending', value: 'pending' },
              { label: 'Active', value: 'active' },
              { label: 'Suspended', value: 'suspended' },
              { label: 'Disabled', value: 'disabled' },
            ]}
            className="w-40"
          />
        </DataToolbar>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 bg-sand-50 px-4 py-3">
            <p className="text-sm font-medium text-ink">{selected.length} selected</p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setConfirm({
                    ids: selected,
                    status: 'active',
                    title: 'Activate selected accounts?',
                    description: 'The selected users will regain sign-in access.',
                  })
                }
              >
                Activate
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  setConfirm({
                    ids: selected,
                    status: 'suspended',
                    title: 'Suspend selected accounts?',
                    description: 'Suspended users cannot sign in until an administrator reactivates them.',
                  })
                }
              >
                Suspend
              </Button>
            </div>
          </div>
        )}

        {paged.length === 0 ? (
          <div className="p-6">
            <EmptyState
              size="sm"
              icon={<UsersIcon className="h-5 w-5" />}
              title="No users match your filters"
              description="Try a different search term, role or status."
              action={{ label: 'Clear filters', onClick: () => { setSearch(''); setRole('all'); setStatus('all') } }}
            />
          </div>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onChange={togglePage}
                      aria-label="Select all users on this page"
                    />
                  </TH>
                  <TH>User</TH>
                  <TH>Phone</TH>
                  <TH>Roles</TH>
                  <TH>Status</TH>
                  <TH>Joined</TH>
                  <TH>Last login</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {paged.map((user) => (
                  <TR key={user.id}>
                    <TD>
                      <Checkbox
                        checked={selected.includes(user.id)}
                        onChange={() => toggleOne(user.id)}
                        aria-label={`Select ${user.fullName}`}
                      />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{user.fullName}</p>
                          <p className="truncate text-xs text-ink-500">{user.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap">{user.phone ?? '—'}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((r) => (
                          <Badge key={r} tone={ROLE_TONES[r]} size="sm">
                            {ROLE_LABELS[r]}
                          </Badge>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <StatusBadge status={user.status} kind="user" />
                    </TD>
                    <TD className="whitespace-nowrap">{formatDate(user.createdAt)}</TD>
                    <TD className="whitespace-nowrap">{user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'Never'}</TD>
                    <TD className="text-right">
                      <Dropdown
                        label={`Actions for ${user.fullName}`}
                        trigger={
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink">
                            <MoreHorizontal className="h-4 w-4" />
                          </span>
                        }
                        items={[
                          { label: 'View profile', icon: <Eye className="h-4 w-4" />, onClick: () => setViewUser(user) },
                          { label: 'Change role', icon: <UserCog className="h-4 w-4" />, onClick: () => openRoles(user) },
                          {
                            label: 'Reset password',
                            icon: <KeyRound className="h-4 w-4" />,
                            onClick: async () => {
                              try {
                                await authService.requestPasswordReset(user.email)
                                toast.success('Reset email requested', `A password reset link was requested for ${user.email}.`)
                              } catch (error) {
                                toast.error('Could not request password reset', errorMessage(error))
                              }
                            },
                          },
                          {
                            label: 'Contact by email',
                            icon: <Send className="h-4 w-4" />,
                            onClick: () => {
                              window.location.href = `mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent('Shopio account')}`
                            },
                          },
                          ...(user.status !== 'active'
                            ? [{ label: 'Activate', icon: <Check className="h-4 w-4" />, divider: true, onClick: () => applyStatus([user.id], 'active', 'Account activated') }]
                            : []),
                          {
                            label: 'Suspend',
                            icon: <Ban className="h-4 w-4" />,
                            tone: 'danger',
                            disabled: user.status === 'suspended',
                            onClick: () =>
                              setConfirm({
                                ids: [user.id],
                                status: 'suspended',
                                title: `Suspend ${user.fullName}?`,
                                description: 'Suspended users cannot sign in until an administrator reactivates them.',
                              }),
                          },
                          {
                            label: 'Disable',
                            icon: <Ban className="h-4 w-4" />,
                            tone: 'danger',
                            disabled: user.status === 'disabled',
                            onClick: () =>
                              setConfirm({
                                ids: [user.id],
                                status: 'disabled',
                                title: `Disable ${user.fullName}?`,
                                description: 'Disabled accounts cannot sign in until an administrator reactivates them.',
                              }),
                          },
                        ]}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            <div className="p-4">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
              />
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-ink-500">
        Account status and role changes are written to the audit log.
      </p>

      {/* View profile */}
      <Drawer open={!!viewUser} onClose={() => setViewUser(null)} title="User profile" width="md">
        {viewUser && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={viewUser.fullName} src={viewUser.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-ink">{viewUser.fullName}</p>
                <p className="truncate text-sm text-ink-500">{viewUser.email}</p>
              </div>
            </div>
            <DataList
              items={[
                { label: 'Account ID', value: `#${viewUser.id}` },
                { label: 'Phone', value: viewUser.phone ?? '—' },
                { label: 'Status', value: <StatusBadge status={viewUser.status} kind="user" /> },
                {
                  label: 'Roles',
                  value: (
                    <div className="flex flex-wrap gap-1">
                      {viewUser.roles.map((r) => (
                        <Badge key={r} tone={ROLE_TONES[r]} size="sm">
                          {ROLE_LABELS[r]}
                        </Badge>
                      ))}
                    </div>
                  ),
                },
                { label: 'Email verified', value: viewUser.emailVerifiedAt ? formatDate(viewUser.emailVerifiedAt) : 'Not verified' },
                { label: 'Joined', value: formatDate(viewUser.createdAt, 'long') },
                { label: 'Last login', value: viewUser.lastLoginAt ? formatDate(viewUser.lastLoginAt, 'time') : 'Never' },
                { label: 'Seller profile', value: viewUser.sellerId ? `Seller #${viewUser.sellerId}` : 'Not a seller' },
              ]}
            />
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                openRoles(viewUser)
                setViewUser(null)
              }}
            >
              <UserCog className="h-4 w-4" />
              Change role
            </Button>
          </div>
        )}
      </Drawer>

      {/* Change role */}
      <Modal
        open={!!roleUser}
        onClose={() => setRoleUser(null)}
        title="Change roles"
        description={roleUser ? `Assign roles for ${roleUser.fullName}.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleUser(null)}>
              Cancel
            </Button>
            <Button onClick={saveRoles}>Save roles</Button>
          </>
        }
      >
        <div className="space-y-4">
          {(['customer', 'seller', 'admin'] as RoleCode[]).map((r) => (
            <Checkbox
              key={r}
              label={ROLE_LABELS[r]}
              description={
                r === 'customer'
                  ? 'Can shop, place orders and leave reviews.'
                  : r === 'seller'
                    ? 'Can list products and fulfil orders.'
                    : 'Full access to the admin console.'
              }
              checked={roleDraft.includes(r)}
              onChange={() =>
                setRoleDraft((current) =>
                  current.includes(r) ? current.filter((x) => x !== r) : [...current, r],
                )
              }
            />
          ))}
          <p className="text-xs text-ink-500">
            Role changes take effect immediately. Permissions are enforced server-side.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && applyStatus(confirm.ids, confirm.status, 'Account status updated')}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        confirmLabel={confirm?.status === 'active' ? 'Activate' : 'Confirm'}
        tone={confirm?.status === 'active' ? 'default' : 'danger'}
        loading={busy}
      />
    </div>
  )
}
