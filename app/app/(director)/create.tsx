import { router } from 'expo-router'
import { eventConfig } from '@genstadium/event-config'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'
import { useAuthStore } from '../../store/authStore'

type SportKey = keyof typeof eventConfig

// Exclude 'custom' from the picker — Directors choose a real sport or use custom via a future flow
const SPORT_KEYS = Object.keys(eventConfig).filter((k) => k !== 'custom') as SportKey[]

const JOINCODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateJoinCode(): string {
  return Array.from(
    { length: 6 },
    () => JOINCODE_CHARS[Math.floor(Math.random() * JOINCODE_CHARS.length)],
  ).join('')
}

async function generateUniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateJoinCode()
    const q = query(
      collection(db, 'sessions'),
      where('joinCode', '==', code),
      where('status', 'in', ['lobby', 'live']),
    )
    const snap = await getDocs(q)
    if (snap.empty) return code
  }
  throw new Error('Failed to generate a unique join code. Please try again.')
}

async function createSession(
  sessionName: string,
  eventType: SportKey,
  uid: string,
): Promise<string> {
  const joinCode = await generateUniqueJoinCode()
  const sessionRef = doc(collection(db, 'sessions'))
  const sessionId = sessionRef.id

  await setDoc(sessionRef, {
    id: sessionId,
    joinCode,
    sessionName,
    status: 'lobby',
    eventType,
    createdBy: uid,
    teams: [],
    participants: {},
    directorState: {
      activeSource: null,
      scorebugVisible: true,
    },
    createdAt: serverTimestamp(),
  })

  return sessionId
}

export default function CreateSessionScreen() {
  const { user } = useAuthStore()
  const [sessionName, setSessionName] = useState('')
  const [selectedSport, setSelectedSport] = useState<SportKey | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = sessionName.trim().length > 0 && selectedSport !== null && !submitting

  async function handleCreate() {
    if (!canSubmit || !user) return
    setSubmitting(true)
    setError('')
    try {
      const sessionId = await createSession(sessionName.trim(), selectedSport!, user.uid)
      router.replace({
        pathname: '/(director)/cameras',
        params: { sessionId },
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>New Session</Text>

        {/* Session name */}
        <Text style={styles.label}>Session name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Finals Day 2026"
          placeholderTextColor="#535353"
          value={sessionName}
          onChangeText={setSessionName}
          maxLength={60}
          autoFocus
          returnKeyType="done"
          autoCapitalize="words"
          autoCorrect={false}
        />

        {/* Sport picker */}
        <Text style={styles.label}>Sport</Text>
        <View style={styles.sportGrid}>
          {SPORT_KEYS.map((key) => {
            const sport = eventConfig[key]
            const selected = selectedSport === key
            return (
              <TouchableOpacity
                key={key}
                style={[styles.sportCard, selected && styles.sportCardSelected]}
                onPress={() => setSelectedSport(key)}
                activeOpacity={0.7}
              >
                <Text style={styles.sportIcon}>{sport.icon}</Text>
                <Text style={[styles.sportName, selected && styles.sportNameSelected]}>
                  {sport.displayName}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.createButton, !canSubmit && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#121212" size="small" />
          ) : (
            <Text style={styles.createButtonText}>Create Session →</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  scroll: { padding: 24, paddingBottom: 48 },
  heading: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 28,
  },
  label: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 16,
    fontSize: 17,
    color: '#FFFFFF',
    marginBottom: 28,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  sportCard: {
    width: '30%',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sportCardSelected: {
    borderColor: '#1DB954',
    backgroundColor: '#1DB95414',
  },
  sportIcon: { fontSize: 28, marginBottom: 6 },
  sportName: { color: '#B3B3B3', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  sportNameSelected: { color: '#1DB954' },
  errorText: { color: '#FF4444', fontSize: 13, marginBottom: 12 },
  createButton: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
  },
  createButtonDisabled: { opacity: 0.4 },
  createButtonText: { color: '#121212', fontSize: 17, fontWeight: '700' },
})
