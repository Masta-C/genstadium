/**
 * CricketPanel — full-width single panel for cricket.
 *
 * Replaces the left/right split in sk-live when sport=cricket.
 * Shows batting/bowling teams, on-strike toggle, over counter, current bowler,
 * and the cricket EventButtons. End Innings swaps batting/bowling teams.
 *
 * Over tracking: every legal delivery (not Wide or No Ball) increments the ball counter.
 * At 6 legal balls, the Over Complete modal fires and Score Keeper picks the next bowler.
 * Wickets are counted via countLegalDelivery() called by sk-live after WicketSheet closes,
 * so the Over Complete modal never overlaps with the WicketSheet.
 */

import type { SportEvent } from '@genstadium/event-config'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../lib/firebase/client'
import { EventButtons } from './EventButtons'
import { OverCompleteModal } from './OverCompleteModal'

interface Team {
  id: string
  name: string
  colour: string
}

interface Player {
  id: string
  teamId: string
  jerseyNumber: string
  name: string
  position: string
}

interface CricketState {
  battingTeamId: string
  bowlingTeamId: string
  oversBowled: number
  ballsInCurrentOver: number
  currentBowler: string
  strikerPlayerId: string
  nonStrikerPlayerId: string
}

interface CricketPanelProps {
  sessionId: string
  teams: Team[]
  players: Player[]
  whoGoesFirst: string
  onEventTap: (event: SportEvent, teamId: string) => void
  onScoringTap: () => void
  scoreFlashScale: Animated.Value
  homeScore: number
  awayScore: number
  /** Called when cricketState changes — parent uses it to populate WicketSheet */
  onCricketStateChange?: (state: CricketState) => void
}

export interface CricketPanelRef {
  /** Count one legal delivery. Call from sk-live when WicketSheet closes. */
  countLegalDelivery: () => void
}

const DEFAULT_CRICKET_STATE = (battingTeamId: string, bowlingTeamId: string): CricketState => ({
  battingTeamId,
  bowlingTeamId,
  oversBowled: 0,
  ballsInCurrentOver: 0,
  currentBowler: '',
  strikerPlayerId: '',
  nonStrikerPlayerId: '',
})

export const CricketPanel = forwardRef<CricketPanelRef, CricketPanelProps>(function CricketPanel(
  {
    sessionId,
    teams,
    players,
    whoGoesFirst,
    onEventTap,
    onScoringTap,
    scoreFlashScale,
    homeScore,
    awayScore,
    onCricketStateChange,
  },
  ref,
) {
  const battingTeamIdDefault = whoGoesFirst || teams[0]?.id || 'team-a'
  const bowlingTeamIdDefault = teams.find((t) => t.id !== battingTeamIdDefault)?.id || 'team-b'

  const [cricketState, setCricketState] = useState<CricketState>(
    DEFAULT_CRICKET_STATE(battingTeamIdDefault, bowlingTeamIdDefault),
  )
  const [showOverModal, setShowOverModal] = useState(false)
  const [completedOverNumber, setCompletedOverNumber] = useState(0)

  // Keep a ref to avoid stale closure in countLegalDelivery
  const cricketStateRef = useRef<CricketState>(cricketState)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    cricketStateRef.current = cricketState
  }, [cricketState])

  // Subscribe to cricketState from Firestore
  useEffect(() => {
    if (!sessionId) return

    const ref = doc(db, 'sessions', sessionId)
    unsubRef.current = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (data.cricketState) {
          const cs = data.cricketState as CricketState
          setCricketState(cs)
          onCricketStateChange?.(cs)
        } else {
          const initial = DEFAULT_CRICKET_STATE(battingTeamIdDefault, bowlingTeamIdDefault)
          updateDoc(ref, { cricketState: initial }).catch(() => {/* silent */})
          setCricketState(initial)
          onCricketStateChange?.(initial)
        }
      }
    })

    return () => { unsubRef.current?.() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const battingTeam = teams.find((t) => t.id === cricketState.battingTeamId) ?? teams[0]
  const bowlingTeam = teams.find((t) => t.id === cricketState.bowlingTeamId) ?? teams[1]
  const bowlingPlayers = players.filter((p) => p.teamId === cricketState.bowlingTeamId)
  const battingPlayers = players.filter((p) => p.teamId === cricketState.battingTeamId)
  const striker = battingPlayers.find((p) => p.id === cricketState.strikerPlayerId) ?? battingPlayers[0]

  const overLabel = `${cricketState.oversBowled}.${cricketState.ballsInCurrentOver} ov`

  const battingScore = battingTeam?.id === teams[0]?.id ? homeScore : awayScore
  const bowlingScore = bowlingTeam?.id === teams[0]?.id ? homeScore : awayScore

  function applyStateUpdate(updated: CricketState) {
    setCricketState(updated)
    onCricketStateChange?.(updated)
    updateDoc(doc(db, 'sessions', sessionId), { cricketState: updated }).catch(() => {/* silent */})
  }

  /** Increment ball counter. At 6 balls: reset counter, bump over count, show modal. */
  const countLegalDelivery = useCallback(() => {
    const cs = cricketStateRef.current
    const newBalls = cs.ballsInCurrentOver + 1

    if (newBalls >= 6) {
      const newOvers = cs.oversBowled + 1
      const updated: CricketState = { ...cs, ballsInCurrentOver: 0, oversBowled: newOvers }
      applyStateUpdate(updated)
      setCompletedOverNumber(newOvers)
      setShowOverModal(true)
    } else {
      const updated: CricketState = { ...cs, ballsInCurrentOver: newBalls }
      applyStateUpdate(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useImperativeHandle(ref, () => ({ countLegalDelivery }), [countLegalDelivery])

  function handleStrikeSwitch(newStrikerId: string, newNonStrikerId: string) {
    applyStateUpdate({ ...cricketState, strikerPlayerId: newStrikerId, nonStrikerPlayerId: newNonStrikerId })
  }

  function handleEndInnings() {
    Alert.alert(
      'End Innings?',
      `${battingTeam?.name ?? 'Batting team'} finishes batting. Teams swap.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Innings',
          style: 'destructive',
          onPress: () => {
            applyStateUpdate({
              battingTeamId: cricketState.bowlingTeamId,
              bowlingTeamId: cricketState.battingTeamId,
              oversBowled: 0,
              ballsInCurrentOver: 0,
              currentBowler: '',
              strikerPlayerId: '',
              nonStrikerPlayerId: '',
            })
          },
        },
      ],
    )
  }

  function handleBowlerSelect(name: string) {
    applyStateUpdate({ ...cricketStateRef.current, currentBowler: name })
    setShowOverModal(false)
  }

  const handleEventTapWrapped = useCallback(
    (event: SportEvent, teamId: string) => {
      if (event.id === 'end_innings') {
        handleEndInnings()
        return
      }
      onEventTap(event, teamId)
      // Wide and No Ball are extras — do not count as legal deliveries
      // Wickets are counted by sk-live via countLegalDelivery() after WicketSheet closes
      if (!event.isExtra && event.id !== 'wicket') {
        countLegalDelivery()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onEventTap, cricketState, countLegalDelivery],
  )

  return (
    <View style={styles.container}>
      {/* Innings header */}
      <View style={styles.inningsHeader}>
        <View style={[styles.teamScore, styles.battingTeam]}>
          <View style={[styles.colourDot, { backgroundColor: battingTeam?.colour ?? '#1DB954' }]} />
          <Text style={[styles.teamName, { color: battingTeam?.colour ?? '#1DB954' }]} numberOfLines={1}>
            {battingTeam?.name ?? 'Batting'}
          </Text>
          <Animated.Text style={[styles.score, { transform: [{ scale: scoreFlashScale }] }]}>
            {battingScore}
          </Animated.Text>
          <Text style={styles.battingLabel}>BAT</Text>
        </View>

        <View style={styles.overBadge}>
          <Text style={styles.overLabel}>{overLabel}</Text>
          {cricketState.currentBowler ? (
            <Text style={styles.bowlerLabel} numberOfLines={1}>
              {cricketState.currentBowler}
            </Text>
          ) : null}
        </View>

        <View style={styles.teamScore}>
          <View style={[styles.colourDot, { backgroundColor: bowlingTeam?.colour ?? '#2D86FF' }]} />
          <Text style={[styles.teamName, { color: '#535353' }]} numberOfLines={1}>
            {bowlingTeam?.name ?? 'Bowling'}
          </Text>
          <Text style={[styles.score, styles.scoreMuted]}>{bowlingScore}</Text>
          <Text style={styles.bowlingLabel}>BOWL</Text>
        </View>
      </View>

      {/* On-strike toggle */}
      {battingPlayers.length >= 2 ? (
        <View style={styles.strikeRow}>
          <TouchableOpacity
            style={[styles.batsmanChip, striker?.id === battingPlayers[0]?.id && styles.batsmanChipActive]}
            onPress={() => handleStrikeSwitch(battingPlayers[0].id, battingPlayers[1]?.id ?? '')}
            activeOpacity={0.8}
          >
            <Text style={[styles.batsmanName, striker?.id === battingPlayers[0]?.id && styles.batsmanNameActive]}>
              {battingPlayers[0]?.name ?? 'Batsman 1'}
            </Text>
            {striker?.id === battingPlayers[0]?.id ? (
              <Text style={styles.strikeIndicator}>*</Text>
            ) : null}
          </TouchableOpacity>

          <Text style={styles.strikeSep}>vs</Text>

          <TouchableOpacity
            style={[styles.batsmanChip, striker?.id === battingPlayers[1]?.id && styles.batsmanChipActive]}
            onPress={() => handleStrikeSwitch(battingPlayers[1].id, battingPlayers[0]?.id ?? '')}
            activeOpacity={0.8}
          >
            <Text style={[styles.batsmanName, striker?.id === battingPlayers[1]?.id && styles.batsmanNameActive]}>
              {battingPlayers[1]?.name ?? 'Batsman 2'}
            </Text>
            {striker?.id === battingPlayers[1]?.id ? (
              <Text style={styles.strikeIndicator}>*</Text>
            ) : null}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Cricket event buttons — full width */}
      <View style={styles.buttons}>
        <EventButtons
          sportKey="cricket"
          teamId={cricketState.battingTeamId}
          onEventTap={handleEventTapWrapped}
          onScoringTap={onScoringTap}
        />
      </View>

      {/* Over Complete modal — fires when 6th legal ball is bowled */}
      {showOverModal && (
        <OverCompleteModal
          overNumber={completedOverNumber}
          bowlingPlayers={bowlingPlayers}
          onSelectBowler={handleBowlerSelect}
        />
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  inningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  teamScore: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  battingTeam: {
    opacity: 1,
  },
  colourDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamName: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  score: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  scoreMuted: { color: '#535353' },
  battingLabel: {
    color: '#1DB954',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bowlingLabel: {
    color: '#535353',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  overBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  overLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bowlerLabel: {
    color: '#535353',
    fontSize: 11,
    marginTop: 2,
    maxWidth: 80,
  },
  strikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  batsmanChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 4,
  },
  batsmanChipActive: {
    backgroundColor: '#0D2B14',
    borderColor: '#1DB954',
  },
  batsmanName: {
    color: '#535353',
    fontSize: 13,
    fontWeight: '600',
  },
  batsmanNameActive: { color: '#1DB954' },
  strikeIndicator: {
    color: '#1DB954',
    fontSize: 16,
    fontWeight: '800',
  },
  strikeSep: {
    color: '#535353',
    fontSize: 12,
  },
  buttons: { flex: 1 },
})
