/**
 * live.tsx — Director live screen.
 *
 * Command centre during the stream. Camera grid with Firestore-based connection
 * status (no video previews — ADR-005). LIVE badge + stream timer. Score display.
 * Score Keeper status + event count in bottom bar.
 *
 * Replay banner: subscribes to session.latestReplayClip. Single 🎬 badge; most
 * recent clip overwrites. Tap → POST /replay/inject. Banner hidden when ISO Camera
 * is offline or when a replay is already playing (activeSource starts with "replay-clip-").
 *
 * End Session is wired in issue #80.
 */

import { router, useLocalSearchParams } from 'expo-router'
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import React, { useEffect, useRef, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'

const CLOUD_RUN_URL =
  (process.env.EXPO_PUBLIC_CLOUD_RUN_URL ?? 'http://localhost:8081').replace(/\/$/, '')

interface CameraSlot {
  id: string
  name: string
}

interface Participant {
  uid: string
  role: 'camera' | 'scorekeeper' | 'director'
  status: 'setting_up' | 'ready' | string
  displayName?: string
  slotId?: string
}

interface ScoreState {
  homeScore: number
  awayScore: number
  period: string
}

interface Team {
  id: string
  name: string
  colour: string
}

interface DirectorState {
  activeSource: string | null
  scorebugVisible: boolean
}

interface LatestReplayClip {
  gcsPath: string
  clipId: string
  readyAt: { seconds: number }
}

interface SessionData {
  sessionName: string
  cameraSlots: CameraSlot[]
  teams: Team[]
  startedAt: { seconds: number } | null
  directorState: DirectorState
  latestReplayClip: LatestReplayClip | null
  replayCameraOnline: boolean
}

export default function DirectorLiveScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [session, setSession] = useState<SessionData | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [scoreState, setScoreState] = useState<ScoreState>({
    homeScore: 0,
    awayScore: 0,
    period: '',
  })
  const [eventCount, setEventCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  // Seconds elapsed since latestReplayClip.readyAt — drives "12s ago" label on banner
  const [bannerElapsed, setBannerElapsed] = useState(0)
  // Optimistic local override for activeSource — cleared when Firestore confirms
  const [optimisticSource, setOptimisticSource] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const sessionUnsub = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      const firestoreSource = (data.directorState?.activeSource as string | null) ?? null
      const rawClip = data.latestReplayClip as LatestReplayClip | null | undefined
      setSession({
        sessionName: (data.sessionName as string) ?? '',
        cameraSlots: (data.cameraSlots as CameraSlot[]) ?? [],
        teams: (data.teams as Team[]) ?? [],
        startedAt: (data.startedAt as { seconds: number } | null) ?? null,
        directorState: {
          activeSource: firestoreSource,
          scorebugVisible: Boolean(data.directorState?.scorebugVisible),
        },
        latestReplayClip: rawClip ?? null,
        replayCameraOnline: data.replayCameraOnline !== false, // default true if absent
      })
      // Clear optimistic override once Firestore has confirmed the write
      setOptimisticSource((prev) => (prev === firestoreSource ? null : prev))
    })

    const participantsUnsub = onSnapshot(
      collection(db, 'sessions', sessionId, 'participants'),
      (snap) => {
        setParticipants(
          snap.docs.map((d) => ({
            uid: d.id,
            role: d.data().role as Participant['role'],
            status: d.data().status as string,
            displayName: d.data().displayName as string | undefined,
            slotId: d.data().slotId as string | undefined,
          })),
        )
      },
    )

    const scoreUnsub = onSnapshot(
      doc(db, 'sessions', sessionId, 'scoreState', 'current'),
      (snap) => {
        if (!snap.exists()) return
        const data = snap.data()
        setScoreState({
          homeScore: (data.homeScore as number) ?? 0,
          awayScore: (data.awayScore as number) ?? 0,
          period: (data.period as string) ?? '',
        })
      },
    )

    const eventsUnsub = onSnapshot(
      collection(db, 'sessions', sessionId, 'events'),
      (snap) => {
        setEventCount(snap.docs.filter((d) => !d.data().deleted).length)
      },
    )

    return () => {
      sessionUnsub()
      participantsUnsub()
      scoreUnsub()
      eventsUnsub()
    }
  }, [sessionId])

  // Stream duration timer
  useEffect(() => {
    if (!session?.startedAt) return

    const startSeconds = session.startedAt.seconds
    function tick() {
      setElapsed(Math.floor(Date.now() / 1000) - startSeconds)
    }
    tick()
    timerRef.current = setInterval(tick, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [session?.startedAt])

  // Banner "X seconds ago" timer — ticks only while a clip is ready
  useEffect(() => {
    const readyAt = session?.latestReplayClip?.readyAt?.seconds
    if (!readyAt) {
      setBannerElapsed(0)
      if (bannerTimerRef.current) clearInterval(bannerTimerRef.current)
      return
    }
    const readyAtSec = readyAt
    function tick() {
      setBannerElapsed(Math.floor(Date.now() / 1000) - readyAtSec)
    }
    tick()
    bannerTimerRef.current = setInterval(tick, 1000)
    return () => {
      if (bannerTimerRef.current) clearInterval(bannerTimerRef.current)
    }
  }, [session?.latestReplayClip?.readyAt?.seconds])

  // ── Scorebug toggle ───────────────────────────────────────────────────────
  async function toggleScorebug() {
    if (!sessionId) return
    const current = session?.directorState.scorebugVisible ?? true
    await updateDoc(doc(db, 'sessions', sessionId), {
      'directorState.scorebugVisible': !current,
    }).catch(() => {/* silent — next snapshot will resync */})
  }

  // ── Camera source switch ───────────────────────────────────────────────────
  async function switchSource(slotId: string) {
    if (!sessionId) return
    // Optimistic update — UI responds immediately before Firestore confirms
    setOptimisticSource(slotId)
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        'directorState.activeSource': slotId,
      })
    } catch {
      // Rollback optimistic update on failure
      setOptimisticSource(null)
    }
  }

  // ── Replay inject ─────────────────────────────────────────────────────────
  async function injectReplay() {
    const clip = session?.latestReplayClip
    if (!sessionId || !clip) return
    try {
      await fetch(`${CLOUD_RUN_URL}/replay/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clipId: clip.clipId }),
      })
      // Cloud Run clears latestReplayClip after successful injection
    } catch {
      // Silent — next snapshot will resync if Cloud Run confirms
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const slots = session?.cameraSlots ?? []
  // Optimistic local override takes precedence; Firestore value as fallback
  const activeSource = optimisticSource ?? session?.directorState.activeSource ?? null

  // Map slotId → participant for status lookup
  const participantBySlot: Record<string, Participant> = {}
  for (const p of participants) {
    if (p.role === 'camera' && p.slotId) {
      participantBySlot[p.slotId] = p
    }
  }

  // Replay banner: visible when clip ready, ISO Camera online, and not already replaying
  const isReplayPlaying = activeSource?.startsWith('replay-clip-') ?? false
  const showReplayBanner =
    Boolean(session?.latestReplayClip) &&
    (session?.replayCameraOnline !== false) &&
    !isReplayPlaying

  const skParticipants = participants.filter((p) => p.role === 'scorekeeper')
  const skReady = skParticipants.some((p) => p.status === 'ready')
  const teamA = session?.teams[0]
  const teamB = session?.teams[1]

  return (
    <View style={styles.container}>
      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <View style={styles.statusBar}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        {session?.sessionName ? (
          <Text style={styles.sessionName} numberOfLines={1}>
            {session.sessionName}
          </Text>
        ) : null}
        <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
      </View>

      {/* ── Score display ───────────────────────────────────────────────── */}
      <View style={styles.scoreBar}>
        <Text
          style={[styles.teamScore, teamA && { color: teamA.colour }]}
          numberOfLines={1}
        >
          {teamA?.name ?? 'Team A'}
        </Text>
        <Text style={styles.scoreDigits}>
          {scoreState.homeScore}
          <Text style={styles.scoreSep}> – </Text>
          {scoreState.awayScore}
        </Text>
        <Text
          style={[styles.teamScore, styles.teamScoreRight, teamB && { color: teamB.colour }]}
          numberOfLines={1}
        >
          {teamB?.name ?? 'Team B'}
        </Text>
      </View>
      {scoreState.period ? (
        <Text style={styles.periodLabel}>{scoreState.period}</Text>
      ) : null}

      {/* ── Replay Ready banner ─────────────────────────────────────────── */}
      {showReplayBanner ? (
        <TouchableOpacity
          style={styles.replayBanner}
          onPress={injectReplay}
          activeOpacity={0.85}
        >
          <Text style={styles.replayBannerText}>
            🎬 Replay Ready · {bannerElapsed}s ago
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* ── Camera grid ─────────────────────────────────────────────────── */}
      <ScrollView style={styles.grid} contentContainerStyle={styles.gridContent}>
        <View style={styles.gridRow}>
          {slots.length === 0 ? (
            <View style={styles.emptyGrid}>
              <Text style={styles.emptyGridText}>No camera slots configured.</Text>
            </View>
          ) : (
            slots.map((slot) => {
              const participant = participantBySlot[slot.id]
              const isActive = activeSource === slot.id
              const dot = connectionDot(participant)
              const isConnected = Boolean(participant)

              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.cameraCard,
                    isActive && styles.cameraCardActive,
                    !isConnected && styles.cameraCardDisabled,
                  ]}
                  activeOpacity={isConnected ? 0.75 : 1}
                  disabled={!isConnected || isActive}
                  onPress={() => switchSource(slot.id)}
                >
                  {/* LIVE badge */}
                  {isActive ? (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveBadgeDot} />
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  ) : null}

                  {/* Camera icon placeholder */}
                  <Text style={styles.cameraIcon}>📷</Text>

                  {/* Slot name + status dot */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.slotName} numberOfLines={1}>
                      {slot.name}
                    </Text>
                    <Text style={styles.statusDot}>{dot}</Text>
                  </View>

                  {/* Slot code */}
                  <View style={styles.slotCodeBadge}>
                    <Text style={styles.slotCode}>{slot.id}</Text>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* ── Bottom bar ──────────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        {/* SK status */}
        <View style={styles.skStatus}>
          <Text style={styles.skLabel}>
            SK: {skParticipants.length === 0 ? '⚫' : skReady ? '🟢' : '🟡'}{' '}
            {skParticipants.length === 0
              ? 'Not joined'
              : skReady
              ? 'Ready'
              : 'Setting up'}{' '}
            · {eventCount} event{eventCount !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Scorebug toggle */}
        <TouchableOpacity
          style={[
            styles.scorebugToggle,
            session?.directorState.scorebugVisible
              ? styles.scorebugToggleOn
              : styles.scorebugToggleOff,
          ]}
          onPress={toggleScorebug}
          activeOpacity={0.8}
        >
          <Text style={styles.scorebugToggleText}>
            📊 {session?.directorState.scorebugVisible ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>

        {/* End Session — wired in #80 */}
        <TouchableOpacity
          style={styles.endButton}
          onPress={() =>
            router.push({ pathname: '/(director)/live', params: { sessionId } })
          }
          activeOpacity={0.8}
        >
          <Text style={styles.endButtonText}>■ End</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function connectionDot(participant: Participant | undefined): string {
  if (!participant) return '⚫' // slot not filled
  if (participant.status === 'ready') return '🟢'
  if (participant.status === 'setting_up') return '🟡'
  return '🔴'
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CC0000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  liveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  sessionName: {
    flex: 1,
    color: '#B3B3B3',
    fontSize: 14,
    fontWeight: '600',
  },
  timer: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },

  // Score bar
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#161616',
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  teamScore: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  teamScoreRight: { textAlign: 'right' },
  scoreDigits: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    minWidth: 80,
  },
  scoreSep: { color: '#535353', fontWeight: '300' },
  periodLabel: {
    textAlign: 'center',
    color: '#535353',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingBottom: 6,
    backgroundColor: '#161616',
  },

  // Replay Ready banner
  replayBanner: {
    backgroundColor: '#2B1E00',
    borderBottomWidth: 1,
    borderBottomColor: '#CC8800',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  replayBannerText: {
    color: '#FFB300',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Grid
  grid: { flex: 1 },
  gridContent: { padding: 12 },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emptyGrid: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyGridText: { color: '#535353', fontSize: 14 },

  cameraCard: {
    width: '48%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraCardActive: {
    borderColor: '#CC0000',
    backgroundColor: '#1A0A0A',
  },
  cameraCardDisabled: {
    opacity: 0.35,
  },

  // LIVE badge on active camera card
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CC0000',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  liveBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  cameraIcon: { fontSize: 28, opacity: 0.4 },

  cardFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  slotName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  statusDot: { fontSize: 12, marginLeft: 4 },

  slotCodeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  slotCode: { color: '#B3B3B3', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
    gap: 12,
  },
  skStatus: { flex: 1 },
  skLabel: { color: '#B3B3B3', fontSize: 13 },

  scorebugToggle: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  scorebugToggleOn: {
    backgroundColor: '#0D2B14',
    borderColor: '#1DB954',
  },
  scorebugToggleOff: {
    backgroundColor: '#2A1A0A',
    borderColor: '#CC5500',
  },
  scorebugToggleText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  endButton: {
    backgroundColor: '#2A0A0A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CC0000',
  },
  endButtonText: { color: '#CC0000', fontSize: 13, fontWeight: '700' },
})
