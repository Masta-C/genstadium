/**
 * LowerThird.tsx — Animated broadcast lower third overlay.
 *
 * Subscribes to the latest event in sessions/{sessionId}/events
 * (ordered by timestamp desc, limit 1). When a new event with
 * `triggers` containing "animation" arrives, shows a sliding panel:
 *   slide up 300ms → hold 3s → slide down 200ms
 *
 * Positioned bottom-left by App.tsx within the broadcast safe zone.
 */

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../lib/firebase'

interface Team {
  name: string
  colour: string
}

interface EventDoc {
  id: string
  eventType: string
  label?: string
  team?: string
  playerId?: string
  displayName?: string
  triggers?: string[]
  timestamp?: { toMillis: () => number } | null
}

type AnimState = 'hidden' | 'sliding-up' | 'holding' | 'sliding-down'

interface Props {
  sessionId: string
}

export default function LowerThird({ sessionId }: Props) {
  const [teams, setTeams] = useState<Team[]>([])
  const [animState, setAnimState] = useState<AnimState>('hidden')
  const [displayEvent, setDisplayEvent] = useState<EventDoc | null>(null)
  // Track last seen event id to detect genuinely new events
  const lastEventId = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const triggerAnimation = useCallback(
    (event: EventDoc) => {
      clearTimers()
      setDisplayEvent(event)
      setAnimState('sliding-up')

      // After slide-up (300ms) → hold
      timerRef.current = setTimeout(() => {
        setAnimState('holding')
        // After hold (3000ms) → slide-down
        timerRef.current = setTimeout(() => {
          setAnimState('sliding-down')
          // After slide-down (200ms) → hidden
          timerRef.current = setTimeout(() => {
            setAnimState('hidden')
          }, 200)
        }, 3000)
      }, 300)
    },
    [clearTimers],
  )

  useEffect(() => {
    const sessionUnsub = onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
      if (!snap.exists()) return
      setTeams(snap.data().teams ?? [])
    })

    const eventsQuery = query(
      collection(db, 'sessions', sessionId, 'events'),
      orderBy('timestamp', 'desc'),
      limit(1),
    )

    const eventsUnsub = onSnapshot(eventsQuery, (snap) => {
      if (snap.empty) return
      const docSnap = snap.docs[0]
      const data = docSnap.data()
      const event: EventDoc = {
        id: docSnap.id,
        eventType: data.eventType ?? '',
        label: data.label,
        team: data.team,
        playerId: data.playerId,
        displayName: data.displayName,
        triggers: data.triggers ?? [],
        timestamp: data.timestamp,
      }
      const hasAnimationTrigger = event.triggers?.includes('animation') ?? false
      const isNew = event.id !== lastEventId.current
      if (isNew && hasAnimationTrigger) {
        lastEventId.current = event.id
        triggerAnimation(event)
      } else if (isNew) {
        lastEventId.current = event.id
      }
    })

    return () => {
      sessionUnsub()
      eventsUnsub()
      clearTimers()
    }
  }, [sessionId, triggerAnimation, clearTimers])

  if (animState === 'hidden' || !displayEvent) return null

  const teamColour = resolveTeamColour(displayEvent.team, teams)
  const bgColour = hexToRgba(teamColour, 0.6)
  const playerName = displayEvent.displayName ?? 'Unknown'
  const eventLabel = displayEvent.label ?? displayEvent.eventType

  const translateY =
    animState === 'sliding-up' || animState === 'holding' ? '0%' : '120%'
  const transition =
    animState === 'sliding-up'
      ? 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)'
      : animState === 'sliding-down'
        ? 'transform 200ms ease-in'
        : 'none'

  return (
    <div
      style={{
        maxWidth: 640,
        transform: `translateY(${translateY})`,
        transition,
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
        userSelect: 'none',
      }}
    >
      {/* Colour accent bar */}
      <div
        style={{
          height: 4,
          backgroundColor: teamColour,
        }}
      />
      {/* Main panel */}
      <div
        style={{
          backgroundColor: bgColour,
          backdropFilter: 'blur(8px)',
          padding: '10px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          {eventLabel}
        </span>
        <span
          style={{
            color: '#FFFFFF',
            fontSize: 22,
            fontWeight: 800,
            lineHeight: 1.1,
          }}
        >
          {playerName}
        </span>
      </div>
    </div>
  )
}

function resolveTeamColour(teamRef: string | undefined, teams: Team[]): string {
  if (!teamRef) return '#1DB954'
  const match = teams.find(
    (t) => t.name === teamRef || t.name.toLowerCase() === teamRef.toLowerCase(),
  )
  return match?.colour ?? '#1DB954'
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(29,185,84,${alpha})`
  return `rgba(${r},${g},${b},${alpha})`
}
