/**
 * sk-ended.tsx — Score Keeper session ended screen.
 *
 * Triggered when session.status transitions to 'ended' via onSnapshot in sk-live.
 * Shows final score, sport meta, tabbed scorecard scaffold, Share Recap, and Done.
 *
 * Scorecard tab content is intentionally left as placeholder rows here.
 * Sport-specific content is wired in subsequent issues:
 *   #40 Soccer · #41 Cricket · #42 Basketball · #43 Am. Football
 *   #44 Pickleball · #45 Badminton · #46 Share Recap
 */

import type { SportKey } from '@genstadium/event-config'
import { eventConfig } from '@genstadium/event-config'
import { router, useLocalSearchParams } from 'expo-router'
import { collection, doc, getDocs, onSnapshot } from 'firebase/firestore'
import React, { useEffect, useRef, useState } from 'react'
import {
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'

interface Team {
  id: string
  name: string
  colour: string
}

interface ScoreState {
  homeScore: number
  awayScore: number
  period: string
}

interface SessionEvent {
  id: string
  eventType: string
  team: string
  playerId: string | null
  scoreDelta: { team: number } | null
  timestamp: { seconds: number } | null
}

/** Tab labels per sport — content filled in by issues #40–#45 */
const SPORT_TABS: Record<SportKey, string[]> = {
  soccer: ['Goals', 'Cards', 'Stats'],
  cricket: ['Batting', 'Bowling'],
  basketball: ['Scorers', 'Fouls'],
  american_football: ['Events', 'Scoring'],
  pickleball: ['Games', 'Faults'],
  badminton: ['Games', 'Faults'],
  custom: ['Events'],
}

export default function SkEndedScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()

  const [teams, setTeams] = useState<Team[]>([])
  const [sportKey, setSportKey] = useState<SportKey>('soccer')
  const [scoreState, setScoreState] = useState<ScoreState>({ homeScore: 0, awayScore: 0, period: '' })
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!sessionId) return

    // One-time session read for static fields
    const sessionRef = doc(db, 'sessions', sessionId)
    const unsub = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setTeams((data.teams as Team[]) ?? [])
        setSportKey((data.eventType as SportKey) ?? 'soccer')
      }
    })
    unsubRef.current = unsub

    // Subscribe to scoreState
    const scoreRef = doc(db, 'sessions', sessionId, 'scoreState', 'current')
    const unsubScore = onSnapshot(scoreRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setScoreState({
          homeScore: (data.homeScore as number) ?? 0,
          awayScore: (data.awayScore as number) ?? 0,
          period: (data.period as string) ?? '',
        })
      }
    })

    // Load events once for attribution stats
    getDocs(collection(db, 'sessions', sessionId, 'events')).then((qs) => {
      const evts = qs.docs
        .filter((d) => !d.data().deleted)
        .map((d) => ({ id: d.id, ...d.data() } as SessionEvent))
      setEvents(evts)
    }).catch(() => {/* silent */})

    return () => {
      unsub()
      unsubScore()
    }
  }, [sessionId])

  const teamA = teams[0]
  const teamB = teams[1]
  const sport = eventConfig[sportKey]
  const tabs = SPORT_TABS[sportKey] ?? ['Events']

  /** Events where playerId was never filled in — logged as "Unknown" */
  const unattributedCount = events.filter(
    (e) => e.playerId === null || e.playerId === 'Unknown',
  ).length

  /** Sport meta line: icon + display name + period label */
  const sportMeta = `${sport.icon} ${sport.displayName}${scoreState.period ? ` · ${scoreState.period}` : ''}`

  async function handleShareRecap() {
    const teamALine = teamA ? `${teamA.name}: ${scoreState.homeScore}` : `Team A: ${scoreState.homeScore}`
    const teamBLine = teamB ? `${teamB.name}: ${scoreState.awayScore}` : `Team B: ${scoreState.awayScore}`
    const message = [
      `📊 Match Recap — ${sport.displayName}`,
      '',
      teamALine,
      teamBLine,
      '',
      scoreState.period ? `Final: ${scoreState.period}` : 'Final',
      '',
      'Powered by GenStadium 📹',
    ].join('\n')

    try {
      await Share.share({ message })
    } catch {
      // User cancelled share sheet — silent
    }
  }

  return (
    <View style={styles.container}>
      {/* Final score header */}
      <View style={styles.scoreHeader}>
        <Text style={styles.sportMeta}>{sportMeta}</Text>

        <View style={styles.scoreRow}>
          <View style={styles.teamBlock}>
            {teamA ? (
              <View style={[styles.teamColourDot, { backgroundColor: teamA.colour }]} />
            ) : null}
            <Text style={[styles.teamName, teamA && { color: teamA.colour }]} numberOfLines={1}>
              {teamA?.name ?? 'Team A'}
            </Text>
            <Text style={styles.scoreValue}>{scoreState.homeScore}</Text>
          </View>

          <Text style={styles.scoreDash}>–</Text>

          <View style={[styles.teamBlock, styles.teamBlockRight]}>
            <Text style={styles.scoreValue}>{scoreState.awayScore}</Text>
            <Text style={[styles.teamName, teamB && { color: teamB.colour }]} numberOfLines={1}>
              {teamB?.name ?? 'Team B'}
            </Text>
            {teamB ? (
              <View style={[styles.teamColourDot, { backgroundColor: teamB.colour }]} />
            ) : null}
          </View>
        </View>

        <Text style={styles.finalLabel}>FINAL</Text>

        {/* Unknown attribution warning */}
        {unattributedCount > 0 ? (
          <View style={styles.unknownBadge}>
            <Text style={styles.unknownBadgeText}>
              {unattributedCount} unattributed event{unattributedCount !== 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((label, idx) => (
          <TouchableOpacity
            key={label}
            style={[styles.tab, activeTab === idx && styles.tabActive]}
            onPress={() => setActiveTab(idx)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === idx && styles.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content — sport-specific scorecards wired in #40–#45 */}
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
        <ScoreCardPlaceholder
          tab={tabs[activeTab] ?? ''}
          sportKey={sportKey}
          teams={teams}
          events={events}
        />
      </ScrollView>

      {/* Bottom CTAs */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShareRecap} activeOpacity={0.8}>
          <Text style={styles.shareButtonText}>📤 Share Recap</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.replace('/(director)/home')}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

/** Placeholder scorecard — replaced by sport-specific components in #40–#45 */
function ScoreCardPlaceholder({
  tab,
  sportKey,
  teams,
  events,
}: {
  tab: string
  sportKey: SportKey
  teams: Team[]
  events: SessionEvent[]
}) {
  // Filter scoring events for a minimal summary
  const scoringEvents = events.filter((e) => e.scoreDelta !== null && !('deleted' in e))

  if (scoringEvents.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No {tab.toLowerCase()} data recorded</Text>
      </View>
    )
  }

  return (
    <View>
      {scoringEvents.map((evt) => {
        const team = teams.find((t) => t.id === evt.team)
        const isUnknown = evt.playerId === null || evt.playerId === 'Unknown'
        return (
          <View key={evt.id} style={styles.eventRow}>
            <View style={[styles.eventTeamDot, { backgroundColor: team?.colour ?? '#535353' }]} />
            <Text style={styles.eventType}>{evt.eventType.replace(/_/g, ' ')}</Text>
            {isUnknown ? (
              <View style={styles.unknownPill}>
                <Text style={styles.unknownPillText}>Unknown</Text>
              </View>
            ) : (
              <Text style={styles.eventPlayer} numberOfLines={1}>
                {evt.playerId}
              </Text>
            )}
          </View>
        )
      })}
      <Text style={styles.placeholderNote}>
        ℹ️ Detailed {sportKey} scorecard coming soon
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  // Score header
  scoreHeader: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  sportMeta: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    justifyContent: 'center',
  },
  teamBlock: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  teamBlockRight: {
    alignItems: 'flex-end',
  },
  teamColourDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth: 120,
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 54,
  },
  scoreDash: {
    color: '#535353',
    fontSize: 32,
    fontWeight: '300',
  },
  finalLabel: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 12,
  },
  unknownBadge: {
    marginTop: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  unknownBadgeText: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '600',
  },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1DB954',
  },
  tabLabel: {
    color: '#535353',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  // Tab content
  tabContent: {
    flex: 1,
  },
  tabContentInner: {
    padding: 16,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyStateText: {
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
  eventTeamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventType: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  unknownPill: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  unknownPillText: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '700',
  },
  eventPlayer: {
    color: '#B3B3B3',
    fontSize: 13,
    maxWidth: 100,
  },
  placeholderNote: {
    color: '#535353',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    paddingBottom: 8,
  },
  // Footer CTAs
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  doneButton: {
    flex: 1,
    backgroundColor: '#1DB954',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
})
