/**
 * PickleballScoreCard — Games / Faults tabs for the Session Ended screen.
 *
 * Games: game-by-game score table (Game 1/2/3) + "Won N–M" match result.
 * Faults: fault count + kitchen fault count per team; side-out count per game.
 */

import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MatchEvent } from './SoccerScoreCard'

interface Team {
  id: string
  name: string
  colour: string
}

interface PickleballScoreCardProps {
  tab: string    // 'Games' | 'Faults'
  teams: Team[]
  events: MatchEvent[]
}

/** Split events into games using period field stored in metadata, or fallback to index split */
function splitIntoGames(events: MatchEvent[], numGames: number = 3): MatchEvent[][] {
  const games: MatchEvent[][] = Array.from({ length: numGames }, () => [])
  for (const evt of events) {
    const period = evt.metadata?.period
    if (period) {
      const match = period.match(/Game (\d)/i)
      if (match) {
        const idx = parseInt(match[1], 10) - 1
        if (idx >= 0 && idx < numGames) {
          games[idx].push(evt)
          continue
        }
      }
    }
    // Fallback: distribute evenly
    const gameIdx = Math.min(Math.floor((events.indexOf(evt) / Math.max(events.length, 1)) * numGames), numGames - 1)
    games[gameIdx].push(evt)
  }
  return games
}

function scoreForTeam(events: MatchEvent[], teamId: string): number {
  return events
    .filter((e) => e.team === teamId && e.scoreDelta)
    .reduce((s, e) => s + (e.scoreDelta?.team ?? 0), 0)
}

export function PickleballScoreCard({ tab, teams, events }: PickleballScoreCardProps) {
  const teamA = teams[0]
  const teamB = teams[1]

  if (tab === 'Games') {
    const games = splitIntoGames(events.filter((e) => e.eventType === 'point_server'), 3)
    const usedGames = games.filter((g) => g.length > 0)

    let aWins = 0
    let bWins = 0
    const gameRows = usedGames.map((g, idx) => {
      const aScore = scoreForTeam(g, teamA?.id ?? '')
      const bScore = scoreForTeam(g, teamB?.id ?? '')
      if (aScore > bScore) aWins++
      else if (bScore > aScore) bWins++
      return { label: `Game ${idx + 1}`, aScore, bScore }
    })

    const matchResult = `${aWins > bWins ? teamA?.name ?? 'Team A' : teamB?.name ?? 'Team B'} won ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}`

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {gameRows.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No games recorded</Text></View>
        ) : (
          <>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colGame} />
              <View style={styles.colTeamHeader}>
                <View style={[styles.dot, { backgroundColor: teamA?.colour ?? '#535353' }]} />
                <Text style={[styles.teamLabel, { color: teamA?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
                  {teamA?.name ?? 'Team A'}
                </Text>
              </View>
              <View style={[styles.colTeamHeader, styles.colTeamHeaderRight]}>
                <Text style={[styles.teamLabel, { color: teamB?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
                  {teamB?.name ?? 'Team B'}
                </Text>
                <View style={[styles.dot, { backgroundColor: teamB?.colour ?? '#535353' }]} />
              </View>
            </View>
            {gameRows.map(({ label, aScore, bScore }) => {
              const aWon = aScore > bScore
              const bWon = bScore > aScore
              return (
                <View key={label} style={styles.tableRow}>
                  <Text style={styles.colGame}>{label}</Text>
                  <Text style={[styles.colScore, aWon && styles.scoreWin]}>{aScore}</Text>
                  <Text style={[styles.colScore, bWon && styles.scoreWin]}>{bScore}</Text>
                </View>
              )
            })}
            {/* Match result */}
            <View style={styles.resultRow}>
              <Text style={styles.resultText}>🏆 {matchResult}</Text>
            </View>
          </>
        )}
      </ScrollView>
    )
  }

  if (tab === 'Faults') {
    const faultTypes = [
      { label: 'Faults', key: 'fault' },
      { label: 'Kitchen Faults', key: 'kitchen_fault' },
      { label: 'Side-Outs', key: 'side_out' },
    ]
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.tableHeader}>
          <Text style={styles.colFaultLabel} />
          <View style={styles.colTeamHeader}>
            <View style={[styles.dot, { backgroundColor: teamA?.colour ?? '#535353' }]} />
            <Text style={[styles.teamLabel, { color: teamA?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
              {teamA?.name ?? 'Team A'}
            </Text>
          </View>
          <View style={[styles.colTeamHeader, styles.colTeamHeaderRight]}>
            <Text style={[styles.teamLabel, { color: teamB?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
              {teamB?.name ?? 'Team B'}
            </Text>
            <View style={[styles.dot, { backgroundColor: teamB?.colour ?? '#535353' }]} />
          </View>
        </View>
        {faultTypes.map(({ label, key }) => {
          const aCount = events.filter((e) => e.team === (teamA?.id ?? '') && e.eventType === key).length
          const bCount = events.filter((e) => e.team === (teamB?.id ?? '') && e.eventType === key).length
          return (
            <View key={key} style={styles.tableRow}>
              <Text style={styles.colFaultLabel}>{label}</Text>
              <Text style={[styles.colScore, aCount > bCount && styles.scoreHighlight]}>{aCount}</Text>
              <Text style={[styles.colScore, bCount > aCount && styles.scoreHighlight]}>{bCount}</Text>
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
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#2A2A2A', marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E1E', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12, marginBottom: 6,
  },
  colGame: { width: 56, color: '#535353', fontSize: 12, fontWeight: '700' },
  colFaultLabel: { flex: 1, color: '#535353', fontSize: 12, fontWeight: '700' },
  colTeamHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  colTeamHeaderRight: { justifyContent: 'flex-end' },
  colScore: { flex: 1, color: '#B3B3B3', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  scoreWin: { color: '#FFFFFF' },
  scoreHighlight: { color: '#FFFFFF' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  teamLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', maxWidth: 80 },
  resultRow: {
    backgroundColor: '#1A1A1A', borderRadius: 10,
    padding: 16, marginTop: 8, alignItems: 'center',
  },
  resultText: { color: '#1DB954', fontSize: 15, fontWeight: '800' },
})
