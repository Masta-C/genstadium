import React from 'react'
import Scorebug from './components/Scorebug'

function useSessionId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('layout')
}

export default function App() {
  const sessionId = useSessionId()

  if (!sessionId) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base text-text-secondary">
        <p>No session ID. Provide <code>?layout=SESSION_ID</code></p>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-transparent">
      {/* Scorebug — bottom-right, max-width 320px per issue #48 */}
      <div className="absolute bottom-4 right-4">
        <Scorebug sessionId={sessionId} />
      </div>
    </div>
  )
}
