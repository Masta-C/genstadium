import React from 'react'
import { act, create } from 'react-test-renderer'
import type { User } from 'firebase/auth'
import { useAuthStore } from '../../store/authStore'

// ── Firebase mocks ────────────────────────────────────────────────────────────

// Capture the callback registered by onAuthStateChanged so tests can invoke it.
let capturedAuthCallback: ((user: User | null) => Promise<void>) | null = null
const mockUnsubscribe = jest.fn()

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_auth: unknown, callback: (user: User | null) => Promise<void>) => {
    capturedAuthCallback = callback
    return mockUnsubscribe
  }),
}))

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}))

// Mock the Firebase client module so no real Firebase app is initialised.
jest.mock('../../lib/firebase/client', () => ({
  auth: {},
  db: {},
}))

// ── Test component ────────────────────────────────────────────────────────────

// Minimal wrapper that mounts the hook so useEffect fires.
function TestComponent() {
  const { useAuth } = require('../../hooks/useAuth') as { useAuth: () => void }
  useAuth()
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountHook() {
  let renderer: ReturnType<typeof create>
  act(() => {
    renderer = create(React.createElement(TestComponent))
  })
  return renderer!
}

async function triggerAuth(user: User | null) {
  await act(async () => {
    await capturedAuthCallback!(user)
  })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedAuthCallback = null
  jest.clearAllMocks()
  act(() => {
    useAuthStore.setState({ user: null, role: null, loading: true })
  })
})

// ── Store tests (no rendering needed) ────────────────────────────────────────

test('authStore: initial loading is true', () => {
  expect(useAuthStore.getState().loading).toBe(true)
})

// ── useAuth hook tests ────────────────────────────────────────────────────────

test('signed-out: clears user + role and sets loading false', async () => {
  mountHook()
  await triggerAuth(null)

  const { user, role, loading } = useAuthStore.getState()
  expect(user).toBeNull()
  expect(role).toBeNull()
  expect(loading).toBe(false)
})

test('director (non-anonymous): reads role from Firestore users/{uid}.role', async () => {
  const { getDoc } = require('firebase/firestore') as { getDoc: jest.Mock }
  getDoc.mockResolvedValue({ data: () => ({ role: 'director' }) })

  const directorUser = { uid: 'dir-1', isAnonymous: false } as User
  mountHook()
  await triggerAuth(directorUser)

  const { user, role, loading } = useAuthStore.getState()
  expect(user).toBe(directorUser)
  expect(role).toBe('director')
  expect(loading).toBe(false)
})

test('director: falls back to "director" role when Firestore throws', async () => {
  const { getDoc } = require('firebase/firestore') as { getDoc: jest.Mock }
  getDoc.mockRejectedValue(new Error('permission-denied'))

  const directorUser = { uid: 'dir-2', isAnonymous: false } as User
  mountHook()
  await triggerAuth(directorUser)

  expect(useAuthStore.getState().role).toBe('director')
  expect(useAuthStore.getState().loading).toBe(false)
})

test('anonymous user: role stays null (resolved per-session at join)', async () => {
  const anonUser = { uid: 'anon-1', isAnonymous: true } as User
  mountHook()
  await triggerAuth(anonUser)

  const { user, role, loading } = useAuthStore.getState()
  expect(user).toBe(anonUser)
  expect(role).toBeNull()
  expect(loading).toBe(false)
})

test('unmount returns the unsubscribe function', () => {
  const renderer = mountHook()
  act(() => {
    renderer.unmount()
  })
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
})
