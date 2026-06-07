import { create } from 'zustand'

interface SessionState {
  sessionId: string | null
  liveKitToken: string | null
  setSession: (sessionId: string, liveKitToken: string) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  liveKitToken: null,
  setSession: (sessionId, liveKitToken) => set({ sessionId, liveKitToken }),
  clearSession: () => set({ sessionId: null, liveKitToken: null }),
}))
