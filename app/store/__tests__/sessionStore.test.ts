import { useSessionStore } from '../sessionStore'

beforeEach(() => {
  useSessionStore.setState({ sessionId: null, liveKitToken: null })
})

test('initial state', () => {
  const { sessionId, liveKitToken } = useSessionStore.getState()
  expect(sessionId).toBeNull()
  expect(liveKitToken).toBeNull()
})

test('setSession stores sessionId and liveKitToken', () => {
  useSessionStore.getState().setSession('sess-123', 'tok-abc')
  const { sessionId, liveKitToken } = useSessionStore.getState()
  expect(sessionId).toBe('sess-123')
  expect(liveKitToken).toBe('tok-abc')
})

test('setSession overwrites previous values', () => {
  useSessionStore.getState().setSession('sess-1', 'tok-1')
  useSessionStore.getState().setSession('sess-2', 'tok-2')
  const { sessionId, liveKitToken } = useSessionStore.getState()
  expect(sessionId).toBe('sess-2')
  expect(liveKitToken).toBe('tok-2')
})

test('clearSession resets sessionId and liveKitToken to null', () => {
  useSessionStore.getState().setSession('sess-123', 'tok-abc')
  useSessionStore.getState().clearSession()
  const { sessionId, liveKitToken } = useSessionStore.getState()
  expect(sessionId).toBeNull()
  expect(liveKitToken).toBeNull()
})

test('state is isolated between test cases', () => {
  // Verifies beforeEach reset: this test starts clean even though a prior test set values.
  const { sessionId, liveKitToken } = useSessionStore.getState()
  expect(sessionId).toBeNull()
  expect(liveKitToken).toBeNull()
})
