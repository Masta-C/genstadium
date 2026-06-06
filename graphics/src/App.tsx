import React from 'react'

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
      {/* Scorebug and overlays rendered here — see issues #48, #50 */}
      <div className="absolute bottom-4 right-4 text-xs text-text-disabled">
        session: {sessionId}
      </div>
    </div>
  )
}
