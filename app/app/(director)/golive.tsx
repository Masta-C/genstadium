/**
 * golive.tsx — Director Go Live screen.
 *
 * Final pre-flight screen before the stream starts. Director picks the starting
 * camera source and sees a readiness checklist. ISO Camera gate is a hard block;
 * all other checks are warnings only.
 *
 * Calls POST /session/start on Cloud Run (implemented in #69).
 * Navigates to /(director)/live on success.
 */

import { router, useLocalSearchParams } from 'expo-router'
import { collection, doc, onSnapshot } from 'firebase/firestore'
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
import { useAuthStore } from '../../store/authStore'

const CLOUD_RUN_URL =
  (process.env.EXPO_PUBLIC_CLOUD_RUN_URL ?? 'http://localhost:8081').replace(/\/$/, '')

interface CameraSlot {
  id: string
  name: string
}

interface Participant {
  uid: string
  role: 'camera' | 'scorekeeper' | 'director'
  status: string
  slotId?: string
}

interface SessionData {
  sessionName: string
  cameraSlots: CameraSlot[]
  replayCameraSlot: string
  youtubeStreamKey?: string
}

export default function GoLiveScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { user } = useAuthStore()

  const [session, setSession] = useState<SessionData | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) return

    const sessionUnsub = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      const slots = (data.cameraSlots as CameraSlot[]) ?? []
      const replaySlot = (data.replayCameraSlot as string) ?? ''
      setSession({
        sessionName: (data.sessionName as string) ?? '',
        cameraSlots: slots,
        replayCameraSlot: replaySlot,
        youtubeStreamKey: data.youtubeStreamKey as string | undefined,
      })
      // Default selection = ISO Camera slot
      setSelectedSlotId((prev) => prev ?? replaySlot ?? (slots[0]?.id ?? null))
    })

    const participantsUnsub = onSnapshot(
      collection(db, 'sessions', sessionId, 'participants'),
      (snap) => {
        setParticipants(
          snap.docs.map((d) => ({
            uid: d.id,
            role: d.data().role as Participant['role'],
            status: d.data().status as string,
            slotId: d.data().slotId as string | undefined,
          })),
        )
      },
    )

    return () => {
      sessionUnsub()
      participantsUnsub()
    }
  }, [sessionId])

  // Read credit balance from Firestore (warning only — server re-checks on start)
  useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid, 'credits', 'balance'), (snap) => {
      if (snap.exists()) {
        setCreditBalance((snap.data().balance as number) ?? 0)
      } else {
        setCreditBalance(0)
      }
    })
    return unsubscribe
  }, [user?.uid])

  async function handleGoLive() {
    if (!sessionId || !isISOConnected) return
    setStarting(true)
    setError('')
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Not authenticated')

      const res = await fetch(`${CLOUD_RUN_URL}/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          sessionId,
          startingSource: selectedSlotId,
        }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
        if (res.status === 402 || body.error === 'PAYMENT_REQUIRED') {
          throw new Error('No credits remaining. Visit genstadium.com to continue.')
        }
        throw new Error(body.message ?? `Server error ${res.status}`)
      }

      router.replace({ pathname: '/(director)/live', params: { sessionId } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to go live. Please try again.')
      setStarting(false)
    }
  }

  // ── Derived checklist state ────────────────────────────────────────────────
  const cameraParticipants = participants.filter((p) => p.role === 'camera')
  const skParticipants = participants.filter((p) => p.role === 'scorekeeper')
  const isoSlotId = session?.replayCameraSlot ?? ''
  const isISOConnected = cameraParticipants.some((p) => p.slotId === isoSlotId)
  const skReady = skParticipants.some((p) => p.status === 'ready')
  const youtubeConnected = Boolean(session?.youtubeStreamKey)
  const hasCredits = creditBalance === null || creditBalance > 0

  const canGoLive = isISOConnected && !starting

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1DB954" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ready to Go Live?</Text>
        <Text style={styles.subtitle}>{session.sessionName}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ── Starting camera picker ─────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Starting Camera</Text>
        <View style={styles.slotList}>
          {session.cameraSlots.map((slot) => {
            const isConnected = cameraParticipants.some((p) => p.slotId === slot.id)
            const isSelected = selectedSlotId === slot.id
            return (
              <TouchableOpacity
                key={slot.id}
                style={[
                  styles.slotCard,
                  isSelected && styles.slotCardSelected,
                  !isConnected && styles.slotCardDisabled,
                ]}
                onPress={() => isConnected && setSelectedSlotId(slot.id)}
                disabled={!isConnected}
                activeOpacity={0.75}
              >
                <View style={styles.slotCardLeft}>
                  <View style={[styles.slotCodeBadge, isSelected && styles.slotCodeBadgeSelected]}>
                    <Text style={[styles.slotCode, isSelected && styles.slotCodeSelected]}>
                      {slot.id}
                    </Text>
                  </View>
                  <Text style={[styles.slotName, !isConnected && styles.slotNameDisabled]}>
                    {slot.name}
                  </Text>
                </View>
                <Text style={styles.slotStatus}>{isConnected ? '🟢' : '⚫'}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── Pre-flight checklist ───────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Pre-Flight</Text>
        <View style={styles.checklist}>
          <ChecklistRow
            icon="📹"
            label={`ISO Camera: ${session.cameraSlots.find((s) => s.id === isoSlotId)?.name ?? isoSlotId}`}
            status={isISOConnected ? 'ok' : 'blocked'}
            detail={isISOConnected ? 'Connected' : 'Waiting for replay camera…'}
          />
          <ChecklistRow
            icon="🎥"
            label="Cameras"
            status={cameraParticipants.length > 0 ? 'ok' : 'warn'}
            detail={`${cameraParticipants.length} connected`}
          />
          <ChecklistRow
            icon="📋"
            label="Score Keeper"
            status={skReady ? 'ok' : 'warn'}
            detail={skParticipants.length === 0 ? 'Not joined' : skReady ? 'Ready' : 'Setting up'}
          />
          <ChecklistRow
            icon="📺"
            label="YouTube"
            status={youtubeConnected ? 'ok' : 'warn'}
            detail={youtubeConnected ? 'Stream key set' : 'Not connected — will record only'}
          />
          <ChecklistRow
            icon="💳"
            label="Credits"
            status={hasCredits ? 'ok' : 'warn'}
            detail={
              creditBalance === null
                ? 'Checking…'
                : creditBalance === 0
                ? 'No credits — purchase at genstadium.com/buy'
                : `${creditBalance} event${creditBalance !== 1 ? 's' : ''} remaining`
            }
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {/* ── Go Live CTA ───────────────────────────────────────────────── */}
      <View style={styles.footer}>
        {!isISOConnected ? (
          <View style={styles.gateMessage}>
            <Text style={styles.gateMessageText}>
              Waiting for replay camera ({session.cameraSlots.find((s) => s.id === isoSlotId)?.name ?? isoSlotId})…
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.goLiveButton, !canGoLive && styles.goLiveButtonDisabled]}
          onPress={handleGoLive}
          disabled={!canGoLive}
          activeOpacity={0.85}
        >
          {starting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.goLiveButtonText}>🔴 Go Live</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Checklist row component ────────────────────────────────────────────────

type ChecklistStatus = 'ok' | 'warn' | 'blocked'

function ChecklistRow({
  icon,
  label,
  status,
  detail,
}: {
  icon: string
  label: string
  status: ChecklistStatus
  detail: string
}) {
  const statusIcon = status === 'ok' ? '✅' : status === 'blocked' ? '🔴' : '⚠️'
  return (
    <View style={styles.checklistRow}>
      <Text style={styles.checklistIcon}>{icon}</Text>
      <View style={styles.checklistContent}>
        <Text style={styles.checklistLabel}>{label}</Text>
        <Text
          style={[
            styles.checklistDetail,
            status === 'blocked' && styles.checklistDetailBlocked,
          ]}
        >
          {detail}
        </Text>
      </View>
      <Text style={styles.checklistStatus}>{statusIcon}</Text>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: '#B3B3B3', fontSize: 15 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 12 },

  sectionLabel: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Camera slot picker
  slotList: { gap: 8 },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
  },
  slotCardSelected: { borderColor: '#1DB954', backgroundColor: '#0D2B14' },
  slotCardDisabled: { opacity: 0.4 },
  slotCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotCodeBadge: {
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  slotCodeBadgeSelected: { backgroundColor: '#1DB95440' },
  slotCode: { color: '#B3B3B3', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  slotCodeSelected: { color: '#1DB954' },
  slotName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  slotNameDisabled: { color: '#535353' },
  slotStatus: { fontSize: 14 },

  // Checklist
  checklist: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
    gap: 10,
  },
  checklistIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  checklistContent: { flex: 1 },
  checklistLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  checklistDetail: { color: '#B3B3B3', fontSize: 12, marginTop: 1 },
  checklistDetailBlocked: { color: '#FF4444' },
  checklistStatus: { fontSize: 16 },

  errorText: {
    color: '#FF4444',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    gap: 10,
  },
  gateMessage: {
    backgroundColor: '#1A0A0A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CC000040',
  },
  gateMessageText: { color: '#FF4444', fontSize: 13, textAlign: 'center' },
  goLiveButton: {
    backgroundColor: '#CC0000',
    borderRadius: 14,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goLiveButtonDisabled: { opacity: 0.4 },
  goLiveButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
})
