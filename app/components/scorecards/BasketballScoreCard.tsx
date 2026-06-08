/**
 * BasketballScoreCard — Scorers / Fouls tabs for the Session Ended screen.
 *
 * Scorers: player name + jersey# + PTS + fouls, sorted by PTS desc. Team totals row.
 * Both teams switchable via team pills.
 * Empty state when no roster was entered.
 */

import React, { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { MatchEvent } from './SoccerScoreCard'

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

interface BasketballScoreCardProps {
  tab: string     // 'Scorers' | 'Fouls'
  teams: Team[]
  players: Player[]
  events: MatchEvent[]
}

interface PlayerStats {
  playerId: string
  name: string
  jerseyNumber: string
  points: number
  fouls: number
}

function buildPlayerStats(teamId: string, players: Player[], events: MatchEvent[]): PlayerStats[] {
  const teamPlayers = players.filter((p) => p.teamId === teamId)

  // Build map from player id → stats
  const statsMap = new Map<string, PlayerStats>()
  for (const p of teamPlayers) {
    statsMap.set(p.id, { playerId: p.id, name: p.name, jerseyNumber: p.jerseyNumber, points: 0, fouls: 0 })
  }

  for (const evt of events) {
    if (evt.team !== teamId) continue
    const pid = evt.playerId
    if (!pid) continue

    // Get or create (handles players who scored but weren't on roster)
    if (!statsMap.has(pid)) {
      statsMap.set(pid, { playerId: pid, name: pid, jerseyNumber: '—', points: 0, fouls: 0 })
    }

    const stat = statsMap.get(pid)!
    if (evt.eventType === 'points_3') stat.points += 3
    else if (evt.eventType === 'points_2') stat.points += 2
    else if (evt.eventType === 'points_1') stat.points += 1
    else if (evt.eventType === 'foul') stat.fouls += 1
  }

  return Array.from(statsMap.values()).sort((a, b) => b.points - a.points)
}

export function BasketballScoreCard({ teams, players, events }: BasketballScoreCardProps) {
  const [activeTeamIdx, setActiveTeamIdx] = useState(0)
  const team = teams[activeTeamIdx] ?? teams[0]

  const stats = buildPlayerStats(team?.id ?? '', players, events)
  const hasRoster = players.some((p) => p.teamId === team?.id)
  const totalPts = stats.reduce((s, p) => s + p.points, 0)
  const totalFouls = stats.reduce((s, p) => s + p.fouls, 0)

  return (
    <View style={styles.container}>
      {/* Team pills */}
      <View style={styles.teamPills}>
        {teams.map((t, idx) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.pill, activeTeamIdx === idx && { backgroundColor: t.colour + '33', borderColor: t.colour }]}
            onPress={() => setActiveTeamIdx(idx)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, activeTeamIdx === idx && { color: t.colour }]}>{t.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!hasRoster && stats.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No stats — roster not set up</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colJersey}>#</Text>
            <Text style={[styles.col, styles.colName]}>Player</Text>
            <Text style={styles.colNum}>PTS</Text>
            <Text style={styles.colNum}>Fouls</Text>
          </View>

          {stats.map((p) => (
            <View key={p.playerId} style={styles.tableRow}>
              <Text style={styles.colJersey}>{p.jerseyNumber}</Text>
              <Text style={[styles.col, styles.colName, styles.playerName]} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={[styles.colNum, p.points > 0 && styles.ptsValue]}>{p.points}</Text>
              <Text style={[styles.colNum, p.fouls >= 5 && styles.foulOut]}>{p.fouls}</Text>
            </View>
          ))}

          {/* Totals */}
          <View style={[styles.tableRow, styles.totalsRow]}>
            <Text style={styles.colJersey} />
            <Text style={[styles.col, styles.colName, styles.totalsLabel]}>Total</Text>
            <Text style={[styles.colNum, styles.totalsValue]}>{totalPts}</Text>
            <Text style={[styles.colNum, styles.totalsValue]}>{totalFouls}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: '#535353', fontSize: 14 },
  teamPills: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1,
    borderColor: '#2A2A2A', backgroundColor: '#1E1E1E',
  },
  pillText: { color: '#535353', fontSize: 13, fontWeight: '700' },
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
  totalsRow: { backgroundColor: '#2A2A2A', marginTop: 4 },
  colJersey: { width: 30, color: '#535353', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  col: { flex: 1 },
  colName: { flex: 2 },
  colNum: { width: 48, color: '#B3B3B3', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  playerName: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  ptsValue: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  foulOut: { color: '#E91429' },
  totalsLabel: { color: '#B3B3B3', fontWeight: '700' },
  totalsValue: { color: '#FFFFFF', fontWeight: '800' },
})
