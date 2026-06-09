import { router, useLocalSearchParams } from 'expo-router'
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
  limit,
} from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { auth, db } from '../../lib/firebase/client'
import { useSessionStore } from '../../store/sessionStore'

const CLOUD_RUN_URL =
  (process.env.EXPO_PUBLIC_CLOUD_RUN_URL ?? 'http://localhost:8081').replace(/\/$/, '')

interface CameraSlot {
  id: string
  name: string
  takenBy?: { uid: string; displayName: string }
}

interface SessionState {
  sessionId: string
  cameraSlots: CameraSlot[]
  replayCameraSlot: string
}

export default function PickSlotScreen() {
  const { joinCode, displayName } = useLocalSearchParams<{
    joinCode: string
    displayName: string
  }>()
  const { setSession } = useSessionStore()
  const [session, setSession_] = useState<SessionState | null>(null)
  const [error, setError] = useState('')
  const [claiming, setClaiming] = useState<string | null>(null)

  useEffect(() => {
    if (!joinCode) return

    const q = query(
      collection(db, 'sessions'),
      where('joinCode', '==', joinCode),
      where('status', 'in', ['lobby', 'live']),
      limit(1),
    )

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setError('Session not found or has ended.')
          return
        }
        const d = snap.docs[0]
        const data = d.data()
        setSession_({
          sessionId: d.id,
          cameraSlots: (data.cameraSlots ?? []) as CameraSlot[],
          replayCameraSlot: (data.replayCameraSlot ?? '') as string,
        })
      },
      () => {
        setError('Could not load session. Please try again.')
      },
    )

    return unsubscribe
  }, [joinCode])

  async function handleClaimSlot(slot: CameraSlot) {
    if (!session || !displayName || claiming) return
    const user = auth.currentUser
    if (!user) return

    setClaiming(slot.id)
    setError('')

    try {
      // Transaction: mark slot as taken — prevents race condition
      await runTransaction(db, async (tx) => {
        const sessionRef = doc(db, 'sessions', session.sessionId)
        const snap = await tx.get(sessionRef)
        if (!snap.exists()) throw new Error('Session not found')

        const slots: CameraSlot[] = snap.data().cameraSlots ?? []
        const target = slots.find((s) => s.id === slot.id)
        if (!target) throw new Error('Slot not found')
        if (target.takenBy) throw new Error('Slot already taken. Choose another.')

        tx.update(sessionRef, {
          cameraSlots: slots.map((s) =>
            s.id === slot.id
              ? { ...s, takenBy: { uid: user.uid, displayName } }
              : s,
          ),
        })
      })

      // Get LiveKit token — identity will be slotId per ADR-007
      const idToken = await user.getIdToken()
      const res = await fetch(`${CLOUD_RUN_URL}/session/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          joinCode,
          role: 'camera',
          displayName,
          slotId: slot.id,
        }),
      })

      if (!res.ok) {
        // Release the slot claim so another camera can take it
        await runTransaction(db, async (tx) => {
          const sessionRef = doc(db, 'sessions', session.sessionId)
          const snap = await tx.get(sessionRef)
          if (!snap.exists()) return
          const slots: CameraSlot[] = snap.data().cameraSlots ?? []
          tx.update(sessionRef, {
            cameraSlots: slots.map((s) => {
              if (s.id !== slot.id) return s
              return { id: s.id, name: s.name }
            }),
          })
        })
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? `Server error ${res.status}`)
      }

      const { liveKitToken, sessionId } = (await res.json()) as {
        liveKitToken: string
        sessionId: string
      }
      setSession(sessionId, liveKitToken)
      router.replace({
        pathname: '/(guest)/cam-live',
        params: { slotName: slot.id },
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to claim slot. Try again.')
      setClaiming(null)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!session && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1DB954" />
        <Text style={styles.loadingText}>Finding session…</Text>
      </View>
    )
  }

  if (error && !session) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorHeading}>Can't join session</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    )
  }

  const slots = session?.cameraSlots ?? []
  const availableCount = slots.filter((s) => !s.takenBy).length

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pick Your Slot</Text>
        <Text style={styles.subtitle}>
          Choose the camera angle you'll cover. First to tap locks it in.
        </Text>
      </View>

      {error ? <Text style={styles.errorInline}>{error}</Text> : null}

      {slots.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyText}>No camera slots set up yet.</Text>
          <Text style={styles.emptyHint}>Ask the Director to add slots.</Text>
        </View>
      ) : availableCount === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyText}>All slots are filled.</Text>
          <Text style={styles.emptyHint}>Ask the Director to free a slot.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {slots.map((slot) => {
            const isTaken = Boolean(slot.takenBy)
            const isISO = slot.id === session?.replayCameraSlot
            const isClaiming = claiming === slot.id

            return (
              <TouchableOpacity
                key={slot.id}
                style={[
                  styles.slotCard,
                  isTaken && styles.slotCardTaken,
                  !isTaken && styles.slotCardAvailable,
                ]}
                onPress={() => !isTaken && handleClaimSlot(slot)}
                disabled={isTaken || Boolean(claiming)}
                activeOpacity={0.75}
              >
                {/* Slot code badge */}
                <View style={[styles.codeBadge, isTaken && styles.codeBadgeTaken]}>
                  <Text style={[styles.codeText, isTaken && styles.codeTextTaken]}>
                    {slot.id}
                  </Text>
                </View>

                {/* Label + ISO indicator */}
                <View style={styles.slotInfo}>
                  <View style={styles.slotNameRow}>
                    <Text
                      style={[styles.slotName, isTaken && styles.slotNameTaken]}
                      numberOfLines={1}
                    >
                      {slot.name}
                    </Text>
                    {isISO ? (
                      <Text style={styles.isoIcon}>📹</Text>
                    ) : null}
                  </View>
                  {isTaken ? (
                    <Text style={styles.takenByText}>{slot.takenBy?.displayName}</Text>
                  ) : (
                    <Text style={styles.availableText}>Available</Text>
                  )}
                </View>

                {/* Right-side status */}
                {isClaiming ? (
                  <ActivityIndicator color="#1DB954" size="small" />
                ) : isTaken ? (
                  <View style={styles.lockIcon}>
                    <Text style={styles.lockText}>🔒</Text>
                  </View>
                ) : (
                  <View style={styles.tapChip}>
                    <Text style={styles.tapChipText}>Tap</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginBottom: 6 },
  subtitle: { color: '#B3B3B3', fontSize: 14, lineHeight: 20 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { color: '#B3B3B3', fontSize: 14, marginTop: 12 },
  errorHeading: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: { color: '#B3B3B3', fontSize: 14, textAlign: 'center' },
  errorInline: {
    color: '#FF4444',
    fontSize: 13,
    marginHorizontal: 20,
    marginBottom: 8,
  },

  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptyHint: { color: '#535353', fontSize: 13 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },

  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  slotCardAvailable: {
    backgroundColor: '#1A1A1A',
    borderColor: '#2A2A2A',
  },
  slotCardTaken: {
    backgroundColor: '#141414',
    borderColor: '#1E1E1E',
    opacity: 0.5,
  },

  codeBadge: {
    backgroundColor: '#2A2A2A',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    minWidth: 50,
    alignItems: 'center',
  },
  codeBadgeTaken: { backgroundColor: '#1E1E1E' },
  codeText: { color: '#B3B3B3', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  codeTextTaken: { color: '#535353' },

  slotInfo: { flex: 1 },
  slotNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  slotNameTaken: { color: '#535353' },
  isoIcon: { fontSize: 14 },
  takenByText: { color: '#535353', fontSize: 12, marginTop: 2 },
  availableText: { color: '#1DB954', fontSize: 12, fontWeight: '600', marginTop: 2 },

  lockIcon: { padding: 4 },
  lockText: { fontSize: 16 },

  tapChip: {
    backgroundColor: '#1DB954',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tapChipText: { color: '#000000', fontSize: 13, fontWeight: '700' },
})
