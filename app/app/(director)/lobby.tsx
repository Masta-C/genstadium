/**
 * lobby.tsx — Director Lobby screen.
 *
 * Director waits here while crew joins. Real-time via Firestore onSnapshot.
 * Go Live gated: ISO Camera participant must be connected before enabling.
 * Score Keeper not ready is a warning (yellow), not a blocker.
 *
 * Data subscriptions:
 *   sessions/{sessionId}                    — cameraSlots, replayCameraSlot, joinCode
 *   sessions/{sessionId}/participants/{uid} — role, status, displayName, slotId
 */

import { router, useLocalSearchParams } from 'expo-router'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'

const JOIN_BASE_URL = 'https://genstadium.com/join'

interface CameraSlot {
  id: string
  name: string
}

interface Participant {
  uid: string
  role: 'camera' | 'scorekeeper' | 'director'
  status: 'setting_up' | 'ready'
  displayName?: string
  slotId?: string
}

interface Session {
  sessionName: string
  joinCode: string
  cameraSlots: CameraSlot[]
  replayCameraSlot: string
}

export default function LobbyScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return

    const sessionUnsub = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      setSession({
        sessionName: data.sessionName ?? '',
        joinCode: data.joinCode ?? '',
        cameraSlots: data.cameraSlots ?? [],
        replayCameraSlot: data.replayCameraSlot ?? '',
      })
      setLoading(false)
    })

    const participantsUnsub = onSnapshot(
      collection(db, 'sessions', sessionId, 'participants'),
      (snap) => {
        const docs: Participant[] = snap.docs.map((d) => ({
          uid: d.id,
          role: d.data().role,
          status: d.data().status,
          displayName: d.data().displayName,
          slotId: d.data().slotId,
        }))
        setParticipants(docs)
      },
    )

    return () => {
      sessionUnsub()
      participantsUnsub()
    }
  }, [sessionId])

  if (loading || !session) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#1DB954" size="large" />
      </View>
    )
  }

  const cameraParticipants = participants.filter((p) => p.role === 'camera')
  const scorekeeperParticipants = participants.filter((p) => p.role === 'scorekeeper')

  const isoSlotId = session.replayCameraSlot
  const isoSlot = session.cameraSlots.find((s) => s.id === isoSlotId)
  const isISOConnected = cameraParticipants.some((p) => p.slotId === isoSlotId)

  const scorekeeperJoined = scorekeeperParticipants.length > 0
  const scorekeeperReady = scorekeeperParticipants.some((p) => p.status === 'ready')
  const showSKWarning = !scorekeeperReady

  function cameraStatusForSlot(slotId: string): 'connected' | 'waiting' {
    return cameraParticipants.some((p) => p.slotId === slotId) ? 'connected' : 'waiting'
  }

  function scorekeeperStatusLabel(): string {
    if (!scorekeeperJoined) return '⚪ Not joined'
    const sk = scorekeeperParticipants[0]
    if (sk.status === 'ready') return '🟢 Ready'
    return '🟡 Setting up'
  }

  async function handleShareJoinLink() {
    const joinUrl = `${JOIN_BASE_URL}/${session?.joinCode}`
    try {
      await Share.share({
        message: `Join ${session?.sessionName} on GenStadium → ${joinUrl}`,
        url: joinUrl,
        title: `Join ${session?.sessionName}`,
      })
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet.')
    }
  }

  function handleGoLive() {
    if (!isISOConnected) return
    router.push({ pathname: '/(director)/live-setup', params: { sessionId } })
  }

  const goLiveLabel = isISOConnected
    ? '🔴 Go Live'
    : `Waiting for replay camera (${isoSlot?.name ?? isoSlotId})…`

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Lobby</Text>
        <Text style={styles.sessionName}>{session.sessionName}</Text>
        <View style={styles.joinCodeRow}>
          <Text style={styles.joinCodeLabel}>Join code</Text>
          <Text style={styles.joinCode}>{session.joinCode}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Camera Slots section */}
        <Text style={styles.sectionLabel}>CAMERAS</Text>
        {session.cameraSlots.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>No camera slots configured.</Text>
          </View>
        ) : (
          session.cameraSlots.map((slot) => {
            const isISO = slot.id === isoSlotId
            const status = cameraStatusForSlot(slot.id)
            const connected = status === 'connected'
            return (
              <View
                key={slot.id}
                style={[
                  styles.participantRow,
                  isISO && styles.participantRowISO,
                ]}
              >
                <View style={styles.participantLeft}>
                  <View style={styles.slotCodeBadge}>
                    <Text style={styles.slotCode}>{slot.id}</Text>
                  </View>
                  <View>
                    <View style={styles.slotNameRow}>
                      {isISO ? <Text style={styles.isoIcon}>📹 </Text> : null}
                      <Text style={[styles.participantName, isISO && styles.participantNameISO]}>
                        {slot.name}
                      </Text>
                    </View>
                    {isISO ? (
                      <Text style={styles.isoSubLabel}>Replay source</Text>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.statusDot, connected ? styles.statusDotGreen : styles.statusDotGrey]}>
                  {connected ? '🟢 Connected' : '⚪ Waiting'}
                </Text>
              </View>
            )
          })
        )}

        {/* Score Keeper section */}
        <Text style={[styles.sectionLabel, styles.sectionLabelGap]}>SCORE KEEPER</Text>
        <View style={[styles.participantRow, showSKWarning && styles.participantRowWarning]}>
          <View style={styles.participantLeft}>
            <View style={styles.slotCodeBadge}>
              <Text style={styles.slotCode}>SK</Text>
            </View>
            <View>
              <Text style={styles.participantName}>
                {scorekeeperJoined
                  ? (scorekeeperParticipants[0].displayName ?? 'Score Keeper')
                  : 'Score Keeper'}
              </Text>
              {showSKWarning && !scorekeeperReady ? (
                <Text style={styles.warningSubLabel}>Optional — not required to Go Live</Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.statusDot}>{scorekeeperStatusLabel()}</Text>
        </View>

        {/* SK warning banner */}
        {showSKWarning ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningBannerText}>
              ⚠️ Score Keeper hasn't joined yet. You can still Go Live — scoring will be unavailable until they join.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareJoinLink}
          activeOpacity={0.8}
        >
          <Text style={styles.shareButtonText}>Share Join Link</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.goLiveButton, !isISOConnected && styles.goLiveButtonDisabled]}
          onPress={handleGoLive}
          disabled={!isISOConnected}
          activeOpacity={0.8}
        >
          <Text style={[styles.goLiveButtonText, !isISOConnected && styles.goLiveButtonTextDisabled]}>
            {goLiveLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  title: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sessionName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  joinCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinCodeLabel: {
    color: '#535353',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  joinCode: {
    color: '#B3B3B3',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  sectionLabelGap: {
    marginTop: 24,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  participantRowISO: {
    borderColor: '#1DB954',
    backgroundColor: '#0D2B14',
  },
  participantRowWarning: {
    borderColor: '#F59E0B40',
    backgroundColor: '#1A1500',
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  slotNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  isoIcon: {
    fontSize: 14,
  },
  slotCodeBadge: {
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  slotCode: {
    color: '#B3B3B3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  participantNameISO: {
    color: '#1DB954',
  },
  isoSubLabel: {
    color: '#1DB95480',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  warningSubLabel: {
    color: '#F59E0B80',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  statusDot: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 0,
  },
  statusDotGreen: {
    color: '#1DB954',
  },
  statusDotGrey: {
    color: '#535353',
  },
  emptySection: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptySectionText: {
    color: '#535353',
    fontSize: 14,
  },
  warningBanner: {
    backgroundColor: '#1A1500',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B40',
    padding: 12,
    marginTop: 4,
  },
  warningBannerText: {
    color: '#F59E0B',
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    gap: 12,
  },
  shareButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  goLiveButton: {
    backgroundColor: '#CC0000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  goLiveButtonDisabled: {
    backgroundColor: '#2A2A2A',
  },
  goLiveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  goLiveButtonTextDisabled: {
    color: '#535353',
    fontWeight: '600',
    fontSize: 14,
  },
})
