import { useEffect, useMemo, useState } from 'react'
import { FolderTree, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  SmartImage,
  StatCard,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Textarea,
} from '@/components/ui'
import { adminService } from '@/services'
import { useCatalogStore, useCategoryCounts } from '@/context/catalogStore'
import { toast } from '@/context/uiStore'
import { PHOTOS, imgSquare } from '@/content/images'
import type { Category } from '@/types'
import { formatNumber, slugify, truncate } from '@/lib/utils'

const IMAGE_SUGGESTIONS = [
  ...PHOTOS.furniture.slice(0, 2),
  ...PHOTOS.electronics.slice(0, 2),
  ...PHOTOS.fashion.slice(0, 2),
  ...PHOTOS['home-decor'].slice(0, 2),
].map((id) => imgSquare(id, 600))

interface CategoryDraft {
  name: string
  slug: string
  description: string
  imageUrl: string
  sortOrder: string
  status: 'active' | 'inactive'
}

const EMPTY_DRAFT: CategoryDraft = {
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  sortOrder: '',
  status: 'active',
}

/** Category management: create, edit and reorder the storefront navigation. */
export default function AdminCategoriesPage() {
  const categories = useCatalogStore((s) => s.categories)
  const counts = useCategoryCounts()

  const [editing, setEditing] = useState<Category | null>(null)
  const [isAdd, setIsAdd] = useState(false)
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  useEffect(() => {
    void adminService.fetchCategories().catch(() => undefined)
  }, [])

  const sorted = useMemo(() => [...categories].sort((a, b) => a.sortOrder - b.sortOrder), [categories])

  const activeCount = categories.filter((c) => c.status === 'active').length
  const inactiveCount = categories.length - activeCount
  const totalProducts = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts],
  )

  const countFor = (category: Category) => counts[category.slug] ?? category.productCount ?? 0

  const openAdd = () => {
    setIsAdd(true)
    setEditing(null)
    setDraft({ ...EMPTY_DRAFT, sortOrder: String(categories.length + 1) })
  }

  const openEdit = (category: Category) => {
    setIsAdd(false)
    setEditing(category)
    setDraft({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      imageUrl: category.imageUrl ?? '',
      sortOrder: String(category.sortOrder),
      status: category.status,
    })
  }

  const closeForm = () => {
    setIsAdd(false)
    setEditing(null)
    setDraft(EMPTY_DRAFT)
  }

  const save = async () => {
    const name = draft.name.trim()
    const slug = (draft.slug.trim() || slugify(name)).toLowerCase()

    if (!name) {
      toast.error('Name is required', 'Give the category a clear name.')
      return
    }
    if (!slug) {
      toast.error('Slug is required', 'Provide a URL slug or generate one from the name.')
      return
    }
    const clash = categories.find((c) => c.slug === slug && c.id !== editing?.id)
    if (clash) {
      toast.error('Slug already in use', `"${slug}" is used by ${clash.name}. Choose a unique slug.`)
      return
    }

    const sortOrder = Number(draft.sortOrder)
    setBusy(true)
    try {
      if (isAdd) {
        const created = await adminService.createCategory({
          name,
          slug,
          description: draft.description.trim() || null,
          imageUrl: draft.imageUrl || null,
          status: draft.status,
        })
        if (Number.isFinite(sortOrder) && sortOrder > 0 && sortOrder !== created.sortOrder) {
          await adminService.updateCategory(created.id, { sortOrder })
        }
        toast.success('Category created', `${name} is now available in the storefront navigation.`)
      } else if (editing) {
        await adminService.updateCategory(editing.id, {
          name,
          slug,
          description: draft.description.trim() || null,
          imageUrl: draft.imageUrl || null,
          sortOrder: Number.isFinite(sortOrder) && sortOrder > 0 ? sortOrder : editing.sortOrder,
          status: draft.status,
        })
        toast.success('Category updated', `${name} saved.`)
      }
      closeForm()
    } finally {
      setBusy(false)
    }
  }

  const requestDelete = (category: Category) => {
    const count = countFor(category)
    if (count > 0) {
      toast.error(
        'Category still has products',
        `Reassign or archive the ${count} product(s) in ${category.name} before deleting it.`,
      )
      return
    }
    setDeleteTarget(category)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await adminService.deleteCategory(deleteTarget.id)
      toast.success('Category deleted', `${deleteTarget.name} was removed from the catalogue.`)
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="The top-level taxonomy that structures storefront navigation and search."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        }
      />

      <section aria-label="Category summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total categories" value={formatNumber(categories.length)} icon={<FolderTree className="h-4 w-4" />} hint="top-level" />
        <StatCard label="Active / inactive" value={`${activeCount} / ${inactiveCount}`} icon={<FolderTree className="h-4 w-4" />} hint="shown in navigation" />
        <StatCard label="Products categorised" value={formatNumber(totalProducts)} icon={<FolderTree className="h-4 w-4" />} hint="active listings" />
      </section>

      <div className="rounded-card border border-ink-200 bg-white shadow-card">
        {sorted.length === 0 ? (
          <div className="p-6">
            <EmptyState
              size="sm"
              icon={<FolderTree className="h-5 w-5" />}
              title="No categories yet"
              description="Add the first category to start organising the catalogue."
              action={{ label: 'Add category', onClick: openAdd }}
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Category</TH>
                <TH>Slug</TH>
                <TH>Description</TH>
                <TH>Products</TH>
                <TH>Sort order</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {sorted.map((category) => (
                <TR key={category.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <SmartImage
                        src={category.imageUrl ?? undefined}
                        alt={category.name}
                        wrapperClassName="h-10 w-10 shrink-0 rounded-lg"
                        fallbackLabel={category.name}
                      />
                      <span className="font-medium text-ink">{category.name}</span>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap text-ink-500">/{category.slug}</TD>
                  <TD className="max-w-[18rem] text-ink-600">{truncate(category.description ?? '—', 70)}</TD>
                  <TD>{formatNumber(countFor(category))}</TD>
                  <TD>{category.sortOrder}</TD>
                  <TD>
                    <Badge tone={category.status === 'active' ? 'success' : 'neutral'}>{category.status}</Badge>
                  </TD>
                  <TD className="text-right">
                    <Dropdown
                      label={`Actions for ${category.name}`}
                      trigger={
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink">
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      }
                      items={[
                        { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => openEdit(category) },
                        { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, tone: 'danger', onClick: () => requestDelete(category) },
                      ]}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-ink-500">
        Category sort order drives the storefront navigation and the order categories appear on the home page.
      </p>

      {/* Add / edit */}
      <Modal
        open={isAdd || !!editing}
        onClose={closeForm}
        title={isAdd ? 'Add category' : 'Edit category'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeForm} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {isAdd ? 'Create category' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
          />
          <div className="flex items-end gap-2">
            <Input
              label="Slug"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              hint="Used in the category URL, e.g. /categories/furniture"
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, slug: slugify(draft.name) })}>
              Generate
            </Button>
          </div>
          <Textarea
            label="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={3}
          />
          <Input
            label="Image URL"
            value={draft.imageUrl}
            onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
            placeholder="https://…"
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Suggested images</p>
            <div className="flex flex-wrap gap-2">
              {IMAGE_SUGGESTIONS.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setDraft({ ...draft, imageUrl: url })}
                  aria-label="Use this image"
                  aria-pressed={draft.imageUrl === url}
                  className={`overflow-hidden rounded-lg border-2 transition ${
                    draft.imageUrl === url ? 'border-ink' : 'border-transparent hover:border-ink-300'
                  }`}
                >
                  <SmartImage src={url} alt="Category suggestion" wrapperClassName="h-14 w-14" />
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Sort order"
              type="number"
              min={1}
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
              hint="Lower numbers appear first."
            />
            <Select
              label="Status"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as 'active' | 'inactive' })}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ]}
            />
          </div>
          <p className="text-xs text-ink-500">Changes are applied to the catalogue.</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : ''}
        description="This permanently removes the category. It cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={busy}
      />
    </div>
  )
}
