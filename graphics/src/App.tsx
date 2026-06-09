import { doc, onSnapshot } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import LowerThird from './components/LowerThird'
import Scorebug from './components/Scorebug'
import { db } from './lib/firebase'

function useSessionId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('layout')
}

function useDirectorState(sessionId: string | null): {
  scorebugVisible: boolean
} {
  const [scorebugVisible, setScorebugVisible] = useState(true)

  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      // Default true — scorebug visible unless Director explicitly hides it
      setScorebugVisible(data.directorState?.scorebugVisible !== false)
    })

    return unsubscribe
  }, [sessionId])

  return { scorebugVisible }
}

export default function App() {
  const sessionId = useSessionId()
  const { scorebugVisible } = useDirectorState(sessionId)

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
     * Positioned absolutely so elements stay within safe zone at any viewport.
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
