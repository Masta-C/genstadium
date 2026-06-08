/**
 * BadmintonScoreCard — Games / Faults tabs for the Session Ended screen.
 *
 * Games: game-by-game scores + interval point (score at 11) + "Won N–M" result.
 * Faults: general / net / service fault counts per team.
 */

import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MatchEvent } from './SoccerScoreCard'

interface Team {
  id: string
  name: string
  colour: string
}

interface BadmintonScoreCardProps {
  tab: string    // 'Games' | 'Faults'
  teams: Team[]
  events: MatchEvent[]
}

function splitIntoGames(events: MatchEvent[], numGames: number = 3): MatchEvent[][] {
  const games: MatchEvent[][] = Array.from({ length: numGames }, () => [])
  for (const evt of events) {
    const period = evt.metadata?.period
    if (period) {
      const match = period.match(/Game (\d)/i)
      if (match) {
        const idx = parseInt(match[1], 10) - 1
        if (idx >= 0 && idx < numGames) { games[idx].push(evt); continue }
      }
    }
    const gameIdx = Math.min(
      Math.floor((events.indexOf(evt) / Math.max(events.length, 1)) * numGames),
      numGames - 1,
    )
    games[gameIdx].push(evt)
  }
  return games
}

function pointsForTeam(events: MatchEvent[], teamId: string): number {
  return events.filter((e) => e.team === teamId && e.eventType === 'point' && e.scoreDelta).length
}

/** The score at which a team reached 11 (the interval), derived from event count */
function intervalScore(events: MatchEvent[], teamId: string): number {
  let pts = 0
  for (const evt of events) {
    if (evt.team === teamId && evt.eventType === 'point') pts++
    if (pts >= 11) return 11
  }
  return pts
}

export function BadmintonScoreCard({ tab, teams, events }: BadmintonScoreCardProps) {
  const teamA = teams[0]
  const teamB = teams[1]

  if (tab === 'Games') {
    const games = splitIntoGames(events.filter((e) => e.eventType === 'point'), 3)
    const usedGames = games.filter((g) => g.length > 0)

    let aWins = 0
    let bWins = 0
    const gameRows = usedGames.map((g, idx) => {
      const aScore = pointsForTeam(g, teamA?.id ?? '')
      const bScore = pointsForTeam(g, teamB?.id ?? '')
      const aInterval = intervalScore(g, teamA?.id ?? '')
      const bInterval = intervalScore(g, teamB?.id ?? '')
      if (aScore > bScore) aWins++
      else if (bScore > aScore) bWins++
      return { label: `Game ${idx + 1}`, aScore, bScore, aInterval, bInterval }
    })

    const winner = aWins > bWins ? (teamA?.name ?? 'Team A') : (teamB?.name ?? 'Team B')
    const matchResult = `${winner} won ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}`

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {gameRows.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No games recorded</Text></View>
        ) : (
          <>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.colGame} />
              <View style={styles.colTeamBlock}>
                <View style={[styles.dot, { backgroundColor: teamA?.colour ?? '#535353' }]} />
                <Text style={[styles.teamLabel, { color: teamA?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
                  {teamA?.name ?? 'A'}
                </Text>
              </View>
              <View style={[styles.colTeamBlock, styles.colRight]}>
                <Text style={[styles.teamLabel, { color: teamB?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
                  {teamB?.name ?? 'B'}
                </Text>
                <View style={[styles.dot, { backgroundColor: teamB?.colour ?? '#535353' }]} />
              </View>
            </View>

            {gameRows.map(({ label, aScore, bScore, aInterval, bInterval }) => {
              const aWon = aScore > bScore
              const bWon = bScore > aScore
              return (
                <View key={label} style={styles.gameBlock}>
                  <View style={styles.tableRow}>
                    <Text style={styles.colGame}>{label}</Text>
                    <Text style={[styles.colScore, aWon && styles.scoreWin]}>{aScore}</Text>
                    <Text style={[styles.colScore, bWon && styles.scoreWin]}>{bScore}</Text>
                  </View>
                  {/* Interval point (score at 11) */}
                  {(aInterval > 0 || bInterval > 0) ? (
                    <View style={styles.intervalRow}>
                      <Text style={styles.intervalLabel}>At interval (11):</Text>
                      <Text style={styles.intervalScore}>{aInterval} – {bInterval}</Text>
                    </View>
                  ) : null}
                </View>
              )
            })}

            <View style={styles.resultRow}>
              <Text style={styles.resultText}>🏸 {matchResult}</Text>
            </View>
          </>
        )}
      </ScrollView>
    )
  }

  if (tab === 'Faults') {
    const faultTypes = [
      { label: 'Faults', key: 'fault' },
      { label: 'Net Faults', key: 'net_fault' },
      { label: 'Service Faults', key: 'service_fault' },
      { label: 'Lets', key: 'let' },
    ]
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.tableHeader}>
          <Text style={styles.colFaultLabel} />
          <View style={styles.colTeamBlock}>
            <View style={[styles.dot, { backgroundColor: teamA?.colour ?? '#535353' }]} />
            <Text style={[styles.teamLabel, { color: teamA?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
              {teamA?.name ?? 'Team A'}
            </Text>
          </View>
          <View style={[styles.colTeamBlock, styles.colRight]}>
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
  gameBlock: { marginBottom: 4 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E1E', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  intervalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 4,
    backgroundColor: '#161616', borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    marginBottom: 6,
  },
  intervalLabel: { color: '#535353', fontSize: 11 },
  intervalScore: { color: '#B3B3B3', fontSize: 12, fontWeight: '600' },
  colGame: { width: 56, color: '#535353', fontSize: 12, fontWeight: '700' },
  colFaultLabel: { flex: 1, color: '#535353', fontSize: 12, fontWeight: '700' },
  colTeamBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  colRight: { justifyContent: 'flex-end' },
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
