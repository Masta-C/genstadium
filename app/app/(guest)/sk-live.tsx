import type { SportEvent, SportKey } from '@genstadium/event-config'
import { router, useLocalSearchParams } from 'expo-router'
import * as ScreenOrientation from 'expo-screen-orientation'
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { AttributionSheet } from '../../components/AttributionSheet'
import { CricketPanel } from '../../components/CricketPanel'
import { EventButtons } from '../../components/EventButtons'
import { OnboardingOverlay, shouldShowOnboarding } from '../../components/OnboardingOverlay'
import { auth, db } from '../../lib/firebase/client'

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

interface ScoreState {
  homeScore: number
  awayScore: number
  period: string
}

interface PendingAttribution {
  eventId: string
  teamId: string
  eventLabel: string
  eventEmoji: string
}

const EVENT_EMOJIS: Record<string, string> = {
  goal: '⚽',
  own_goal: '⚽',
  touchdown: '🏈',
  field_goal: '🏈',
  six: '🏏',
  four: '🏏',
  wicket: '🏏',
  points_3: '🏀',
  points_2: '🏀',
  points_1: '🏀',
  foul: '🟨',
  yellow_card: '🟨',
  red_card: '🟥',
  fault: '❌',
}

export default function SkLiveScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()

  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [sportKey, setSportKey] = useState<SportKey>('soccer')
  const [whoGoesFirst, setWhoGoesFirst] = useState('')
  const [scoreState, setScoreState] = useState<ScoreState>({
    homeScore: 0,
    awayScore: 0,
    period: '1st',
  })
  const [lastEventLabel, setLastEventLabel] = useState('No events yet')
  const [pendingAttribution, setPendingAttribution] = useState<PendingAttribution | null>(null)
  const [lastEventId, setLastEventId] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const scoreFlashScale = useRef(new Animated.Value(1)).current
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
    return () => {
      ScreenOrientation.unlockAsync()
    }
  }, [])

  // Show onboarding overlay first time Score Keeper reaches the live screen
  useEffect(() => {
    shouldShowOnboarding().then((show) => {
      if (show) setShowOnboarding(true)
    })
  }, [])

  useEffect(() => {
    if (!sessionId) return

    getDoc(doc(db, 'sessions', sessionId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setTeams((data.teams as Team[]) ?? [])
        setPlayers((data.players as Player[]) ?? [])
        setSportKey((data.eventType as SportKey) ?? 'soccer')
        setWhoGoesFirst((data.whoGoesFirst as string) ?? '')
      }
    })

    const scoreRef = doc(db, 'sessions', sessionId, 'scoreState', 'current')
    unsubRef.current = onSnapshot(scoreRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setScoreState({
          homeScore: (data.homeScore as number) ?? 0,
          awayScore: (data.awayScore as number) ?? 0,
          period: (data.period as string) ?? '1st',
        })
      }
    })

    return () => {
      unsubRef.current?.()
    }
  }, [sessionId])

  const teamA = teams[0]
  const teamB = teams[1]

  /**
   * Writes a score event to sessions/{sessionId}/events/{eventId}.
   * Event registers instantly — playerId starts null, filled by attribution sheet within 8s.
   * Score flash animation wired in #36.
   */
  const handleEventTap = useCallback(
    (event: SportEvent, teamId: string) => {
      const uid = auth.currentUser?.uid
      if (!sessionId || !uid) return

      // Fire-and-forget write — score must register instantly on broadcast
      addDoc(collection(db, 'sessions', sessionId, 'events'), {
        eventType: event.id,
        team: teamId,
        playerId: null,
        scoreDelta: event.scoreDelta,
        metadata: {},
        timestamp: serverTimestamp(),
        loggedBy: uid,
      }).then((docRef) => {
        setLastEventId(docRef.id)
        // Open attribution sheet after write — only if event expects playerId
        if (event.metadata.includes('playerId')) {
          setPendingAttribution({
            eventId: docRef.id,
            teamId,
            eventLabel: event.label,
            eventEmoji: EVENT_EMOJIS[event.id] ?? '📌',
          })
        }
      }).catch(() => {
        // Silent failure — event may retry or SK can undo (#35)
      })

      setLastEventLabel(event.label)
    },
    [sessionId],
  )

  /**
   * Soft-delete the last event (deleted: true).
   * scoreStateAggregator already skips deleted events — score corrects silently.
   * Score Keeper only — Director cannot modify events.
   */
  /**
   * Score flash: scale 1 → 1.3 → 1 in ~300ms spring.
   * Fires on scoring taps only (scoreDelta != null). Does not block next tap.
   */
  const handleScoringTap = useCallback(() => {
    scoreFlashScale.setValue(1)
    Animated.sequence([
      Animated.spring(scoreFlashScale, {
        toValue: 1.3,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.spring(scoreFlashScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
    ]).start()
  }, [scoreFlashScale])

  const handleUndo = useCallback(() => {
    if (!sessionId || !lastEventId) return
    updateDoc(doc(db, 'sessions', sessionId, 'events', lastEventId), {
      deleted: true,
    }).then(() => {
      setLastEventId(null)
      setLastEventLabel('Undo applied')
    }).catch(() => {
      // Silent failure
    })
  }, [sessionId, lastEventId])

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
          <Text style={styles.periodLabel}>{scoreState.period}</Text>
        </View>

        <View style={styles.scoreDisplay}>
          {teamA ? (
            <Text style={[styles.teamScoreLabel, { color: teamA.colour }]} numberOfLines={1}>
              {teamA.name}
            </Text>
          ) : null}
          <Animated.Text style={[styles.score, { transform: [{ scale: scoreFlashScale }] }]}>
            {scoreState.homeScore} – {scoreState.awayScore}
          </Animated.Text>
          {teamB ? (
            <Text style={[styles.teamScoreLabel, { color: teamB.colour }]} numberOfLines={1}>
              {teamB.name}
            </Text>
          ) : null}
        </View>

        <View style={styles.topBarRight} />
      </View>

      {/* Main panels — cricket uses single full-width panel */}
      <View style={styles.panels}>
        {sportKey === 'cricket' && sessionId ? (
          <CricketPanel
            sessionId={sessionId}
            teams={teams}
            players={players}
            whoGoesFirst={whoGoesFirst}
            onEventTap={handleEventTap}
            onScoringTap={handleScoringTap}
            scoreFlashScale={scoreFlashScale}
            homeScore={scoreState.homeScore}
            awayScore={scoreState.awayScore}
          />
        ) : (
          <>
            {/* Team A panel */}
            <View style={[styles.panel, teamA && { borderTopColor: teamA.colour }]}>
              <Text style={[styles.panelHeading, teamA && { color: teamA.colour }]}>
                {teamA?.name ?? 'Team A'}
              </Text>
              <EventButtons
                sportKey={sportKey}
                teamId={teamA?.id ?? 'team-a'}
                onEventTap={handleEventTap}
                onScoringTap={handleScoringTap}
              />
            </View>

            <View style={styles.divider} />

            {/* Team B panel */}
            <View style={[styles.panel, teamB && { borderTopColor: teamB.colour }]}>
              <Text style={[styles.panelHeading, teamB && { color: teamB.colour }]}>
                {teamB?.name ?? 'Team B'}
              </Text>
              <EventButtons
                sportKey={sportKey}
                teamId={teamB?.id ?? 'team-b'}
                onEventTap={handleEventTap}
                onScoringTap={handleScoringTap}
              />
            </View>
          </>
        )}
      </View>

      {/* Undo bar */}
      <View style={styles.undoBar}>
        <TouchableOpacity style={[styles.undoButton, !lastEventId && styles.undoButtonDisabled]} onPress={handleUndo} disabled={!lastEventId} activeOpacity={0.7}>
          <Text style={styles.undoButtonText}>↩ Undo</Text>
        </TouchableOpacity>

        <Text style={styles.lastEventLabel} numberOfLines={1}>
          {lastEventLabel}
        </Text>

        <TouchableOpacity
          style={styles.logButton}
          onPress={() => router.push({ pathname: '/(guest)/sk-log', params: { sessionId } })}
          activeOpacity={0.7}
        >
          <Text style={styles.logButtonText}>📋 Log</Text>
        </TouchableOpacity>
      </View>

      {/* First-session onboarding overlay — dismissed state persisted to AsyncStorage */}
      {showOnboarding ? (
        <OnboardingOverlay onDismiss={() => setShowOnboarding(false)} />
      ) : null}

      {/* Attribution sheet — overlays the screen, never blocks score */}
      {pendingAttribution && sessionId ? (
        <AttributionSheet
          sessionId={sessionId}
          eventId={pendingAttribution.eventId}
          teamId={pendingAttribution.teamId}
          eventLabel={pendingAttribution.eventLabel}
          eventEmoji={pendingAttribution.eventEmoji}
          players={players}
          onDismiss={() => setPendingAttribution(null)}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    flexDirection: 'column',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  topBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveBadge: {
    backgroundColor: '#E91429',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  periodLabel: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
  },
  scoreDisplay: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  teamScoreLabel: {
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 80,
  },
  score: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  topBarRight: { flex: 1 },
  panels: {
    flex: 1,
    flexDirection: 'row',
  },
  panel: {
    flex: 1,
    padding: 12,
    borderTopWidth: 3,
    borderTopColor: '#2A2A2A',
  },
  panelHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    color: '#535353',
  },
  divider: {
    width: 1,
    backgroundColor: '#2A2A2A',
  },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  undoButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  undoButtonDisabled: { opacity: 0.4 },
  undoButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  lastEventLabel: {
    flex: 1,
    color: '#535353',
    fontSize: 12,
    textAlign: 'center',
  },
  logButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logButtonText: { color: '#FFFFFF', fontSize: 14 },
})
