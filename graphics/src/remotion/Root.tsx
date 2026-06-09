import { Composition } from 'remotion'
import { GoalFlash } from './GoalFlash'
import { WicketAnimation } from './WicketAnimation'
import { RedCard } from './RedCard'

export const COMPOSITION_IDS = {
  GOAL_FLASH: 'GoalFlash',
  WICKET: 'WicketAnimation',
  RED_CARD: 'RedCard',
} as const

export type CompositionId = (typeof COMPOSITION_IDS)[keyof typeof COMPOSITION_IDS]

/** FPS and duration for all animation clips — 3 seconds at 30fps = 90 frames */
const FPS = 30
const DURATION_FRAMES = 90 // 3 seconds

export function RemotionRoot() {
  return (
    <>
      <Composition
        id={COMPOSITION_IDS.GOAL_FLASH}
        component={GoalFlash}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ teamName: 'Team', teamColour: '#CC0000', playerName: '' }}
      />
      <Composition
        id={COMPOSITION_IDS.WICKET}
        component={WicketAnimation}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ batsmanName: '', bowlerName: '', dismissalType: 'OUT' }}
      />
      <Composition
        id={COMPOSITION_IDS.RED_CARD}
        component={RedCard}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ playerName: '', teamName: '' }}
      />
    </>
  )
}
