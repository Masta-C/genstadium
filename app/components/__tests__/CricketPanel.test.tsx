/**
 * CricketPanel — over-complete logic unit tests.
 *
 * Tests countLegalDelivery (via ref) + OverCompleteModal wiring.
 * Firestore and EventButtons are mocked — no real network calls.
 */
import React, { createRef, act } from 'react'
import { create } from 'react-test-renderer'
import { Animated } from 'react-native'

// ── Mock Firebase ──────────────────────────────────────────────────────────────
jest.mock('../../lib/firebase/client', () => ({ db: {} }))

// jest.mock factories must not reference out-of-scope variables (except mock-prefixed).
// Use jest.fn() in factory; set mockImplementation in beforeEach.
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  onSnapshot: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
}))

// ── Mock EventButtons — captures onEventTap for test control ──────────────────
// MUST use mock-prefixed name so babel allows it in factory scope
let mockOnEventTap: ((e: { id: string; isExtra?: boolean }, teamId: string) => void) | null = null

jest.mock('../EventButtons', () => ({
  EventButtons: (props: { onEventTap: (e: { id: string; isExtra?: boolean }, teamId: string) => void }) => {
    mockOnEventTap = props.onEventTap
    return null
  },
}))

// ── Import after mocks ─────────────────────────────────────────────────────────
import { onSnapshot, updateDoc } from 'firebase/firestore'
import { CricketPanel, CricketPanelRef } from '../CricketPanel'
import { OverCompleteModal } from '../OverCompleteModal'

const TEAMS = [
  { id: 'team-a', name: 'India', colour: '#1DB954' },
  { id: 'team-b', name: 'Australia', colour: '#CC0000' },
]
const PLAYERS = [
  { id: 'p1', teamId: 'team-b', jerseyNumber: '7', name: 'Dhoni', position: 'WK' },
]

function renderPanel() {
  const ref = createRef<CricketPanelRef>()
  let instance!: ReturnType<typeof create>
  act(() => {
    instance = create(
      <CricketPanel
        ref={ref}
        sessionId="test-session"
        teams={TEAMS}
        players={PLAYERS}
        whoGoesFirst="team-a"
        onEventTap={jest.fn()}
        onScoringTap={jest.fn()}
        scoreFlashScale={new Animated.Value(1)}
        homeScore={0}
        awayScore={0}
      />,
    )
  })
  return { ref, instance }
}

describe('CricketPanel — over complete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOnEventTap = null
    // onSnapshot: immediately call callback with empty cricketState
    ;(onSnapshot as jest.Mock).mockImplementation((_ref, cb: (snap: unknown) => void) => {
      cb({ exists: () => true, data: () => ({ cricketState: null }) })
      return jest.fn()
    })
    ;(updateDoc as jest.Mock).mockResolvedValue(undefined)
  })

  /** Helper: deliver N legal balls one-by-one, flushing effects between each. */
  function deliverBalls(ref: React.RefObject<CricketPanelRef>, n: number) {
    for (let i = 0; i < n; i++) act(() => { ref.current?.countLegalDelivery() })
  }

  /** Helper: send N event taps one-by-one via the EventButtons mock. */
  function tapEvent(event: { id: string; isExtra?: boolean }, n = 1) {
    for (let i = 0; i < n; i++) act(() => { mockOnEventTap?.(event, 'team-a') })
  }

  it('does not show OverCompleteModal before 6 legal deliveries', () => {
    const { ref, instance } = renderPanel()
    deliverBalls(ref, 5)
    expect(() => instance.root.findByType(OverCompleteModal)).toThrow()
  })

  it('shows OverCompleteModal after exactly 6 legal deliveries', () => {
    const { ref, instance } = renderPanel()
    deliverBalls(ref, 6)
    expect(() => instance.root.findByType(OverCompleteModal)).not.toThrow()
    expect(instance.root.findByType(OverCompleteModal).props.overNumber).toBe(1)
  })

  it('passes bowlingPlayers from bowling team to OverCompleteModal', () => {
    const { ref, instance } = renderPanel()
    deliverBalls(ref, 6)
    const modal = instance.root.findByType(OverCompleteModal)
    expect(modal.props.bowlingPlayers).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Dhoni' })]),
    )
  })

  it('hides modal and writes currentBowler to Firestore after selection', () => {
    const { ref, instance } = renderPanel()
    deliverBalls(ref, 6)
    const modal = instance.root.findByType(OverCompleteModal)
    act(() => modal.props.onSelectBowler('Dhoni'))
    expect(() => instance.root.findByType(OverCompleteModal)).toThrow()
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cricketState: expect.objectContaining({ currentBowler: 'Dhoni' }),
      }),
    )
  })

  it('wide delivery (isExtra=true) does NOT count toward the over', () => {
    const { instance } = renderPanel()
    tapEvent({ id: 'run_1' }, 5)
    tapEvent({ id: 'wide', isExtra: true }, 1)
    expect(() => instance.root.findByType(OverCompleteModal)).toThrow()
  })

  it('6 non-extra EventButtons taps trigger over complete modal', () => {
    const { instance } = renderPanel()
    tapEvent({ id: 'run_1' }, 6)
    expect(() => instance.root.findByType(OverCompleteModal)).not.toThrow()
  })

  it('increments over number: first over = 1, second over = 2', () => {
    const { ref, instance } = renderPanel()
    deliverBalls(ref, 6)
    const modal1 = instance.root.findByType(OverCompleteModal)
    expect(modal1.props.overNumber).toBe(1)
    act(() => modal1.props.onSelectBowler('Dhoni'))
    deliverBalls(ref, 6)
    const modal2 = instance.root.findByType(OverCompleteModal)
    expect(modal2.props.overNumber).toBe(2)
  })
})
