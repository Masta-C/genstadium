/**
 * CricketScoreCard — Batting / Bowling tabs for the Session Ended screen.
 *
 * Batting: R / B / 4s / 6s / SR per batsman + dismissal details.
 * Bowling: O / M / R / W / ECO per bowler.
 * Both teams switchable via team pills inside each tab.
 * Totals row at bottom of each table.
 *
 * Stats derived from session events subcollection:
 *   - Runs / 4s / 6s: from scoring events attributed to each batsman (playerId)
 *   - Balls faced: count of legal deliveries attributed to this batsman (approx)
 *   - Wickets: from wicket event metadata.bowler
 *   - Bowling runs / overs: approximated from scoring events during that bowler's over
 *     (requires currentBowler from cricketState — stored in metadata)
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

interface CricketScoreCardProps {
  tab: string          // 'Batting' | 'Bowling'
  teams: Team[]
  players: Player[]
  events: MatchEvent[]
}

// ─── Batting stats per player ─────────────────────────────────────────────────

interface BatsmanStats {
  playerId: string
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  strikeRate: number
  dismissal: string | null   // e.g. "Caught · b A. Kumar"
  notOut: boolean
}

function buildBattingStats(teamId: string, players: Player[], events: MatchEvent[]): BatsmanStats[] {
  const teamPlayers = players.filter((p) => p.teamId === teamId)
  if (teamPlayers.length === 0) return []

  const statsMap = new Map<string, BatsmanStats>()

  for (const player of teamPlayers) {
    statsMap.set(player.id, {
      playerId: player.id,
      name: player.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      dismissal: null,
      notOut: true,
    })
  }

  // Accumulate runs, 4s, 6s, balls from events attributed to each batsman
  const BALL_EVENTS = new Set(['six', 'four', 'wicket', 'runs_1', 'runs_2', 'runs_3', 'dot_ball'])
  const EXTRA_TYPES = new Set(['wide', 'no_ball'])

  for (const evt of events) {
    if (evt.team !== teamId) continue
    const pid = evt.playerId
    if (!pid || !statsMap.has(pid)) continue

    const stat = statsMap.get(pid)!

    if (evt.eventType === 'four') {
      stat.runs += 4
      stat.fours += 1
      stat.balls += 1
    } else if (evt.eventType === 'six') {
      stat.runs += 6
      stat.sixes += 1
      stat.balls += 1
    } else if (BALL_EVENTS.has(evt.eventType) && !EXTRA_TYPES.has(evt.eventType)) {
      const delta = evt.scoreDelta?.team ?? 0
      stat.runs += delta
      stat.balls += 1
    }

    // Wicket: record dismissal string from metadata
    if (evt.eventType === 'wicket') {
      const meta = evt.metadata ?? {}
      const dtype = meta.dismissalType ?? 'out'
      const bowler = meta.bowler ? `b ${meta.bowler}` : ''
      const dismissalStr = [
        dtype.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        bowler,
      ].filter(Boolean).join(' · ')
      stat.dismissal = dismissalStr
      stat.notOut = false
    }
  }

  // Compute strike rate
  for (const stat of statsMap.values()) {
    stat.strikeRate = stat.balls > 0 ? Math.round((stat.runs / stat.balls) * 100) : 0
  }

  return Array.from(statsMap.values()).sort((a, b) => b.runs - a.runs)
}

// ─── Bowling stats per bowler ─────────────────────────────────────────────────

interface BowlerStats {
  name: string
  wickets: number
  runsConc: number   // runs conceded (approximated)
  overs: number      // whole overs
  balls: number      // extra balls beyond whole overs
  economy: number
}

function buildBowlingStats(bowlingTeamId: string, events: MatchEvent[]): BowlerStats[] {
  const statsMap = new Map<string, BowlerStats>()

  function getOrCreate(name: string): BowlerStats {
    if (!statsMap.has(name)) {
      statsMap.set(name, { name, wickets: 0, runsConc: 0, overs: 0, balls: 0, economy: 0 })
    }
    return statsMap.get(name)!
  }

  const EXTRA_TYPES = new Set(['wide', 'no_ball'])

  for (const evt of events) {
    // Runs conceded: scoring events against the bowling team (i.e. batting team scores)
    if (evt.team !== bowlingTeamId && evt.scoreDelta) {
      // Get current bowler from event metadata if available
      const bowler = evt.metadata?.currentBowler ?? evt.metadata?.bowler
      if (bowler) {
        const stat = getOrCreate(bowler)
        stat.runsConc += evt.scoreDelta.team ?? 0
        if (!EXTRA_TYPES.has(evt.eventType)) {
          stat.balls += 1
        }
      }
    }

    // Wickets: from wicket event metadata.bowler
    if (evt.eventType === 'wicket') {
      const bowler = evt.metadata?.bowler
      if (bowler) {
        const stat = getOrCreate(bowler)
        stat.wickets += 1
      }
    }
  }

  // Convert balls to overs.balls format and compute economy
  for (const stat of statsMap.values()) {
    stat.overs = Math.floor(stat.balls / 6)
    stat.balls = stat.balls % 6
    const totalOvers = stat.overs + stat.balls / 6
    stat.economy = totalOvers > 0 ? Math.round((stat.runsConc / totalOvers) * 10) / 10 : 0
  }

  return Array.from(statsMap.values()).sort((a, b) => b.wickets - a.wickets)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CricketScoreCard({ tab, teams, players, events }: CricketScoreCardProps) {
  const [activeTeamIdx, setActiveTeamIdx] = useState(0)

  const battingTeam = teams[activeTeamIdx] ?? teams[0]
  const bowlingTeam = teams[activeTeamIdx === 0 ? 1 : 0] ?? teams[1]

  if (tab === 'Batting') {
    const stats = buildBattingStats(battingTeam?.id ?? '', players, events)
    const totalRuns = stats.reduce((s, p) => s + p.runs, 0)
    const totalBalls = stats.reduce((s, p) => s + p.balls, 0)

    return (
      <View style={styles.container}>
        <TeamPills teams={teams} activeIdx={activeTeamIdx} onSelect={setActiveTeamIdx} />
        {stats.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No roster — batting data unavailable</Text></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header row */}
            <View style={styles.tableHeader}>
              <Text style={[styles.col, styles.colName]}>Batsman</Text>
              <Text style={styles.colNum}>R</Text>
              <Text style={styles.colNum}>B</Text>
              <Text style={styles.colNum}>4s</Text>
              <Text style={styles.colNum}>6s</Text>
              <Text style={styles.colNum}>SR</Text>
            </View>
            {stats.map((p) => (
              <View key={p.playerId} style={styles.tableRow}>
                <View style={[styles.col, styles.colName]}>
                  <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                  {p.dismissal ? (
                    <Text style={styles.dismissal} numberOfLines={1}>{p.dismissal}</Text>
                  ) : (
                    <Text style={styles.notOut}>not out</Text>
                  )}
                </View>
                <Text style={[styles.colNum, styles.runsValue]}>{p.runs}</Text>
                <Text style={styles.colNum}>{p.balls}</Text>
                <Text style={styles.colNum}>{p.fours}</Text>
                <Text style={styles.colNum}>{p.sixes}</Text>
                <Text style={styles.colNum}>{p.strikeRate}</Text>
              </View>
            ))}
            {/* Totals row */}
            <View style={[styles.tableRow, styles.totalsRow]}>
              <Text style={[styles.col, styles.colName, styles.totalsLabel]}>Total</Text>
              <Text style={[styles.colNum, styles.totalsValue]}>{totalRuns}</Text>
              <Text style={[styles.colNum, styles.totalsValue]}>{totalBalls}</Text>
              <Text style={styles.colNum}>—</Text>
              <Text style={styles.colNum}>—</Text>
              <Text style={styles.colNum}>—</Text>
            </View>
          </ScrollView>
        )}
      </View>
    )
  }

  if (tab === 'Bowling') {
    // Bowling stats for the team that was bowling against the selected batting team
    const stats = buildBowlingStats(bowlingTeam?.id ?? '', events)
    const totalWickets = stats.reduce((s, b) => s + b.wickets, 0)
    const totalRuns = stats.reduce((s, b) => s + b.runsConc, 0)

    return (
      <View style={styles.container}>
        <TeamPills teams={teams} activeIdx={activeTeamIdx} onSelect={setActiveTeamIdx} label="Batting team" />
        {stats.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No bowling data — set bowler during match</Text></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.tableHeader}>
              <Text style={[styles.col, styles.colName]}>Bowler</Text>
              <Text style={styles.colNum}>O</Text>
              <Text style={styles.colNum}>R</Text>
              <Text style={styles.colNum}>W</Text>
              <Text style={styles.colNum}>ECO</Text>
            </View>
            {stats.map((b) => (
              <View key={b.name} style={styles.tableRow}>
                <Text style={[styles.col, styles.colName, styles.playerName]} numberOfLines={1}>{b.name}</Text>
                <Text style={styles.colNum}>{b.overs}.{b.balls}</Text>
                <Text style={styles.colNum}>{b.runsConc}</Text>
                <Text style={[styles.colNum, styles.wicketsValue]}>{b.wickets}</Text>
                <Text style={styles.colNum}>{b.economy}</Text>
              </View>
            ))}
            <View style={[styles.tableRow, styles.totalsRow]}>
              <Text style={[styles.col, styles.colName, styles.totalsLabel]}>Total</Text>
              <Text style={styles.colNum}>—</Text>
              <Text style={[styles.colNum, styles.totalsValue]}>{totalRuns}</Text>
              <Text style={[styles.colNum, styles.totalsValue]}>{totalWickets}</Text>
              <Text style={styles.colNum}>—</Text>
            </View>
          </ScrollView>
        )}
      </View>
    )
  }

  return null
}

// ─── Team pills ───────────────────────────────────────────────────────────────

function TeamPills({
  teams,
  activeIdx,
  onSelect,
  label,
}: {
  teams: Team[]
  activeIdx: number
  onSelect: (idx: number) => void
  label?: string
}) {
  return (
    <View style={styles.teamPills}>
      {label ? <Text style={styles.pillsLabel}>{label}:</Text> : null}
      {teams.map((t, idx) => (
        <TouchableOpacity
          key={t.id}
          style={[styles.pill, activeIdx === idx && { backgroundColor: t.colour + '33', borderColor: t.colour }]}
          onPress={() => onSelect(idx)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, activeIdx === idx && { color: t.colour }]}>{t.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: '#535353', fontSize: 14 },
  teamPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  pillsLabel: { color: '#535353', fontSize: 12 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#1E1E1E',
  },
  pillText: { color: '#535353', fontSize: 13, fontWeight: '700' },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 4,
  },
  totalsRow: {
    backgroundColor: '#2A2A2A',
    marginTop: 4,
  },
  col: { flex: 1 },
  colName: { flex: 2.5 },
  colNum: {
    width: 38,
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissal: {
    color: '#535353',
    fontSize: 11,
    marginTop: 1,
  },
  notOut: {
    color: '#1DB954',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  runsValue: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  wicketsValue: {
    color: '#1DB954',
    fontWeight: '800',
    fontSize: 15,
  },
  totalsLabel: {
    color: '#B3B3B3',
    fontWeight: '700',
  },
  totalsValue: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
})
