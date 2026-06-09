import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface GoalFlashProps {
  teamName?: string
  teamColour?: string
  playerName?: string
}

export const GoalFlash: React.FC<GoalFlashProps> = ({
  teamName = 'GOAL',
  teamColour = '#CC0000',
  playerName = '',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 200 } })
  const opacity = interpolate(frame, [0, 5, 70, 90], [0, 1, 1, 0], { extrapolateRight: 'clamp' })
  const ringScale = spring({ frame, fps, from: 0.6, to: 2, config: { damping: 20, mass: 1.2 } })

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', opacity }}>
      {/* Pulsing ring */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          border: `4px solid ${teamColour}`,
          opacity: interpolate(frame, [0, 30, 60], [0.8, 0.3, 0], { extrapolateRight: 'clamp' }),
          transform: `scale(${ringScale})`,
        }}
      />

      {/* Main content */}
      <div
        style={{
          transform: `scale(${scale})`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            backgroundColor: teamColour,
            borderRadius: 12,
            padding: '20px 48px',
          }}
        >
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 80,
              fontWeight: 900,
              letterSpacing: 8,
              fontFamily: 'sans-serif',
              textTransform: 'uppercase',
            }}
          >
            GOAL!
          </span>
        </div>

        <span
          style={{
            color: '#FFFFFF',
            fontSize: 32,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 4,
          }}
        >
          {teamName}
        </span>

        {playerName ? (
          <span style={{ color: '#B3B3B3', fontSize: 24, fontFamily: 'sans-serif' }}>
            {playerName}
          </span>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}
