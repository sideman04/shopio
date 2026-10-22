import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Address } from '@/types'

/**
 * Customer address book cache. Hydrated from `/customers/addresses`; mutations
 * are performed by the service layer and mirrored here.
 */

interface AccountState {
  addresses: Address[]
  setAddresses: (addresses: Address[]) => void
  upsertAddress: (address: Address) => void
  removeAddress: (id: number) => void
  createAddress: (address: Address) => void
  updateAddress: (id: number, patch: Partial<Address>) => void
  deleteAddress: (id: number) => void
  setDefault: (id: number) => void
}

export const useAccountStore = create<AccountState>((set, get) => ({
  addresses: [],

  setAddresses(addresses) {
    set({ addresses })
  },

  upsertAddress(address) {
    const current = get().addresses
    const index = current.findIndex((item) => item.id === address.id)
    if (index === -1) {
      set({ addresses: [...current, address] })
      return
    }
    const copy = [...current]
    copy[index] = address
    set({ addresses: copy })
  },

  removeAddress(id) {
    set({ addresses: get().addresses.filter((address) => address.id !== id) })
  },

  createAddress(address) {
    set({ addresses: [...get().addresses, address] })
  },

  updateAddress(id, patch) {
    set({ addresses: get().addresses.map((address) => (address.id === id ? { ...address, ...patch } : address)) })
  },

  deleteAddress(id) {
    set({ addresses: get().addresses.filter((address) => address.id !== id) })
  },

  setDefault(id) {
    const current = get().addresses.find((address) => address.id === id)
    if (!current) return
    set({
      addresses: get().addresses.map((address) =>
        address.userId === current.userId ? { ...address, isDefault: address.id === id } : address,
      ),
    })
  },
}))

export function useAddressesFor(userId: number | null | undefined) {
  return useAccountStore(
    useShallow((s) => (userId == null ? [] : s.addresses.filter((address) => address.userId === userId))),
  )
}
