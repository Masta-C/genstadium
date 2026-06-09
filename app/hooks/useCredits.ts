import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase/client'
import { useAuthStore } from '../store/authStore'

/**
 * Subscribes to users/{uid}/credits/balance and returns the credit count.
 * Returns null while loading (UID not yet available or first snapshot pending).
 * Automatically unsubscribes when the component unmounts or UID changes.
 */
export function useCredits(): number | null {
  const user = useAuthStore((s) => s.user)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!user?.uid) {
      setBalance(null)
      return
    }
    const ref = doc(db, `users/${user.uid}/credits/balance`)
    const unsubscribe = onSnapshot(ref, (snap) => {
      setBalance(snap.exists() ? ((snap.data().balance as number | undefined) ?? 0) : 0)
    })
    return unsubscribe
  }, [user?.uid])

  return balance
}
