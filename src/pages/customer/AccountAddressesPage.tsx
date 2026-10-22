import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import type { Address, City, Region } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui'
import { toast, useAddressesFor, useAuthStore } from '@/context'
import { accountService, geoService } from '@/services'

interface AddressForm {
  label: string
  recipientName: string
  phone: string
  regionId: string
  cityId: string
  district: string
  streetAddress: string
  postalCode: string
  deliveryInstructions: string
  isDefault: boolean
}

const DEFAULTS: AddressForm = {
  label: 'Home',
  recipientName: '',
  phone: '',
  regionId: '',
  cityId: '',
  district: '',
  streetAddress: '',
  postalCode: '',
  deliveryInstructions: '',
  isDefault: false,
}

const LABEL_OPTIONS = [
  { label: 'Home', value: 'Home' },
  { label: 'Office', value: 'Office' },
  { label: 'Other', value: 'Other' },
]

/** Saved shipping addresses with add, edit, default and delete flows. */
export default function AccountAddressesPage() {
  const user = useAuthStore((s) => s.session?.user)
  const addresses = useAddressesFor(user?.id)

  const [regions, setRegions] = useState<Region[]>([])
  const [cities, setCities] = useState<City[]>([])

  useEffect(() => {
    void geoService
      .fetchRegions()
      .then(setRegions)
      .catch(() => setRegions([]))
    void geoService
      .fetchCities()
      .then(setCities)
      .catch(() => setCities([]))
  }, [])

  const regionOptions = useMemo(
    () => regions.map((region) => ({ label: region.name, value: String(region.id) })),
    [regions],
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressForm>({ defaultValues: DEFAULTS })

  const regionId = watch('regionId')

  const cityOptions = useMemo(
    () =>
      cities
        .filter((city) => String(city.regionId) === regionId)
        .map((city) => ({ label: city.name, value: String(city.id) })),
    [regionId],
  )

  const regionField = register('regionId', { required: 'Please choose a region.' })

  const openAdd = () => {
    setEditing(null)
    reset(DEFAULTS)
    setModalOpen(true)
  }

  const openEdit = (address: Address) => {
    const city = cities.find((c) => c.id === address.cityId)
    setEditing(address)
    reset({
      label: address.label ?? 'Home',
      recipientName: address.recipientName,
      phone: address.phone,
      regionId: city ? String(city.regionId) : '',
      cityId: String(address.cityId),
      district: address.district ?? '',
      streetAddress: address.streetAddress,
      postalCode: address.postalCode ?? '',
      deliveryInstructions: address.deliveryInstructions ?? '',
      isDefault: address.isDefault,
    })
    setModalOpen(true)
  }

  const onSubmit = async (values: AddressForm) => {
    if (!user) return
    const payload = {
      label: values.label,
      recipientName: values.recipientName.trim(),
      phone: values.phone.trim(),
      cityId: Number(values.cityId),
      district: values.district.trim() || null,
      streetAddress: values.streetAddress.trim(),
      postalCode: values.postalCode.trim() || null,
      deliveryInstructions: values.deliveryInstructions.trim() || null,
      isDefault: values.isDefault,
    }

    try {
      if (editing) {
        await accountService.updateAddress(editing.id, payload)
        toast.success('Address updated', 'Your shipping address has been saved.')
      } else {
        await accountService.createAddress(payload)
        toast.success('Address added', 'Your new shipping address has been saved.')
      }
      setModalOpen(false)
    } catch (error) {
      toast.error('Address not saved', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const handleSetDefault = async (address: Address) => {
    try {
      await accountService.setDefaultAddress(address.id)
      toast.success('Default address updated', `${address.label ?? 'This address'} is now your default.`)
    } catch (error) {
      toast.error('Could not update default', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    try {
      await accountService.deleteAddress(deleteId)
      setDeleteId(null)
      toast.success('Address removed', 'The address has been deleted.')
    } catch (error) {
      toast.error('Address not removed', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipping addresses"
        description="Manage the addresses you use at checkout. Only one can be the default."
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add address
          </Button>
        }
      />

      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="No saved addresses"
          description="Add a shipping address to speed up checkout."
          action={{ label: 'Add address', onClick: openAdd }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ink-400" />
                  {address.label ?? 'Address'}
                </CardTitle>
                {address.isDefault && (
                  <Badge tone="dark" icon={<Star className="h-3 w-3" />}>
                    Default
                  </Badge>
                )}
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-ink">{address.recipientName}</p>
                  <p className="text-ink-500">{address.phone}</p>
                </div>
                <p className="text-ink-600">
                  {address.streetAddress}
                  {address.district ? `, ${address.district}` : ''}
                  <br />
                  {address.cityName}, {address.regionName}
                  {address.postalCode ? ` · ${address.postalCode}` : ''}
                </p>
                {address.deliveryInstructions && (
                  <p className="rounded-lg bg-sand-50 px-3 py-2 text-xs text-ink-600">
                    {address.deliveryInstructions}
                  </p>
                )}
              </CardBody>
              <div className="flex flex-wrap items-center gap-2 border-t border-ink-200 px-5 py-3">
                <Button variant="outline" size="sm" onClick={() => openEdit(address)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                {!address.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => handleSetDefault(address)}>
                    <Star className="h-3.5 w-3.5" /> Set as default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-danger-700 hover:bg-danger-50"
                  onClick={() => setDeleteId(address.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={editing ? 'Edit address' : 'Add address'}
        description="Used as the delivery destination at checkout."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="address-form">
              {editing ? 'Save changes' : 'Add address'}
            </Button>
          </>
        }
      >
        <form id="address-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <Select label="Label" options={LABEL_OPTIONS} {...register('label')} />
          <Input
            label="Recipient name"
            error={errors.recipientName?.message}
            {...register('recipientName', { required: 'Recipient name is required.' })}
          />
          <Input
            label="Phone"
            type="tel"
            placeholder="+255 7XX XXX XXX"
            error={errors.phone?.message}
            {...register('phone', { required: 'A contact phone number is required.' })}
          />
          <Select
            label="Region"
            placeholder="Select a region"
            options={regionOptions}
            error={errors.regionId?.message}
            {...regionField}
            onChange={(event) => {
              regionField.onChange(event)
              setValue('cityId', '')
            }}
          />
          <Select
            label="City"
            placeholder={regionId ? 'Select a city' : 'Choose a region first'}
            options={cityOptions}
            disabled={!regionId}
            error={errors.cityId?.message}
            {...register('cityId', { required: 'Please choose a city.' })}
          />
          <Input label="District" {...register('district')} />
          <Input
            label="Street address"
            className="sm:col-span-2"
            placeholder="House number, street, landmark"
            error={errors.streetAddress?.message}
            {...register('streetAddress', { required: 'A street address is required.' })}
          />
          <Input label="Postal code" {...register('postalCode')} />
          <Textarea
            label="Delivery instructions"
            rows={3}
            className="sm:col-span-2"
            placeholder="Gate colour, preferred delivery window…"
            {...register('deliveryInstructions')}
          />
          <div className="sm:col-span-2">
            <Checkbox
              label="Set as default address"
              description="Only one address can be the default at a time."
              {...register('isDefault')}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete this address?"
        description="You can add it again later, but this removes it from your saved addresses."
        confirmLabel="Delete address"
        tone="danger"
      />
    </div>
  )
}
