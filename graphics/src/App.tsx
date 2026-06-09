/**
 * App.tsx — GenStadium broadcast layout page.
 *
 * Rendered by LiveKit Egress Room Composite in headless Chrome.
 * LiveKit Egress injects ?lk_token=... and ?lk_url=... query params.
 * Firestore provides directorState for source switching + scorebug visibility.
 *
 * Source switching latency: Firestore onSnapshot → <300ms per ADR-002.
 */

import { Room, RoomEvent, Track } from 'livekit-client'
import { doc, onSnapshot } from 'firebase/firestore'
import React, { useEffect, useRef, useState } from 'react'
import LowerThird from './components/LowerThird'
import Scorebug from './components/Scorebug'
import { db } from './lib/firebase'
import { useLayoutParams } from './hooks/useLayoutParams'

function useDirectorState(sessionId: string | null): {
  activeSource: string | null
  scorebugVisible: boolean
} {
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [scorebugVisible, setScorebugVisible] = useState(true)

  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      setActiveSource((data.directorState?.activeSource as string | null) ?? null)
      // Default true — scorebug visible unless Director explicitly hides it
      setScorebugVisible(data.directorState?.scorebugVisible !== false)
    })

    return unsubscribe
  }, [sessionId])

  return { activeSource, scorebugVisible }
}

function useActiveCameraTrack(
  lkToken: string | null,
  lkUrl: string | null,
  activeSource: string | null,
): React.MutableRefObject<HTMLVideoElement | null> {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const roomRef = useRef<Room | null>(null)

  useEffect(() => {
    if (!lkToken || !lkUrl) return

    const room = new Room()
    roomRef.current = room

    room.connect(lkUrl, lkToken).catch(() => {/* room handles reconnect */})

    function attachTrack() {
      if (!activeSource || !videoRef.current) return
      const participant = room.remoteParticipants.get(activeSource)
      if (!participant) return

      const publication = participant.getTrackPublication(Track.Source.Camera)
      if (publication?.track) {
        publication.track.attach(videoRef.current)
      }
    }

    room.on(RoomEvent.Connected, attachTrack)
    room.on(RoomEvent.TrackSubscribed, attachTrack)
    room.on(RoomEvent.ParticipantConnected, attachTrack)

    return () => {
      room.disconnect()
      roomRef.current = null
    }
  }, [lkToken, lkUrl]) // activeSource handled in separate effect below

  // Re-attach video when activeSource changes
  useEffect(() => {
    const room = roomRef.current
    if (!room || !activeSource || !videoRef.current) return

    // Detach from all participants first
    for (const [, participant] of room.remoteParticipants) {
      const pub = participant.getTrackPublication(Track.Source.Camera)
      if (pub?.track) {
        pub.track.detach()
      }
    }

    // Attach active source
    const participant = room.remoteParticipants.get(activeSource)
    if (participant) {
      const pub = participant.getTrackPublication(Track.Source.Camera)
      if (pub?.track && videoRef.current) {
        pub.track.attach(videoRef.current)
      }
    }
  }, [activeSource])

  return videoRef
}

export default function App() {
  const { sessionId, lkToken, lkUrl } = useLayoutParams()
  const { activeSource, scorebugVisible } = useDirectorState(sessionId)
  const videoRef = useActiveCameraTrack(lkToken, lkUrl, activeSource)

  if (!sessionId) {
    return (
      <div
        style={{
          width: 1920,
          height: 1080,
          backgroundColor: '#121212',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#535353',
          fontFamily: "'Inter', sans-serif",
          fontSize: 16,
        }}
      >
        No session ID. Provide <code style={{ marginLeft: 4 }}>?layout=SESSION_ID</code>
      </div>
    )
  }

  return (
    /*
     * Broadcast canvas: 1920×1080, dark background.
     * 96px safe zone on all edges (design tokens: broadcast-safe inset).
     */
    <div
      style={{
        position: 'relative',
        width: 1920,
        height: 1080,
        backgroundColor: '#121212',
        overflow: 'hidden',
      }}
    >
      {/* Active camera video — full canvas */}
      {lkToken && lkUrl ? (
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          autoPlay
          muted
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : null}

      {/* Lower third — bottom-left, 96px from edges, max-width 640px */}
      <div style={{ position: 'absolute', bottom: 96, left: 96, maxWidth: 640 }}>
        <LowerThird sessionId={sessionId} />
      </div>

      {/* Scorebug — bottom-right, 96px from edges, max-width 320px */}
      {scorebugVisible ? (
        <div style={{ position: 'absolute', bottom: 96, right: 96, maxWidth: 320 }}>
          <Scorebug sessionId={sessionId} />
        </div>
      ) : null}
    </div>
  )
}
