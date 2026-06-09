import React, { act } from 'react'
import { create } from 'react-test-renderer'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { getDoc } from 'firebase/firestore'
import { useAuthStore } from '../../store/authStore'
import { useAuth } from '../useAuth'

// ── Firebase mocks ────────────────────────────────────────────────────────────

const mockUnsubscribe = jest.fn()

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
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

// ── Helpers ───────────────────────────────────────────────────────────────────

type AuthCallback = (user: User | null) => Promise<void>
let capturedAuthCallback: AuthCallback | null = null

function setupAuthMock() {
  ;(onAuthStateChanged as jest.Mock).mockImplementation((_auth: unknown, cb: AuthCallback) => {
    capturedAuthCallback = cb
    return mockUnsubscribe
  })
}

function TestComponent() {
  useAuth()
  return null
}

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
  setupAuthMock()
  act(() => {
    useAuthStore.setState({ user: null, role: null, loading: true })
  })
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
  ;(getDoc as jest.Mock).mockResolvedValue({ data: () => ({ role: 'director' }) })

  const directorUser = { uid: 'dir-1', isAnonymous: false } as User
  mountHook()
  await triggerAuth(directorUser)

  const { user, role, loading } = useAuthStore.getState()
  expect(user).toBe(directorUser)
  expect(role).toBe('director')
  expect(loading).toBe(false)
})

test('director: falls back to "director" role when Firestore throws', async () => {
  ;(getDoc as jest.Mock).mockRejectedValue(new Error('permission-denied'))

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
