import { router, useLocalSearchParams } from 'expo-router'
import { signInAnonymously } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { auth, db } from '../../lib/firebase/client'

interface SessionInfo {
  sessionId: string
  sessionName: string
  eventType: string
  teams: { name: string }[]
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready'; session: SessionInfo }
  | { phase: 'error'; message: string }

async function fetchSessionByJoinCode(joinCode: string): Promise<SessionInfo> {
  const q = query(
    collection(db, 'sessions'),
    where('joinCode', '==', joinCode),
    where('status', 'in', ['lobby', 'live']),
  )
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('Session not found or already ended.')
  const docSnap = snap.docs[0]
  const data = docSnap.data()
  return {
    sessionId: docSnap.id,
    sessionName: (data.sessionName as string | undefined) ?? 'Untitled Session',
    eventType: (data.eventType as string | undefined) ?? 'custom',
    teams: (data.teams as { name: string }[] | undefined) ?? [],
  }
}

export default function SkJoinScreen() {
  const { joinCode } = useLocalSearchParams<{ joinCode: string }>()
  const [loadState, setLoadState] = useState<LoadState>({ phase: 'loading' })
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!joinCode) {
      setLoadState({ phase: 'error', message: 'No join code provided.' })
      return
    }
    let cancelled = false
    fetchSessionByJoinCode(joinCode)
      .then((session) => {
        if (!cancelled) setLoadState({ phase: 'ready', session })
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadState({ phase: 'error', message: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [joinCode])

  async function handleJoin() {
    if (loadState.phase !== 'ready') return
    const trimmed = name.trim()
    if (!trimmed) {
      setSubmitError('Please enter your name.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const { user } = await signInAnonymously(auth)
      await setDoc(
        doc(db, 'sessions', loadState.session.sessionId, 'participants', user.uid),
        {
          role: 'scorekeeper',
          name: trimmed,
          status: 'setting_up',
          joinedAt: serverTimestamp(),
        },
      )
      router.replace({
        pathname: '/(guest)/team-setup',
        params: { sessionId: loadState.session.sessionId },
      })
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to join. Please try again.',
      )
      setSubmitting(false)
    }
  }

  if (loadState.phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1DB954" size="large" />
        <Text style={styles.loadingText}>Loading session…</Text>
      </View>
    )
  }

  if (loadState.phase === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorHeading}>Can't join</Text>
        <Text style={styles.errorBody}>{loadState.message}</Text>
      </View>
    )
  }

  const { session } = loadState
  const teamsNamed = session.teams.filter((t) => t.name)
  const sportLabel =
    session.eventType.charAt(0).toUpperCase() + session.eventType.slice(1)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.sessionCard}>
        <Text style={styles.sport}>{sportLabel}</Text>
        <Text style={styles.sessionName}>{session.sessionName}</Text>
        {teamsNamed.length > 0 && (
          <Text style={styles.teams}>{teamsNamed.map((t) => t.name).join(' vs ')}</Text>
        )}
      </View>

      <Text style={styles.roleLabel}>📊  Joining as Score Keeper</Text>

      <Text style={styles.fieldLabel}>Your name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Alex"
        placeholderTextColor="#535353"
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleJoin}
        maxLength={40}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      <TouchableOpacity
        style={[
          styles.joinButton,
          (!name.trim() || submitting) && styles.joinButtonDisabled,
        ]}
        onPress={handleJoin}
        disabled={!name.trim() || submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#121212" size="small" />
        ) : (
          <Text style={styles.joinButtonText}>Join as Score Keeper</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.anonNotice}>
        Guest session — no account needed. Session ends when you close the app.
      </Text>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 24,
  },
  center: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { color: '#B3B3B3', fontSize: 15 },
  errorIcon: { fontSize: 40 },
  errorHeading: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  errorBody: {
    color: '#B3B3B3',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  sessionCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  sport: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  sessionName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  teams: { color: '#B3B3B3', fontSize: 14 },
  roleLabel: {
    color: '#1DB954',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  fieldLabel: { color: '#B3B3B3', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 16,
    fontSize: 17,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  errorText: { color: '#FF4444', fontSize: 13, marginBottom: 8 },
  joinButton: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  joinButtonDisabled: { opacity: 0.4 },
  joinButtonText: { color: '#121212', fontSize: 17, fontWeight: '700' },
  anonNotice: {
    color: '#535353',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
})
