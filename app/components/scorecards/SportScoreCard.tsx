/**
 * SportScoreCard — dispatches to the correct sport-specific scorecard component.
 *
 * Each sport's component is wired in sequentially:
 *   #40 Soccer     → SoccerScoreCard   ✅
 *   #41 Cricket    → CricketScoreCard  ✅
 *   #42 Basketball → BasketballScoreCard  ✅
 *   #43 American Football → AmFootballScoreCard  ✅
 *   #44 Pickleball → PickleballScoreCard  ✅
 *   #45 Badminton  → BadmintonScoreCard (pending)
 */

import type { SportKey } from '@genstadium/event-config'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { AmFootballScoreCard } from './AmFootballScoreCard'
import { PickleballScoreCard } from './PickleballScoreCard'
import { BasketballScoreCard } from './BasketballScoreCard'
import { CricketScoreCard } from './CricketScoreCard'
import { type MatchEvent, SoccerScoreCard } from './SoccerScoreCard'

export type { MatchEvent }

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
}

interface SportScoreCardProps {
  sportKey: SportKey
  tab: string
  teams: Team[]
  players: Player[]
  events: MatchEvent[]
  startedAtSeconds: number | null
}

export function SportScoreCard({ sportKey, tab, teams, players, events, startedAtSeconds }: SportScoreCardProps) {
  if (sportKey === 'soccer') {
    return (
      <SoccerScoreCard
        tab={tab}
        teams={teams}
        events={events}
        startedAtSeconds={startedAtSeconds}
      />
    )
  }

  if (sportKey === 'cricket') {
    return (
      <CricketScoreCard
        tab={tab}
        teams={teams}
        players={players}
        events={events}
      />
    )
  }

  if (sportKey === 'basketball') {
    return (
      <BasketballScoreCard
        tab={tab}
        teams={teams}
        players={players}
        events={events}
      />
    )
  }

  if (sportKey === 'american_football') {
    return (
      <AmFootballScoreCard
        tab={tab}
        teams={teams}
        events={events}
        startedAtSeconds={startedAtSeconds}
      />
    )
  }

  if (sportKey === 'pickleball') {
    return <PickleballScoreCard tab={tab} teams={teams} events={events} />
  }

  // Remaining sports wired in issue #45
  return (
    <View style={styles.pending}>
      <Text style={styles.pendingText}>
        {tab} scorecard coming soon
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pending: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  pendingText: {
    color: '#535353',
    fontSize: 14,
  },
})
