/**
 * CricketPanel — full-width single panel for cricket.
 *
 * Replaces the left/right split in sk-live when sport=cricket.
 * Shows batting/bowling teams, on-strike toggle, over counter, current bowler,
 * and the cricket EventButtons. End Innings swaps batting/bowling teams.
 */

import type { SportEvent } from '@genstadium/event-config'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import React, { useCallback, useEffect, useRef, useState } from 'react'
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

const DEFAULT_CRICKET_STATE = (battingTeamId: string, bowlingTeamId: string): CricketState => ({
  battingTeamId,
  bowlingTeamId,
  oversBowled: 0,
  ballsInCurrentOver: 0,
  currentBowler: '',
  strikerPlayerId: '',
  nonStrikerPlayerId: '',
})

export function CricketPanel({
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
}: CricketPanelProps) {
  const battingTeamIdDefault = whoGoesFirst || teams[0]?.id || 'team-a'
  const bowlingTeamIdDefault = teams.find((t) => t.id !== battingTeamIdDefault)?.id || 'team-b'

  const [cricketState, setCricketState] = useState<CricketState>(
    DEFAULT_CRICKET_STATE(battingTeamIdDefault, bowlingTeamIdDefault),
  )
  const unsubRef = useRef<(() => void) | null>(null)

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
          // initialise on first load
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

  const battingPlayers = players.filter((p) => p.teamId === cricketState.battingTeamId)
  const striker = battingPlayers.find((p) => p.id === cricketState.strikerPlayerId) ?? battingPlayers[0]

  const overLabel = `${cricketState.oversBowled}.${cricketState.ballsInCurrentOver} ov`

  // Team A score = homeScore, Team B score = awayScore
  const battingScore = battingTeam?.id === teams[0]?.id ? homeScore : awayScore
  const bowlingScore = bowlingTeam?.id === teams[0]?.id ? homeScore : awayScore

  function handleStrikeSwitch(newStrikerId: string, newNonStrikerId: string) {
    const updated = { ...cricketState, strikerPlayerId: newStrikerId, nonStrikerPlayerId: newNonStrikerId }
    setCricketState(updated)
    updateDoc(doc(db, 'sessions', sessionId), { cricketState: updated }).catch(() => {/* silent */})
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
            const updated: CricketState = {
              battingTeamId: cricketState.bowlingTeamId,
              bowlingTeamId: cricketState.battingTeamId,
              oversBowled: 0,
              ballsInCurrentOver: 0,
              currentBowler: '',
              strikerPlayerId: '',
              nonStrikerPlayerId: '',
            }
            setCricketState(updated)
            updateDoc(doc(db, 'sessions', sessionId), {
              cricketState: updated,
            }).catch(() => {/* silent */})
          },
        },
      ],
    )
  }

  // Intercept END_INN → confirm dialog. Wicket is handled by sk-live (WicketSheet).
  const handleEventTapWrapped = useCallback(
    (event: SportEvent, teamId: string) => {
      if (event.id === 'end_innings') {
        handleEndInnings()
        return
      }
      onEventTap(event, teamId)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onEventTap, cricketState],
  )

  return (
    <View style={styles.container}>
      {/* Innings header */}
      <View style={styles.inningsHeader}>
        {/* Batting team (highlighted) */}
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

        {/* Over badge */}
        <View style={styles.overBadge}>
          <Text style={styles.overLabel}>{overLabel}</Text>
          {cricketState.currentBowler ? (
            <Text style={styles.bowlerLabel} numberOfLines={1}>
              {cricketState.currentBowler}
            </Text>
          ) : null}
        </View>

        {/* Bowling team (muted) */}
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
    </View>
  )
}

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
