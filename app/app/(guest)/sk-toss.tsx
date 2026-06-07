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
import { db } from '../../lib/firebase/client'

interface Team {
  id: string
  name: string
  colour: string
}

export default function SkTossScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()

  const [teams, setTeams] = useState<Team[]>([])
  const [eventType, setEventType] = useState<string>('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) return
    getDoc(doc(db, 'sessions', sessionId))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data()
          setTeams((data.teams as Team[]) ?? [])
          setEventType((data.eventType as string) ?? '')
        }
      })
      .catch(() => setError('Failed to load session data.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const title = eventType === 'cricket' ? 'Who bats first?' : 'Who goes first?'

  async function handleContinue() {
    if (!selected || !sessionId) return
    setSubmitting(true)
    setError('')
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        whoGoesFirst: selected,
      })
      router.push({ pathname: '/(guest)/sk-ready', params: { sessionId } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
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
            style={[styles.progressDot, step === 3 && styles.progressDotActive]}
          />
        ))}
        <Text style={styles.progressLabel}>Step 3 of 4</Text>
      </View>

      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.sub}>This determines which team's panel is highlighted first.</Text>

      {teams.length === 2 ? (
        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={[
              styles.teamCard,
              { borderColor: teams[0].colour },
              selected === teams[0].id && { borderColor: teams[0].colour, ...styles.teamCardSelected },
            ]}
            onPress={() => setSelected(teams[0].id)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === teams[0].id }}
          >
            <View style={[styles.colourDot, { backgroundColor: teams[0].colour }]} />
            <Text style={styles.teamName}>{teams[0].name}</Text>
            {selected === teams[0].id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>

          <Text style={styles.versus}>vs</Text>

          <TouchableOpacity
            style={[
              styles.teamCard,
              { borderColor: teams[1].colour },
              selected === teams[1].id && { borderColor: teams[1].colour, ...styles.teamCardSelected },
            ]}
            onPress={() => setSelected(teams[1].id)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === teams[1].id }}
          >
            <View style={[styles.colourDot, { backgroundColor: teams[1].colour }]} />
            <Text style={styles.teamName}>{teams[1].name}</Text>
            {selected === teams[1].id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.errorText}>Team data not found. Please go back and set up teams.</Text>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[
          styles.continueButton,
          (!selected || submitting) && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={!selected || submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#121212" size="small" />
        ) : (
          <Text style={styles.continueButtonText}>Continue →</Text>
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
  heading: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 6 },
  sub: { color: '#B3B3B3', fontSize: 14, marginBottom: 32, lineHeight: 20 },
  cardsContainer: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  teamCard: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2A2A2A',
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  teamCardSelected: {
    backgroundColor: '#1A2A1A',
  },
  colourDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  teamName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  checkmark: {
    color: '#1DB954',
    fontSize: 22,
    fontWeight: '700',
  },
  versus: {
    color: '#535353',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  errorText: { color: '#FF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  continueButton: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  continueButtonDisabled: { opacity: 0.4 },
  continueButtonText: { color: '#121212', fontSize: 17, fontWeight: '700' },
})
