import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

interface WicketAnimationProps {
  batsmanName?: string
  bowlerName?: string
  dismissalType?: string
}

export const WicketAnimation: React.FC<WicketAnimationProps> = ({
  batsmanName = '',
  bowlerName = '',
  dismissalType = 'OUT',
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const textScale = spring({ frame, fps, config: { damping: 10, stiffness: 180 } })
  const opacity = interpolate(frame, [0, 5, 70, 90], [0, 1, 1, 0], { extrapolateRight: 'clamp' })
  const stumpsSlide = spring({ frame, fps, from: 300, to: 0, config: { damping: 14 } })

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', opacity }}>
      {/* Flying stumps graphic */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          display: 'flex',
          gap: 12,
          transform: `translateY(${-stumpsSlide}px) rotate(${interpolate(frame, [0, 30], [0, -15])}deg)`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 90,
              backgroundColor: '#D4A852',
              borderRadius: 4,
              transform: `rotate(${(i - 1) * 8}deg)`,
            }}
          />
        ))}
      </div>

      {/* OUT label */}
      <div
        style={{
          transform: `scale(${textScale})`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ backgroundColor: '#CC0000', borderRadius: 10, padding: '16px 48px' }}>
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 72,
              fontWeight: 900,
              letterSpacing: 8,
              fontFamily: 'sans-serif',
            }}
          >
            WICKET!
          </span>
        </div>

        <span style={{ color: '#FFD700', fontSize: 28, fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: 2 }}>
          {dismissalType.toUpperCase()}
        </span>

        {batsmanName ? (
          <span style={{ color: '#FFFFFF', fontSize: 26, fontFamily: 'sans-serif', fontWeight: 600 }}>
            {batsmanName}
          </span>
        ) : null}

        {bowlerName ? (
          <span style={{ color: '#B3B3B3', fontSize: 22, fontFamily: 'sans-serif' }}>
            b. {bowlerName}
          </span>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}
