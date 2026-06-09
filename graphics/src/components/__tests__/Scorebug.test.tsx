import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { onSnapshot } from 'firebase/firestore'
import Scorebug from '../Scorebug'

vi.mock('../../lib/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
}))

vi.mock('../Scorebug.module.css', () => ({ default: { scoreFlash: 'scoreFlash' } }))

test('renders without throwing for a given sessionId', () => {
  expect(() => render(<Scorebug sessionId="TEST01" />)).not.toThrow()
})

test('shows default team names Home / Away when no Firestore data yet', () => {
  render(<Scorebug sessionId="TEST01" />)
  expect(screen.getByText('Home')).toBeDefined()
  expect(screen.getByText('Away')).toBeDefined()
})

test('shows default scores of 0 for both teams', () => {
  render(<Scorebug sessionId="sess-123" />)
  const zeros = screen.getAllByText('0')
  expect(zeros.length).toBeGreaterThanOrEqual(2)
})

test('subscribes to Firestore on mount and unsubscribes on unmount', () => {
  const mockUnsub = vi.fn()
  ;(onSnapshot as ReturnType<typeof vi.fn>).mockReturnValue(mockUnsub)

  const { unmount } = render(<Scorebug sessionId="sess-abc" />)
  expect(onSnapshot).toHaveBeenCalled()
  unmount()
  expect(mockUnsub).toHaveBeenCalled()
})
