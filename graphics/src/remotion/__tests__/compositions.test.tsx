import React from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

// Mock Remotion — compositions call useCurrentFrame/useVideoConfig at render time.
// Tests only verify that compositions render without throwing given valid props.
vi.mock('remotion', () => ({
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, durationInFrames: 90, width: 1920, height: 1080, id: '' }),
  spring: () => 1,
  interpolate: (_val: number, _in: number[], out: number[]) => out[0] ?? 0,
  AbsoluteFill: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) =>
    React.createElement('div', { style }, children),
  Composition: ({ id }: { id: string }) => React.createElement('div', { 'data-id': id }),
}))

import { GoalFlash } from '../GoalFlash'
import { RedCard } from '../RedCard'
import { WicketAnimation } from '../WicketAnimation'
import { RemotionRoot, COMPOSITION_IDS } from '../Root'

describe('GoalFlash', () => {
  test('renders with default props', () => {
    expect(() => render(<GoalFlash />)).not.toThrow()
  })

  test('renders with explicit props', () => {
    expect(() =>
      render(<GoalFlash teamName="Arsenal" teamColour="#CC0000" playerName="Saka" />),
    ).not.toThrow()
  })
})

describe('RedCard', () => {
  test('renders with default props', () => {
    expect(() => render(<RedCard />)).not.toThrow()
  })

  test('renders with explicit props', () => {
    expect(() => render(<RedCard playerName="Player" teamName="Team A" />)).not.toThrow()
  })
})

describe('WicketAnimation', () => {
  test('renders with default props', () => {
    expect(() => render(<WicketAnimation />)).not.toThrow()
  })

  test('renders with explicit props', () => {
    expect(() =>
      render(
        <WicketAnimation batsmanName="Root" bowlerName="Bumrah" dismissalType="Caught" />,
      ),
    ).not.toThrow()
  })
})

describe('RemotionRoot', () => {
  test('registers all expected composition IDs', () => {
    const { container } = render(<RemotionRoot />)
    const ids = Array.from(container.querySelectorAll('[data-id]')).map((el) =>
      el.getAttribute('data-id'),
    )
    expect(ids).toContain(COMPOSITION_IDS.GOAL_FLASH)
    expect(ids).toContain(COMPOSITION_IDS.WICKET)
    expect(ids).toContain(COMPOSITION_IDS.RED_CARD)
  })
})
