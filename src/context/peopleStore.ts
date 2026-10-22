import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { RoleCode, Seller, User, UserStatus, VerificationStatus } from '@/types'

/**
 * People directory cache — users and sellers loaded from the admin API.
 * Actions update the local mirror after a successful server mutation.
 */

interface PeopleState {
  users: User[]
  sellers: Seller[]

  setUsers: (users: User[]) => void
  setSellers: (sellers: Seller[]) => void
  upsertUser: (user: User) => void
  upsertSeller: (seller: Seller) => void

  setUserStatus: (userId: number, status: UserStatus) => void
  updateUser: (userId: number, patch: Partial<User>) => void
  setUserRoles: (userId: number, roles: RoleCode[]) => void

  setSellerVerification: (sellerId: number, status: VerificationStatus, notes?: string) => void
  setSellerStatus: (sellerId: number, status: Seller['status']) => void
  updateSeller: (sellerId: number, patch: Partial<Seller>) => void
}

export const usePeopleStore = create<PeopleState>((set, get) => ({
  users: [],
  sellers: [],

  setUsers(users) {
    set({ users })
  },

  setSellers(sellers) {
    set({ sellers })
  },

  upsertUser(user) {
    const users = get().users
    const index = users.findIndex((item) => item.id === user.id)
    if (index === -1) {
      set({ users: [user, ...users] })
      return
    }
    const copy = [...users]
    copy[index] = user
    set({ users: copy })
  },

  upsertSeller(seller) {
    const sellers = get().sellers
    const index = sellers.findIndex((item) => item.id === seller.id)
    if (index === -1) {
      set({ sellers: [seller, ...sellers] })
      return
    }
    const copy = [...sellers]
    copy[index] = seller
    set({ sellers: copy })
  },

  setUserStatus(userId, status) {
    set({ users: get().users.map((user) => (user.id === userId ? { ...user, status } : user)) })
  },

  updateUser(userId, patch) {
    set({ users: get().users.map((user) => (user.id === userId ? { ...user, ...patch } : user)) })
  },

  setUserRoles(userId, roles) {
    set({ users: get().users.map((user) => (user.id === userId ? { ...user, roles } : user)) })
  },

  setSellerVerification(sellerId, status, notes) {
    set({
      sellers: get().sellers.map((seller) =>
        seller.id === sellerId
          ? { ...seller, verificationStatus: status, verificationNotes: notes ?? null }
          : seller,
      ),
    })
  },

  setSellerStatus(sellerId, status) {
    set({ sellers: get().sellers.map((seller) => (seller.id === sellerId ? { ...seller, status } : seller)) })
  },

  updateSeller(sellerId, patch) {
    set({ sellers: get().sellers.map((seller) => (seller.id === sellerId ? { ...seller, ...patch } : seller)) })
  },
}))

/* -------------------------------------------------------------------------- */
/* Selectors                                                                   */
/* -------------------------------------------------------------------------- */

export function useUsers() {
  return usePeopleStore((s) => s.users)
}

export function useCustomers() {
  return usePeopleStore(useShallow((s) => s.users.filter((user) => user.roles.includes('customer'))))
}

export function useSellers() {
  return usePeopleStore((s) => s.sellers)
}

export function useSeller(sellerId: number | null | undefined) {
  return usePeopleStore((s) => (sellerId == null ? undefined : s.sellers.find((x) => x.id === sellerId)))
}

export function useUser(userId: number | null | undefined) {
  return usePeopleStore((s) => (userId == null ? undefined : s.users.find((x) => x.id === userId)))
}

export function usePendingSellers() {
  return usePeopleStore(
    useShallow((s) => s.sellers.filter((x) => x.verificationStatus === 'pending')),
  )
}
