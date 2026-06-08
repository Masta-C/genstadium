/**
 * AmFootballScoreCard — Events / Scoring / Penalties tabs for the Session Ended screen.
 *
 * Events: chronological log — event type + team + quarter.
 * Scoring: scoring play breakdown per team with quarter score breakdown.
 * Penalties: penalty count per team.
 */

import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MatchEvent } from './SoccerScoreCard'

interface Team {
  id: string
  name: string
  colour: string
}

interface AmFootballScoreCardProps {
  tab: string   // 'Events' | 'Scoring' | 'Penalties'
  teams: Team[]
  events: MatchEvent[]
  startedAtSeconds: number | null
}

const SCORING_TYPES = new Set(['touchdown', 'field_goal', 'extra_point', 'two_point', 'safety'])
const SCORE_LABELS: Record<string, string> = {
  touchdown: 'Touchdown (6)',
  field_goal: 'Field Goal (3)',
  extra_point: 'Extra Point (1)',
  two_point: '2-Point Conv (2)',
  safety: 'Safety (2)',
}
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT']

/** Derive quarter from event index (simple uniform split approximation) */
function quarterLabel(idx: number, total: number): string {
  if (total <= 0) return 'Q1'
  const ratio = idx / total
  if (ratio < 0.25) return 'Q1'
  if (ratio < 0.5) return 'Q2'
  if (ratio < 0.75) return 'Q3'
  return 'Q4'
}

export function AmFootballScoreCard({ tab, teams, events, startedAtSeconds: _startedAtSeconds }: AmFootballScoreCardProps) {
  const teamA = teams[0]
  const teamB = teams[1]

  // Sort events by timestamp
  const sorted = [...events].sort((a, b) => (a.timestamp?.seconds ?? 0) - (b.timestamp?.seconds ?? 0))
  const totalEvents = sorted.length

  if (tab === 'Events') {
    if (sorted.length === 0) {
      return <View style={styles.empty}><Text style={styles.emptyText}>No events recorded</Text></View>
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {sorted.map((evt, idx) => {
          const team = teams.find((t) => t.id === evt.team)
          const quarter = quarterLabel(idx, totalEvents)
          const label = SCORE_LABELS[evt.eventType] ?? evt.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          return (
            <View key={evt.id} style={styles.eventRow}>
              <View style={[styles.colourDot, { backgroundColor: team?.colour ?? '#535353' }]} />
              <View style={styles.eventMain}>
                <Text style={styles.eventLabel}>{label}</Text>
                <Text style={styles.teamName}>{team?.name ?? '—'}</Text>
              </View>
              <Text style={styles.quarterBadge}>{quarter}</Text>
            </View>
          )
        })}
      </ScrollView>
    )
  }

  if (tab === 'Scoring') {
    const teamAId = teamA?.id ?? ''
    const teamBId = teamB?.id ?? ''

    // Points per quarter per team (approximated from event order)
    const qScores: Record<string, { a: number; b: number }> = {}
    for (const q of QUARTERS) qScores[q] = { a: 0, b: 0 }

    const scoringEvents = sorted.filter((e) => SCORING_TYPES.has(e.eventType))
    scoringEvents.forEach((evt, idx) => {
      const quarter = quarterLabel(idx, scoringEvents.length)
      const pts = evt.scoreDelta?.team ?? 0
      if (evt.team === teamAId) qScores[quarter].a += pts
      else if (evt.team === teamBId) qScores[quarter].b += pts
    })

    const totalA = Object.values(qScores).reduce((s, q) => s + q.a, 0)
    const totalB = Object.values(qScores).reduce((s, q) => s + q.b, 0)
    const usedQuarters = QUARTERS.filter((q) => qScores[q].a > 0 || qScores[q].b > 0)

    if (usedQuarters.length === 0) {
      return <View style={styles.empty}><Text style={styles.emptyText}>No scoring plays recorded</Text></View>
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.tableHeader}>
          <Text style={styles.colTeam} />
          {usedQuarters.map((q) => <Text key={q} style={styles.colQ}>{q}</Text>)}
          <Text style={styles.colTotal}>Total</Text>
        </View>
        {[{ team: teamA, scores: usedQuarters.map((q) => qScores[q].a), total: totalA },
          { team: teamB, scores: usedQuarters.map((q) => qScores[q].b), total: totalB }].map(({ team, scores, total }) => (
          <View key={team?.id} style={styles.tableRow}>
            <View style={styles.colTeam}>
              <View style={[styles.colourDot, { backgroundColor: team?.colour ?? '#535353' }]} />
              <Text style={[styles.teamNameSmall, { color: team?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
                {team?.name ?? '—'}
              </Text>
            </View>
            {scores.map((s, i) => (
              <Text key={i} style={styles.colQ}>{s}</Text>
            ))}
            <Text style={[styles.colTotal, styles.totalValue]}>{total}</Text>
          </View>
        ))}
      </ScrollView>
    )
  }

  if (tab === 'Penalties') {
    const penaltyEvents = events.filter((e) => e.eventType === 'penalty')
    if (penaltyEvents.length === 0) {
      return <View style={styles.empty}><Text style={styles.emptyText}>No penalties recorded</Text></View>
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {teams.map((team) => {
          const count = penaltyEvents.filter((e) => e.team === team.id).length
          return (
            <View key={team.id} style={styles.penaltyRow}>
              <View style={[styles.colourDot, { backgroundColor: team.colour }]} />
              <Text style={[styles.penaltyTeam, { color: team.colour }]}>{team.name}</Text>
              <Text style={styles.penaltyCount}>{count}</Text>
              <Text style={styles.penaltyLabel}>Penalties</Text>
            </View>
          )
        })}
      </ScrollView>
    )
  }

  return null
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: '#535353', fontSize: 14 },
  eventRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E1E', borderRadius: 8,
    padding: 12, marginBottom: 6, gap: 10,
  },
  colourDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  eventMain: { flex: 1 },
  eventLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  teamName: { color: '#535353', fontSize: 12 },
  quarterBadge: { color: '#B3B3B3', fontSize: 12, fontWeight: '700', minWidth: 28, textAlign: 'right' },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A', marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E1E', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 10, marginBottom: 4,
  },
  colTeam: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  colQ: { width: 36, color: '#B3B3B3', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  colTotal: { width: 44, color: '#535353', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  totalValue: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  teamNameSmall: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', maxWidth: 80 },
  penaltyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E1E', borderRadius: 8,
    padding: 16, marginBottom: 8, gap: 12,
  },
  penaltyTeam: { flex: 1, fontSize: 14, fontWeight: '700' },
  penaltyCount: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  penaltyLabel: { color: '#535353', fontSize: 13 },
})
