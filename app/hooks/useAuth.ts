import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase/client'
import { useAuthStore, type AppRole } from '../store/authStore'

/**
 * useAuth — subscribes to Firebase Auth state and syncs it into Zustand.
 *
 * Rules:
 * - Never calls getIdToken(true) (force-refresh) — Firebase SDK refreshes automatically.
 * - Role is read from Firestore users/{uid}.role for Directors.
 *   Anonymous users get their role from the session participant doc (set at join time).
 * - Must be mounted at root layout so auth state is available across all screens.
 */
export function useAuth() {
  const { setUser, setRole, setLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setRole(null)
        setLoading(false)
        return
      }

      setUser(firebaseUser)

      // For non-anonymous users, read role from Firestore
      if (!firebaseUser.isAnonymous) {
        try {
          const userDoc = await getDoc(doc(db, `users/${firebaseUser.uid}`))
          const role = (userDoc.data()?.role ?? null) as AppRole
          setRole(role)
        } catch {
          setRole('director') // fallback — Firestore rules will enforce access
        }
      } else {
        // Anonymous users: role resolved per-session at join time
        setRole(null)
      }

      setLoading(false)
    })

    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
