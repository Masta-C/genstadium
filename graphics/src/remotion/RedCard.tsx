import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface RedCardProps {
  playerName?: string
  teamName?: string
}

export const RedCard: React.FC<RedCardProps> = ({
  playerName = '',
  teamName = '',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const cardScale = spring({ frame, fps, config: { damping: 8, stiffness: 150 } })
  const cardRotate = interpolate(frame, [0, 10, 15], [90, 5, 0], { extrapolateRight: 'clamp' })
  const opacity = interpolate(frame, [0, 4, 70, 90], [0, 1, 1, 0], { extrapolateRight: 'clamp' })
  const shake = frame < 20
    ? interpolate(frame % 4, [0, 1, 2, 3], [-4, 4, -4, 4])
    : 0

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', opacity }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          transform: `scale(${cardScale}) translateX(${shake}px)`,
        }}
      >
        {/* Red card rectangle */}
        <div
          style={{
            width: 120,
            height: 170,
            backgroundColor: '#CC0000',
            borderRadius: 14,
            boxShadow: '0 0 60px rgba(204,0,0,0.7)',
            transform: `rotate(${cardRotate}deg)`,
          }}
        />

        {/* Player info */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              color: '#CC0000',
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: 4,
              fontFamily: 'sans-serif',
              textTransform: 'uppercase',
            }}
          >
            RED CARD
          </span>

          {playerName ? (
            <span style={{ color: '#FFFFFF', fontSize: 28, fontWeight: 700, fontFamily: 'sans-serif' }}>
              {playerName}
            </span>
          ) : null}

          {teamName ? (
            <span style={{ color: '#B3B3B3', fontSize: 22, fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: 2 }}>
              {teamName}
            </span>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  )
}
