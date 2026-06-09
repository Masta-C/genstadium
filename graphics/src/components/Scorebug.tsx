/**
 * Scorebug.tsx — Live broadcast scorebug overlay.
 *
 * Plain React — NOT Remotion (ADR-003). Subscribes to:
 *   sessions/{sessionId}           — teams[].name, teams[].colour
 *   sessions/{sessionId}/scoreState — homeScore, awayScore, period
 *
 * Positioned by the parent (App.tsx) at bottom-right.
 * Score numbers use tabular-nums to prevent layout shift on update.
 * Score change triggers scale spring animation (issue #49).
 */

import { doc, onSnapshot } from 'firebase/firestore'
import React, { useEffect, useRef, useState } from 'react'
import { db } from '../lib/firebase'
import styles from './Scorebug.module.css'

interface Team {
  name: string
  colour: string
}

interface ScoreState {
  homeScore: number
  awayScore: number
  period: string
}

interface Props {
  sessionId: string
}

export default function Scorebug({ sessionId }: Props) {
  const [teams, setTeams] = useState<[Team, Team] | null>(null)
  const [scoreState, setScoreState] = useState<ScoreState>({
    homeScore: 0,
    awayScore: 0,
    period: '',
  })
  // Track which scores are animating; key = home|away, value = animation counter
  const [homeFlash, setHomeFlash] = useState(0)
  const [awayFlash, setAwayFlash] = useState(0)
  // Refs hold previous scores to detect changes without triggering re-renders
  const prevHome = useRef<number | null>(null)
  const prevAway = useRef<number | null>(null)

  useEffect(() => {
    const sessionUnsub = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (!snap.exists()) return
      const rawTeams: Team[] = snap.data().teams ?? []
      if (rawTeams.length >= 2) {
        setTeams([rawTeams[0], rawTeams[1]])
      }
    })

    const scoreUnsub = onSnapshot(
      doc(db, 'sessions', sessionId, 'scoreState', 'current'),
      (snap) => {
        if (!snap.exists()) return
        const data = snap.data()
        const next: ScoreState = {
          homeScore: data.homeScore ?? 0,
          awayScore: data.awayScore ?? 0,
          period: data.period ?? '',
        }
        // Detect change only after initial render (prevHome/Away initialised)
        if (prevHome.current !== null && next.homeScore !== prevHome.current) {
          setHomeFlash((n) => n + 1)
        }
        if (prevAway.current !== null && next.awayScore !== prevAway.current) {
          setAwayFlash((n) => n + 1)
        }
        prevHome.current = next.homeScore
        prevAway.current = next.awayScore
        setScoreState(next)
      },
    )

    return () => {
      sessionUnsub()
      scoreUnsub()
    }
  }, [sessionId])

  const homeTeam = teams?.[0] ?? { name: 'Home', colour: '#FFFFFF' }
  const awayTeam = teams?.[1] ?? { name: 'Away', colour: '#FFFFFF' }

  return (
    <div
      style={{
        maxWidth: 320,
        backgroundColor: 'rgba(18,18,18,0.92)',
        backdropFilter: 'blur(8px)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        userSelect: 'none',
      }}
    >
      {/* Period bar */}
      {scoreState.period ? (
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            textAlign: 'center',
            padding: '3px 0',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#B3B3B3',
            textTransform: 'uppercase',
          }}
        >
          {scoreState.period}
        </div>
      ) : null}

      {/* Scores */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
        }}
      >
        <TeamScore team={homeTeam} score={scoreState.homeScore} align="left" flashKey={homeFlash} />
        <div
          style={{
            width: 1,
            backgroundColor: 'rgba(255,255,255,0.1)',
            flexShrink: 0,
          }}
        />
        <TeamScore team={awayTeam} score={scoreState.awayScore} align="right" flashKey={awayFlash} />
      </div>
    </div>
  )
}

interface TeamScoreProps {
  team: Team
  score: number
  align: 'left' | 'right'
  flashKey: number
}

function TeamScore({ team, score, align, flashKey }: TeamScoreProps) {
  const isLeft = align === 'left'
  // Re-mount span by changing key to replay the CSS animation on each score change
  const animKey = flashKey > 0 ? flashKey : undefined
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: isLeft ? 'row' : 'row-reverse',
        alignItems: 'center',
        padding: '10px 12px',
        gap: 8,
        minWidth: 0,
      }}
    >
      {/* Colour dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: team.colour,
          flexShrink: 0,
        }}
      />
      {/* Team name */}
      <span
        style={{
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          textAlign: isLeft ? 'left' : 'right',
        }}
      >
        {team.name}
      </span>
      {/* Score — re-keyed to replay animation; transform-only to avoid reflow */}
      <span
        key={animKey}
        className={flashKey > 0 ? styles.scoreFlash : undefined}
        style={{
          color: '#FFFFFF',
          fontSize: 22,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          flexShrink: 0,
          minWidth: 28,
          textAlign: 'center',
          display: 'inline-block',
        }}
      >
        {score}
      </span>
    </div>
  )
}
