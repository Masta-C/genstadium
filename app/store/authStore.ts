import { create } from 'zustand'
import type { User } from 'firebase/auth'

export type DirectorRole = 'director'
export type GuestRole = 'camera' | 'scorekeeper'
export type AppRole = DirectorRole | GuestRole | null

interface AuthState {
  user: User | null
  role: AppRole
  loading: boolean
  setUser: (user: User | null) => void
  setRole: (role: AppRole) => void
  setLoading: (loading: boolean) => void
  signOut: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  loading: true,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (loading) => set({ loading }),
  signOut: () => set({ user: null, role: null, loading: false }),
}))
