import '../../lib/livekit'
import { router, useLocalSearchParams } from 'expo-router'
import {
  LiveKitRoom,
  VideoView,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
} from '@livekit/react-native'
import { ConnectionQuality, ConnectionState } from 'livekit-client'
import { doc, onSnapshot } from 'firebase/firestore'
import React, { useEffect, useRef, useState } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'
import { useSessionStore } from '../../store/sessionStore'

const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? 'wss://localhost:7880'

// ---------------------------------------------------------------------------
// Inner screen — rendered inside LiveKitRoom context
// ---------------------------------------------------------------------------
function CamLiveInner({ slotName, sessionId, sessionName }: {
  slotName: string
  sessionId: string | null
  sessionName: string | null
}) {
  const { localParticipant, isCameraEnabled, cameraTrack } = useLocalParticipant()
  const connectionState = useConnectionState()
  const room = useRoomContext()
  const [facingFront, setFacingFront] = useState(true)
  const navigatedRef = useRef(false)

  // Watch session status — leave Room and navigate when Director ends session
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (!snap.exists() || navigatedRef.current) return
      if (snap.data().status === 'ended') {
        navigatedRef.current = true
        localParticipant.setCameraEnabled(false).catch(() => {})
        room.disconnect().catch(() => {})
        router.replace({
          pathname: '/(guest)/cam-ended',
          params: { sessionId, sessionName: sessionName ?? '' },
        })
      }
    })

    return unsubscribe
  }, [sessionId, sessionName, localParticipant, room])

  // Publish camera immediately on connect
  useEffect(() => {
    if (connectionState === ConnectionState.Connected && !isCameraEnabled) {
      localParticipant.setCameraEnabled(true, { facingMode: 'user' }).catch(() => {})
    }
  }, [connectionState, isCameraEnabled, localParticipant])

  async function handleFlip() {
    const nextFacing = !facingFront
    setFacingFront(nextFacing)
    await localParticipant.setCameraEnabled(true, {
      facingMode: nextFacing ? 'user' : 'environment',
    })
  }

  const quality = localParticipant.connectionQuality
  const signalLabel = signalText(connectionState, quality)
  const signalColor = signalDotColor(connectionState, quality)
  const isLive = connectionState === ConnectionState.Connected

  return (
    <View style={styles.container}>
      {/* Full-screen viewfinder */}
      <View style={styles.viewfinder}>
        {cameraTrack?.videoTrack ? (
          <VideoView
            style={StyleSheet.absoluteFillObject}
            videoTrack={cameraTrack.videoTrack}
            objectFit="cover"
            mirror={facingFront}
          />
        ) : (
          <View style={styles.noCamera}>
            <Text style={styles.noCameraText}>📷</Text>
            <Text style={styles.noCameraLabel}>Starting camera…</Text>
          </View>
        )}

        {/* 3×3 grid lines */}
        <View style={styles.gridHorizontal1} pointerEvents="none" />
        <View style={styles.gridHorizontal2} pointerEvents="none" />
        <View style={styles.gridVertical1} pointerEvents="none" />
        <View style={styles.gridVertical2} pointerEvents="none" />

        {/* Corner brackets */}
        <View style={[styles.corner, styles.cornerTL]} pointerEvents="none" />
        <View style={[styles.corner, styles.cornerTR]} pointerEvents="none" />
        <View style={[styles.corner, styles.cornerBL]} pointerEvents="none" />
        <View style={[styles.corner, styles.cornerBR]} pointerEvents="none" />

        {/* Top-left: LIVE badge */}
        <View style={styles.liveBadge}>
          {isLive && <View style={[styles.liveDot, styles.liveDotPulse]} />}
          <Text style={styles.liveText}>{isLive ? 'LIVE' : 'CONNECTING'}</Text>
        </View>

        {/* Top-right: slot name */}
        <View style={styles.slotBadge}>
          <Text style={styles.slotText}>{slotName}</Text>
        </View>

        {/* Bottom-left: signal strength */}
        <View style={styles.signalBadge}>
          <View style={[styles.signalDot, { backgroundColor: signalColor }]} />
          <Text style={styles.signalText}>{signalLabel}</Text>
        </View>

        {/* Bottom-right: flip button */}
        <TouchableOpacity
          style={styles.flipButton}
          onPress={handleFlip}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.flipIcon}>🔄</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Root screen — provides LiveKitRoom context
// ---------------------------------------------------------------------------
export default function CamLiveScreen() {
  const { slotName, sessionName } = useLocalSearchParams<{
    slotName: string
    sessionName: string
  }>()
  const { liveKitToken, sessionId } = useSessionStore()

  const displaySlotName = slotName ?? 'Camera'

  if (!liveKitToken) {
    return (
      <View style={styles.errorCenter}>
        <Text style={styles.errorText}>No session token. Please rejoin.</Text>
      </View>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={liveKitToken}
      connect
      audio={false}
      video={false}
      options={{ adaptiveStream: true, dynacast: true }}
    >
      <CamLiveInner
        slotName={displaySlotName}
        sessionId={sessionId}
        sessionName={sessionName ?? null}
      />
    </LiveKitRoom>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function signalText(state: ConnectionState, quality: ConnectionQuality): string {
  if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
    return 'Reconnecting'
  }
  if (state !== ConnectionState.Connected) return 'Connecting'
  if (quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good) return 'Strong'
  if (quality === ConnectionQuality.Poor) return 'Weak'
  return 'Connecting'
}

function signalDotColor(state: ConnectionState, quality: ConnectionQuality): string {
  if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) {
    return '#F59B23'
  }
  if (state !== ConnectionState.Connected) return '#535353'
  if (quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good) return '#1DB954'
  if (quality === ConnectionQuality.Poor) return '#F59B23'
  return '#535353'
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const GRID_COLOR = 'rgba(255,255,255,0.15)'
const CORNER_COLOR = 'rgba(255,255,255,0.7)'
const CORNER_SIZE = 20
const CORNER_THICKNESS = 2

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  viewfinder: { flex: 1 },
  noCamera: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noCameraText: { fontSize: 48 },
  noCameraLabel: { color: '#535353', fontSize: 15 },

  // 3×3 grid
  gridHorizontal1: { position: 'absolute', left: 0, right: 0, top: '33.33%', height: 1, backgroundColor: GRID_COLOR },
  gridHorizontal2: { position: 'absolute', left: 0, right: 0, top: '66.66%', height: 1, backgroundColor: GRID_COLOR },
  gridVertical1: { position: 'absolute', top: 0, bottom: 0, left: '33.33%', width: 1, backgroundColor: GRID_COLOR },
  gridVertical2: { position: 'absolute', top: 0, bottom: 0, left: '66.66%', width: 1, backgroundColor: GRID_COLOR },

  // Corner brackets
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  cornerTL: { top: 16, left: 16, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderColor: CORNER_COLOR },
  cornerTR: { top: 16, right: 16, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderColor: CORNER_COLOR },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderColor: CORNER_COLOR },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderColor: CORNER_COLOR },

  // LIVE badge (top-left)
  liveBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1DB954' },
  liveDotPulse: { backgroundColor: '#1DB954' },
  liveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  // Slot name (top-right)
  slotBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  slotText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Signal strength (bottom-left)
  signalBadge: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  signalDot: { width: 8, height: 8, borderRadius: 4 },
  signalText: { color: '#FFFFFF', fontSize: 13 },

  // Flip button (bottom-right)
  flipButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipIcon: { fontSize: 22 },

  // Error state
  errorCenter: { flex: 1, backgroundColor: '#121212', alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#B3B3B3', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
})
