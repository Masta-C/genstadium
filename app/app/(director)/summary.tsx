/**
 * summary.tsx — Director session summary screen.
 *
 * Shown when session.status = 'ended'. Reads final score, session duration,
 * replay clip count, YouTube archive status, and events logged count.
 * Firestore data is fetched once (getDocs) — session is over, no live updates needed.
 */

import { router, useLocalSearchParams } from 'expo-router'
import { collection, doc, getDocs, getDoc } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
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

interface SessionSummaryData {
  sessionName: string
  teams: Team[]
  startedAtSeconds: number | null
  endedAtSeconds: number | null
  youtubeEnabled: boolean
  eventType: string
}

interface ScoreState {
  homeScore: number
  awayScore: number
  period: string
}

export default function DirectorSummaryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SessionSummaryData | null>(null)
  const [scoreState, setScoreState] = useState<ScoreState>({ homeScore: 0, awayScore: 0, period: '' })
  const [replayClipCount, setReplayClipCount] = useState(0)
  const [eventCount, setEventCount] = useState(0)

  useEffect(() => {
    if (!sessionId) return

    async function load() {
      try {
        const [sessionSnap, scoreSnap, replaySnap, eventsSnap] = await Promise.all([
          getDoc(doc(db, 'sessions', sessionId as string)),
          getDoc(doc(db, 'sessions', sessionId as string, 'scoreState', 'current')),
          getDocs(collection(db, 'sessions', sessionId as string, 'replayClips')),
          getDocs(collection(db, 'sessions', sessionId as string, 'events')),
        ])

        if (sessionSnap.exists()) {
          const data = sessionSnap.data()
          const startedAt = data.startedAt as { seconds: number } | null | undefined
          const endedAt = data.endedAt as { seconds: number } | null | undefined
          setSummary({
            sessionName: (data.sessionName as string) ?? '',
            teams: (data.teams as Team[]) ?? [],
            startedAtSeconds: startedAt?.seconds ?? null,
            endedAtSeconds: endedAt?.seconds ?? null,
            youtubeEnabled: Boolean(data.youtubeStreamKey),
            eventType: (data.eventType as string) ?? 'custom',
          })
        }

        if (scoreSnap.exists()) {
          const d = scoreSnap.data()
          setScoreState({
            homeScore: (d.homeScore as number) ?? 0,
            awayScore: (d.awayScore as number) ?? 0,
            period: (d.period as string) ?? '',
          })
        }

        setReplayClipCount(replaySnap.size)
        setEventCount(eventsSnap.docs.filter((d) => !d.data().deleted).length)
      } finally {
        setLoading(false)
      }
    }

    load().catch(() => setLoading(false))
  }, [sessionId])

  async function handleShareRecap() {
    if (!summary) return
    const teamA = summary.teams[0]
    const teamB = summary.teams[1]
    const teamALine = teamA ? `${teamA.name}: ${scoreState.homeScore}` : `Team A: ${scoreState.homeScore}`
    const teamBLine = teamB ? `${teamB.name}: ${scoreState.awayScore}` : `Team B: ${scoreState.awayScore}`
    const dateStr = new Date().toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
    const durationLabel = summary.startedAtSeconds && summary.endedAtSeconds
      ? formatDuration(summary.endedAtSeconds - summary.startedAtSeconds)
      : null

    const lines = [
      `📹 ${summary.sessionName || 'Match Recap'} — GenStadium`,
      `📅 ${dateStr}`,
      '',
      teamALine,
      teamBLine,
      '',
      scoreState.period ? `⏱ Final: ${scoreState.period}` : '⏱ Final',
    ]
    if (durationLabel) lines.push(`⏳ Duration: ${durationLabel}`)
    if (replayClipCount > 0) lines.push(`🎬 Replays shown: ${replayClipCount}`)
    lines.push(`📊 Events logged: ${eventCount}`)
    lines.push('', 'Powered by GenStadium 📹')

    try {
      await Share.share({ message: lines.join('\n') })
    } catch {
      // User cancelled share sheet — silent
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#1DB954" size="large" />
      </View>
    )
  }

  const teamA = summary?.teams[0]
  const teamB = summary?.teams[1]
  const durationSeconds =
    summary?.startedAtSeconds && summary?.endedAtSeconds
      ? summary.endedAtSeconds - summary.startedAtSeconds
      : null

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Final score header */}
        <View style={styles.scoreHeader}>
          <Text style={styles.finalBadge}>FINAL</Text>

          <View style={styles.scoreRow}>
            <View style={styles.teamBlock}>
              {teamA ? (
                <View style={[styles.teamColourDot, { backgroundColor: teamA.colour }]} />
              ) : null}
              <Text
                style={[styles.teamName, teamA && { color: teamA.colour }]}
                numberOfLines={1}
              >
                {teamA?.name ?? 'Team A'}
              </Text>
              <Text style={styles.scoreValue}>{scoreState.homeScore}</Text>
            </View>

            <Text style={styles.scoreDash}>–</Text>

            <View style={[styles.teamBlock, styles.teamBlockRight]}>
              <Text style={styles.scoreValue}>{scoreState.awayScore}</Text>
              <Text
                style={[styles.teamName, teamB && { color: teamB.colour }]}
                numberOfLines={1}
              >
                {teamB?.name ?? 'Team B'}
              </Text>
              {teamB ? (
                <View style={[styles.teamColourDot, { backgroundColor: teamB.colour }]} />
              ) : null}
            </View>
          </View>

          {scoreState.period ? (
            <Text style={styles.periodLabel}>{scoreState.period}</Text>
          ) : null}

          {summary?.sessionName ? (
            <Text style={styles.sessionName}>{summary.sessionName}</Text>
          ) : null}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Duration"
            value={durationSeconds !== null ? formatDuration(durationSeconds) : '—'}
            icon="⏱"
          />
          <StatCard
            label="Events logged"
            value={String(eventCount)}
            icon="📊"
          />
          <StatCard
            label="Replays broadcast"
            value={String(replayClipCount)}
            icon="🎬"
          />
          <StatCard
            label="YouTube"
            value={summary?.youtubeEnabled ? 'Enabled' : 'Not used'}
            icon="▶️"
            highlight={summary?.youtubeEnabled}
          />
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareRecap}
          activeOpacity={0.8}
        >
          <Text style={styles.shareButtonText}>⬆ Share Recap</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={() => router.replace('/(director)/home')}
          activeOpacity={0.8}
        >
          <Text style={styles.dashboardButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

// ── Sub-component ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string
  value: string
  icon: string
  highlight?: boolean
}) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: { paddingBottom: 24 },

  // Score header
  scoreHeader: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  finalBadge: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 20,
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
  teamBlockRight: { alignItems: 'flex-end' },
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
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 58,
  },
  scoreDash: {
    color: '#535353',
    fontSize: 32,
    fontWeight: '300',
  },
  periodLabel: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    letterSpacing: 0.3,
  },
  sessionName: {
    color: '#535353',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },

  // Stats grid — 2×2
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statCardHighlight: {
    borderColor: '#1DB954',
    backgroundColor: '#0D2B14',
  },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Footer CTAs
  footer: {
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  shareButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#404040',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dashboardButton: {
    backgroundColor: '#1DB954',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  dashboardButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
})
