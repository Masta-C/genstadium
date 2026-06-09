import React from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { onSnapshot } from 'firebase/firestore'
import LowerThird from '../LowerThird'

vi.mock('../../lib/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
}))

test('renders without throwing for a given sessionId', () => {
  expect(() => render(<LowerThird sessionId="TEST01" />)).not.toThrow()
})

test('renders nothing initially (animState starts as hidden)', () => {
  const { container } = render(<LowerThird sessionId="TEST01" />)
  expect(container.firstChild).toBeNull()
})

test('subscribes to Firestore on mount', () => {
  render(<LowerThird sessionId="sess-123" />)
  expect(onSnapshot).toHaveBeenCalled()
})

test('unsubscribes on unmount', () => {
  const mockUnsub = vi.fn()
  ;(onSnapshot as ReturnType<typeof vi.fn>).mockReturnValue(mockUnsub)

  const { unmount } = render(<LowerThird sessionId="sess-abc" />)
  unmount()
  expect(mockUnsub).toHaveBeenCalled()
})
