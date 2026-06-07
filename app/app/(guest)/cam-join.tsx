import { router, useLocalSearchParams } from 'expo-router'
import { signInAnonymously } from 'firebase/auth'
import React, { useState } from 'react'
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
import { auth } from '../../lib/firebase/client'
import { useSessionStore } from '../../store/sessionStore'

const CLOUD_RUN_URL =
  (process.env.EXPO_PUBLIC_CLOUD_RUN_URL ?? 'http://localhost:8081').replace(/\/$/, '')

interface JoinResponse {
  liveKitToken: string
  sessionId: string
}

async function joinSession(
  joinCode: string,
  displayName: string,
  idToken: string,
): Promise<JoinResponse> {
  const res = await fetch(`${CLOUD_RUN_URL}/session/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ joinCode, role: 'camera', displayName }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? `Server error ${res.status}`)
  }
  return res.json() as Promise<JoinResponse>
}

export default function CamJoinScreen() {
  const { joinCode } = useLocalSearchParams<{ joinCode: string }>()
  const { setSession } = useSessionStore()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    const trimmed = name.trim()
    if (!trimmed || !joinCode) {
      setError(joinCode ? 'Please enter your name.' : 'No join code provided.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { user } = await signInAnonymously(auth)
      const idToken = await user.getIdToken()
      const { liveKitToken, sessionId } = await joinSession(joinCode, trimmed, idToken)
      setSession(sessionId, liveKitToken)
      router.replace({
        pathname: '/(guest)/pick-slot',
        params: { sessionId },
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.title}>Join as Camera</Text>
        <Text style={styles.subtitle}>
          Your phone will stream live video to the Director
        </Text>
      </View>

      <Text style={styles.fieldLabel}>Your name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Jordan"
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

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
          <Text style={styles.joinButtonText}>Join Session</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 24,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: {
    color: '#B3B3B3',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
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
