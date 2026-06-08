/**
 * SoccerScoreCard — Goals / Cards / Team Stats tabs for the Session Ended screen.
 *
 * Receives all session events and the two teams. Renders the correct tab content
 * based on the active tab label passed from sk-ended's tab bar.
 */

import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

interface Team {
  id: string
  name: string
  colour: string
}

export interface MatchEvent {
  id: string
  eventType: string
  team: string
  playerId: string | null
  scoreDelta: { team: number } | null
  metadata: Record<string, string>
  timestamp: { seconds: number } | null
}

interface SoccerScoreCardProps {
  tab: string
  teams: Team[]
  events: MatchEvent[]
  /** Unix seconds when the match went live — used to compute minute labels */
  startedAtSeconds: number | null
}

/** Grey pill for unattributed events */
function UnknownBadge() {
  return (
    <View style={styles.unknownPill}>
      <Text style={styles.unknownPillText}>Unknown</Text>
    </View>
  )
}

/** Compute a minute string from event timestamp and match start */
function minuteLabel(eventSeconds: number | null, startedAtSeconds: number | null, index: number): string {
  if (eventSeconds !== null && startedAtSeconds !== null) {
    const mins = Math.max(1, Math.round((eventSeconds - startedAtSeconds) / 60))
    return `${mins}'`
  }
  return `#${index + 1}`
}

export function SoccerScoreCard({ tab, teams, events, startedAtSeconds }: SoccerScoreCardProps) {
  if (tab === 'Goals') return <GoalsTab teams={teams} events={events} startedAtSeconds={startedAtSeconds} />
  if (tab === 'Cards') return <CardsTab teams={teams} events={events} startedAtSeconds={startedAtSeconds} />
  if (tab === 'Stats') return <StatsTab teams={teams} events={events} />
  return null
}

// ─── Goals Tab ───────────────────────────────────────────────────────────────

function GoalsTab({ teams, events, startedAtSeconds }: Omit<SoccerScoreCardProps, 'tab'>) {
  const goalEvents = events
    .filter((e) => e.eventType === 'goal' || e.eventType === 'own_goal')
    .sort((a, b) => (a.timestamp?.seconds ?? 0) - (b.timestamp?.seconds ?? 0))

  const teamA = teams[0]
  const teamB = teams[1]

  if (goalEvents.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No goals recorded</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.tab} showsVerticalScrollIndicator={false}>
      {goalEvents.map((evt, idx) => {
        const team = teams.find((t) => t.id === evt.team)
        const isOwnGoal = evt.eventType === 'own_goal'
        const isUnknown = !evt.playerId || evt.playerId === 'Unknown'
        const min = minuteLabel(evt.timestamp?.seconds ?? null, startedAtSeconds, idx)

        // Own goals count for the opposing team — show OG badge
        const scoringTeam = isOwnGoal
          ? (team?.id === teamA?.id ? teamB : teamA)
          : team

        return (
          <View key={evt.id} style={styles.eventRow}>
            <View style={[styles.colourDot, { backgroundColor: scoringTeam?.colour ?? '#535353' }]} />
            <View style={styles.eventMain}>
              {isUnknown ? <UnknownBadge /> : (
                <Text style={styles.playerName}>{evt.playerId}</Text>
              )}
              {isOwnGoal ? <Text style={styles.ownGoalTag}>OG</Text> : null}
              <Text style={styles.teamLabel} numberOfLines={1}>
                {scoringTeam?.name ?? '—'}
              </Text>
            </View>
            <Text style={styles.minuteLabel}>{min}</Text>
          </View>
        )
      })}
    </ScrollView>
  )
}

// ─── Cards Tab ────────────────────────────────────────────────────────────────

function CardsTab({ teams, events, startedAtSeconds }: Omit<SoccerScoreCardProps, 'tab'>) {
  const cardEvents = events
    .filter((e) => e.eventType === 'yellow_card' || e.eventType === 'red_card')
    .sort((a, b) => (a.timestamp?.seconds ?? 0) - (b.timestamp?.seconds ?? 0))

  if (cardEvents.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No cards issued</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.tab} showsVerticalScrollIndicator={false}>
      {teams.map((team) => {
        const teamCards = cardEvents.filter((e) => e.team === team.id)
        if (teamCards.length === 0) return null
        return (
          <View key={team.id} style={styles.teamSection}>
            <View style={styles.teamSectionHeader}>
              <View style={[styles.colourDot, { backgroundColor: team.colour }]} />
              <Text style={[styles.teamSectionName, { color: team.colour }]}>{team.name}</Text>
            </View>
            {teamCards.map((evt, idx) => {
              const isRed = evt.eventType === 'red_card'
              const isUnknown = !evt.playerId || evt.playerId === 'Unknown'
              const min = minuteLabel(evt.timestamp?.seconds ?? null, startedAtSeconds, idx)
              return (
                <View key={evt.id} style={styles.cardRow}>
                  <Text style={styles.cardEmoji}>{isRed ? '🟥' : '🟨'}</Text>
                  <View style={styles.eventMain}>
                    {isUnknown ? <UnknownBadge /> : (
                      <Text style={styles.playerName}>{evt.playerId}</Text>
                    )}
                    <Text style={styles.cardTypeLabel}>
                      {isRed ? 'Red card' : 'Yellow card'}
                    </Text>
                  </View>
                  <Text style={styles.minuteLabel}>{min}</Text>
                </View>
              )
            })}
          </View>
        )
      })}
    </ScrollView>
  )
}

// ─── Team Stats Tab ───────────────────────────────────────────────────────────

function StatsTab({ teams, events }: Pick<SoccerScoreCardProps, 'teams' | 'events'>) {
  function countForTeam(teamId: string, eventType: string): number {
    return events.filter((e) => e.team === teamId && e.eventType === eventType).length
  }

  const stats: { label: string; key: string }[] = [
    { label: 'Fouls', key: 'penalty' },
    { label: 'Yellow Cards', key: 'yellow_card' },
    { label: 'Red Cards', key: 'red_card' },
    { label: 'Corners', key: 'corner' },
    { label: 'Offsides', key: 'offside' },
    { label: 'Substitutions', key: 'substitution' },
  ]

  const teamA = teams[0]
  const teamB = teams[1]

  return (
    <ScrollView style={styles.tab} showsVerticalScrollIndicator={false}>
      {/* Header row */}
      <View style={styles.statsHeaderRow}>
        <View style={styles.statsTeamCell}>
          <View style={[styles.colourDot, { backgroundColor: teamA?.colour ?? '#535353' }]} />
          <Text style={[styles.statsTeamName, { color: teamA?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
            {teamA?.name ?? 'Team A'}
          </Text>
        </View>
        <View style={styles.statsLabelCell} />
        <View style={[styles.statsTeamCell, styles.statsTeamCellRight]}>
          <Text style={[styles.statsTeamName, { color: teamB?.colour ?? '#B3B3B3' }]} numberOfLines={1}>
            {teamB?.name ?? 'Team B'}
          </Text>
          <View style={[styles.colourDot, { backgroundColor: teamB?.colour ?? '#535353' }]} />
        </View>
      </View>

      {/* Stat rows */}
      {stats.map(({ label, key }) => {
        const aVal = countForTeam(teamA?.id ?? '', key)
        const bVal = countForTeam(teamB?.id ?? '', key)
        return (
          <View key={key} style={styles.statRow}>
            <Text style={[styles.statValue, aVal > bVal && styles.statValueWin]}>{aVal}</Text>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, bVal > aVal && styles.statValueWin]}>{bVal}</Text>
          </View>
        )
      })}
    </ScrollView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tab: { flex: 1 },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: '#535353',
    fontSize: 14,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  colourDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  eventMain: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  teamLabel: {
    color: '#535353',
    fontSize: 12,
  },
  cardTypeLabel: {
    color: '#535353',
    fontSize: 12,
  },
  cardEmoji: {
    fontSize: 18,
  },
  ownGoalTag: {
    color: '#F59B23',
    fontSize: 11,
    fontWeight: '700',
  },
  minuteLabel: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },
  unknownPill: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  unknownPillText: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '700',
  },
  teamSection: {
    marginBottom: 16,
  },
  teamSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  teamSectionName: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Stats tab
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  statsTeamCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsTeamCellRight: {
    justifyContent: 'flex-end',
  },
  statsTeamName: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    maxWidth: 90,
  },
  statsLabelCell: {
    flex: 1.2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  statValue: {
    flex: 1,
    color: '#B3B3B3',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  statValueWin: {
    color: '#FFFFFF',
  },
  statLabel: {
    flex: 1.5,
    color: '#535353',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
})
