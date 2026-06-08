/**
 * SportScoreCard — dispatches to the correct sport-specific scorecard component.
 *
 * Each sport's component is wired in sequentially:
 *   #40 Soccer  → SoccerScoreCard  ✅
 *   #41 Cricket → CricketScoreCard (pending)
 *   #42 Basketball → BasketballScoreCard (pending)
 *   #43 American Football → AmFootballScoreCard (pending)
 *   #44 Pickleball → PickleballScoreCard (pending)
 *   #45 Badminton → BadmintonScoreCard (pending)
 */

import type { SportKey } from '@genstadium/event-config'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { type MatchEvent, SoccerScoreCard } from './SoccerScoreCard'

export type { MatchEvent }

interface Team {
  id: string
  name: string
  colour: string
}

interface SportScoreCardProps {
  sportKey: SportKey
  tab: string
  teams: Team[]
  events: MatchEvent[]
  startedAtSeconds: number | null
}

export function SportScoreCard({ sportKey, tab, teams, events, startedAtSeconds }: SportScoreCardProps) {
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

  // Remaining sports wired in issues #41–#45
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
