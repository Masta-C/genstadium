import { useAuthStore } from '../authStore'
import type { User } from 'firebase/auth'

const mockUser = { uid: 'user-1', isAnonymous: false } as User

beforeEach(() => {
  useAuthStore.setState({ user: null, role: null, loading: true })
})

test('initial state', () => {
  const { user, role, loading } = useAuthStore.getState()
  expect(user).toBeNull()
  expect(role).toBeNull()
  expect(loading).toBe(true)
})

test('setUser stores the user', () => {
  useAuthStore.getState().setUser(mockUser)
  expect(useAuthStore.getState().user).toBe(mockUser)
})

test('setUser(null) clears the user', () => {
  useAuthStore.getState().setUser(mockUser)
  useAuthStore.getState().setUser(null)
  expect(useAuthStore.getState().user).toBeNull()
})

test('setRole stores the role', () => {
  useAuthStore.getState().setRole('director')
  expect(useAuthStore.getState().role).toBe('director')
})

test('setRole accepts guest roles', () => {
  useAuthStore.getState().setRole('camera')
  expect(useAuthStore.getState().role).toBe('camera')
  useAuthStore.getState().setRole('scorekeeper')
  expect(useAuthStore.getState().role).toBe('scorekeeper')
})

test('setLoading updates loading flag', () => {
  useAuthStore.getState().setLoading(false)
  expect(useAuthStore.getState().loading).toBe(false)
  useAuthStore.getState().setLoading(true)
  expect(useAuthStore.getState().loading).toBe(true)
})

test('signOut clears user + role and sets loading false', () => {
  useAuthStore.setState({ user: mockUser, role: 'director', loading: false })
  useAuthStore.getState().signOut()
  const { user, role, loading } = useAuthStore.getState()
  expect(user).toBeNull()
  expect(role).toBeNull()
  expect(loading).toBe(false)
})
