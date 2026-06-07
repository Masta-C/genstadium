import { router, useLocalSearchParams } from 'expo-router'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { auth, db } from '../../lib/firebase/client'

interface Team {
  id: string
  name: string
  colour: string
}

interface SessionSummary {
  eventType: string
  teams: Team[]
  whoGoesFirst: string
}

const SPORT_LABELS: Record<string, string> = {
  football: 'Football',
  cricket: 'Cricket',
  basketball: 'Basketball',
  american_football: 'American Football',
  pickleball: 'Pickleball',
  badminton: 'Badminton',
  custom: 'Custom',
}

export default function SkReadyScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()

  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) return
    getDoc(doc(db, 'sessions', sessionId))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data()
          setSummary({
            eventType: (data.eventType as string) ?? 'custom',
            teams: (data.teams as Team[]) ?? [],
            whoGoesFirst: (data.whoGoesFirst as string) ?? '',
          })
        }
      })
      .catch(() => setError('Failed to load session data.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const whoGoesFirstTeam = summary?.teams.find((t) => t.id === summary.whoGoesFirst)

  async function handleMarkReady() {
    const uid = auth.currentUser?.uid
    if (!sessionId || !uid) return
    setSubmitting(true)
    setError('')
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        [`participants.${uid}.status`]: 'ready',
      })
      // Issue #37 wires the first-session onboarding overlay here before navigation
      router.replace({ pathname: '/(guest)/sk-live', params: { sessionId } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1DB954" size="large" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Progress */}
      <View style={styles.progressRow}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[styles.progressDot, step === 4 && styles.progressDotActive]}
          />
        ))}
        <Text style={styles.progressLabel}>Step 4 of 4</Text>
      </View>

      {/* Header */}
      <Text style={styles.checkIcon}>✓</Text>
      <Text style={styles.heading}>All set!</Text>
      <Text style={styles.sub}>Review your setup before going live.</Text>

      {/* Summary card */}
      {summary ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sport</Text>
            <Text style={styles.summaryValue}>
              {SPORT_LABELS[summary.eventType] ?? summary.eventType}
            </Text>
          </View>

          {summary.teams.map((team) => (
            <View key={team.id} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {team.id === 'team-a' ? 'Team A' : 'Team B'}
              </Text>
              <View style={styles.teamValueRow}>
                <View style={[styles.colourDot, { backgroundColor: team.colour }]} />
                <Text style={styles.summaryValue}>{team.name}</Text>
              </View>
            </View>
          ))}

          {whoGoesFirstTeam ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Goes first</Text>
              <View style={styles.teamValueRow}>
                <View style={[styles.colourDot, { backgroundColor: whoGoesFirstTeam.colour }]} />
                <Text style={styles.summaryValue}>{whoGoesFirstTeam.name}</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.helperText}>
        Director will be notified. You can update teams mid-session if needed.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.readyButton, submitting && styles.readyButtonDisabled]}
        onPress={handleMarkReady}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#121212" size="small" />
        ) : (
          <Text style={styles.readyButtonText}>Mark as Ready</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: '#121212', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#121212' },
  scroll: { padding: 24, paddingBottom: 48 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A2A2A',
  },
  progressDotActive: { backgroundColor: '#1DB954' },
  progressLabel: { color: '#535353', fontSize: 13, marginLeft: 4 },
  checkIcon: {
    fontSize: 48,
    color: '#1DB954',
    textAlign: 'center',
    marginBottom: 8,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    color: '#B3B3B3',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    gap: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#535353',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  teamValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colourDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  helperText: {
    color: '#535353',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 18,
  },
  errorText: { color: '#FF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  readyButton: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  readyButtonDisabled: { opacity: 0.4 },
  readyButtonText: { color: '#121212', fontSize: 17, fontWeight: '800' },
})
