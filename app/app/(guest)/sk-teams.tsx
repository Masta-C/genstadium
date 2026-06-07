import { router, useLocalSearchParams } from 'expo-router'
import { doc, updateDoc } from 'firebase/firestore'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'

const PALETTE = [
  { label: 'Green',  value: '#1DB954' },
  { label: 'Blue',   value: '#2D86FF' },
  { label: 'Red',    value: '#E91429' },
  { label: 'Orange', value: '#F59B23' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Yellow', value: '#EAB308' },
  { label: 'Teal',   value: '#14B8A6' },
  { label: 'White',  value: '#FFFFFF' },
]

interface TeamDraft {
  name: string
  colour: string
}

function ColourPicker({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (colour: string) => void
}) {
  return (
    <View style={styles.palette}>
      {PALETTE.map((swatch) => (
        <TouchableOpacity
          key={swatch.value}
          style={[
            styles.swatch,
            { backgroundColor: swatch.value },
            selected === swatch.value && styles.swatchSelected,
          ]}
          onPress={() => onSelect(swatch.value)}
          activeOpacity={0.8}
          accessibilityLabel={swatch.label}
        />
      ))}
    </View>
  )
}

function TeamCard({
  label,
  team,
  onChange,
}: {
  label: string
  team: TeamDraft
  onChange: (patch: Partial<TeamDraft>) => void
}) {
  return (
    <View style={[styles.teamCard, { borderLeftColor: team.colour }]}>
      <Text style={styles.teamLabel}>{label}</Text>
      <TextInput
        style={styles.teamNameInput}
        placeholder="Team name"
        placeholderTextColor="#535353"
        value={team.name}
        onChangeText={(name) => onChange({ name })}
        maxLength={30}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <ColourPicker selected={team.colour} onSelect={(colour) => onChange({ colour })} />
    </View>
  )
}

export default function SkTeamsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [teamA, setTeamA] = useState<TeamDraft>({ name: '', colour: '#1DB954' })
  const [teamB, setTeamB] = useState<TeamDraft>({ name: '', colour: '#2D86FF' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = teamA.name.trim().length > 0 && teamB.name.trim().length > 0 && !submitting

  async function handleContinue() {
    if (!canSubmit || !sessionId) return
    setSubmitting(true)
    setError('')
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        teams: [
          { id: 'team-a', name: teamA.name.trim(), colour: teamA.colour },
          { id: 'team-b', name: teamB.name.trim(), colour: teamB.colour },
        ],
      })
      router.push({
        pathname: '/(guest)/sk-roster',
        params: { sessionId },
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save teams. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Progress */}
      <View style={styles.progressRow}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[styles.progressDot, step === 1 && styles.progressDotActive]}
          />
        ))}
        <Text style={styles.progressLabel}>Step 1 of 4</Text>
      </View>

      <Text style={styles.heading}>Team Setup</Text>
      <Text style={styles.sub}>Names and colours appear on the scorebug throughout the match.</Text>

      <TeamCard label="Team A" team={teamA} onChange={(p) => setTeamA((t) => ({ ...t, ...p }))} />
      <TeamCard label="Team B" team={teamB} onChange={(p) => setTeamB((t) => ({ ...t, ...p }))} />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.continueButton, !canSubmit && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={!canSubmit}
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
  sub: { color: '#B3B3B3', fontSize: 14, marginBottom: 24, lineHeight: 20 },
  teamCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  teamLabel: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  teamNameInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 14,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  errorText: { color: '#FF4444', fontSize: 13, marginBottom: 12 },
  continueButton: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  continueButtonDisabled: { opacity: 0.4 },
  continueButtonText: { color: '#121212', fontSize: 17, fontWeight: '700' },
})
