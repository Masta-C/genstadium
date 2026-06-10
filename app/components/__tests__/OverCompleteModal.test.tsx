/**
 * OverCompleteModal unit tests — uses react-test-renderer (matches project convention).
 */
import React, { act } from 'react'
import { create } from 'react-test-renderer'
import { Text, TouchableOpacity } from 'react-native'
import { OverCompleteModal } from '../OverCompleteModal'

// Modal renders into a portal in RN — replace with a plain View in tests
jest.mock('react-native/Libraries/Modal/Modal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  function ModalMock({ children }: { children: React.ReactNode }) {
    return <View>{children}</View>
  }
  return ModalMock
})

const BOWLERS = [
  { id: 'p1', teamId: 'team-b', jerseyNumber: '7', name: 'Dhoni', position: 'WK' },
  { id: 'p2', teamId: 'team-b', jerseyNumber: '18', name: 'Virat', position: 'BAT' },
]

/**
 * Find a Text node whose rendered text (handles JSX array children) matches label.
 */
function childrenToString(children: unknown): string {
  if (Array.isArray(children)) return children.map((c) => String(c ?? '')).join('')
  return String(children ?? '')
}

function findText(instance: ReturnType<typeof create>, label: string) {
  return instance.root
    .findAllByType(Text)
    .find((t) => childrenToString(t.props.children) === label)
}

function findButton(instance: ReturnType<typeof create>, label: string) {
  return instance.root
    .findAllByType(TouchableOpacity)
    .find((btn) =>
      btn.findAllByType(Text).some((t) => childrenToString(t.props.children) === label),
    )
}

describe('OverCompleteModal', () => {
  it('renders the over number', () => {
    const instance = create(
      <OverCompleteModal overNumber={3} bowlingPlayers={BOWLERS} onSelectBowler={jest.fn()} />,
    )
    expect(findText(instance, 'Over 3 complete')).toBeTruthy()
  })

  it('renders all bowler names', () => {
    const instance = create(
      <OverCompleteModal overNumber={1} bowlingPlayers={BOWLERS} onSelectBowler={jest.fn()} />,
    )
    expect(findText(instance, 'Dhoni')).toBeTruthy()
    expect(findText(instance, 'Virat')).toBeTruthy()
  })

  it('calls onSelectBowler with player name when a player row is tapped', () => {
    const onSelect = jest.fn()
    const instance = create(
      <OverCompleteModal overNumber={1} bowlingPlayers={BOWLERS} onSelectBowler={onSelect} />,
    )
    const btn = findButton(instance, 'Dhoni')!
    act(() => btn.props.onPress())
    expect(onSelect).toHaveBeenCalledWith('Dhoni')
  })

  it('calls onSelectBowler with empty string when Skip is tapped', () => {
    const onSelect = jest.fn()
    const instance = create(
      <OverCompleteModal overNumber={2} bowlingPlayers={BOWLERS} onSelectBowler={onSelect} />,
    )
    const btn = findButton(instance, 'Skip — select later')!
    act(() => btn.props.onPress())
    expect(onSelect).toHaveBeenCalledWith('')
  })

  it('shows Unknown bowler option and calls onSelectBowler("Unknown") when no players', () => {
    const onSelect = jest.fn()
    const instance = create(
      <OverCompleteModal overNumber={1} bowlingPlayers={[]} onSelectBowler={onSelect} />,
    )
    expect(findText(instance, 'Unknown bowler')).toBeTruthy()
    const btn = findButton(instance, 'Unknown bowler')!
    act(() => btn.props.onPress())
    expect(onSelect).toHaveBeenCalledWith('Unknown')
  })

  it('renders jersey numbers', () => {
    const instance = create(
      <OverCompleteModal overNumber={1} bowlingPlayers={BOWLERS} onSelectBowler={jest.fn()} />,
    )
    expect(findText(instance, '7')).toBeTruthy()
    expect(findText(instance, '18')).toBeTruthy()
  })
})
