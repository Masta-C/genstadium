import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

type SessionStatus = 'lobby' | 'live' | 'ended'

interface SessionPreview {
  sessionName: string
  sport: string
  sportIcon: string
  status: SessionStatus
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready'; session: SessionPreview }
  | { phase: 'error'; message: string }

function statusLabel(status: SessionStatus): string {
  switch (status) {
    case 'lobby':
      return 'In Lobby'
    case 'live':
      return 'LIVE'
    case 'ended':
      return 'Ended'
  }
}

function statusColor(status: SessionStatus): string {
  switch (status) {
    case 'live':
      return '#1DB954'
    case 'lobby':
      return '#F59B23'
    case 'ended':
      return '#535353'
  }
}

async function fetchSessionPreview(joinCode: string): Promise<SessionPreview> {
  // Firestore lookup wired in issue #4 (emulator config) — mock for now
  if (joinCode === 'TEST01') {
    return {
      sessionName: 'Test Match',
      sport: 'Soccer',
      sportIcon: '⚽',
      status: 'lobby',
    }
  }
  throw new Error('Session not found')
}

export default function GuestLandingScreen() {
  const { joinCode } = useLocalSearchParams<{ joinCode: string }>()
  const [loadState, setLoadState] = useState<LoadState>({ phase: 'loading' })

  useEffect(() => {
    if (!joinCode) {
      setLoadState({ phase: 'error', message: 'No join code provided.' })
      return
    }
    let cancelled = false
    fetchSessionPreview(joinCode)
      .then((session) => {
        if (!cancelled) {
          if (session.status === 'ended') {
            setLoadState({ phase: 'error', message: 'This session has ended.' })
          } else {
            setLoadState({ phase: 'ready', session })
          }
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadState({ phase: 'error', message: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [joinCode])

  if (loadState.phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1DB954" size="large" />
        <Text style={styles.loadingText}>Finding session…</Text>
      </View>
    )
  }

  if (loadState.phase === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorHeading}>Can't join this session</Text>
        <Text style={styles.errorBody}>{loadState.message}</Text>
      </View>
    )
  }

  const { session } = loadState

  return (
    <View style={styles.container}>
      <View style={styles.sessionCard}>
        <Text style={styles.sportIcon}>{session.sportIcon}</Text>
        <Text style={styles.sessionName}>{session.sessionName}</Text>
        <Text style={styles.sportLabel}>{session.sport}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(session.status) + '33' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(session.status) }]} />
          <Text style={[styles.statusText, { color: statusColor(session.status) }]}>
            {statusLabel(session.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.guestNotice}>No account needed — joining as guest for this session</Text>

      <Text style={styles.roleHeading}>Choose your role</Text>

      <TouchableOpacity
        style={styles.roleCard}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/(guest)/cam-join', params: { joinCode } })}
      >
        <Text style={styles.roleIcon}>📷</Text>
        <View style={styles.roleTextBlock}>
          <Text style={styles.roleTitle}>Camera Operator</Text>
          <Text style={styles.roleDesc}>Stream your phone camera as a live feed</Text>
        </View>
        <Text style={styles.roleChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.roleCard}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/(guest)/sk-join', params: { joinCode } })}
      >
        <Text style={styles.roleIcon}>📊</Text>
        <View style={styles.roleTextBlock}>
          <Text style={styles.roleTitle}>Score Keeper</Text>
          <Text style={styles.roleDesc}>Log events and keep the scorebug up to date</Text>
        </View>
        <Text style={styles.roleChevron}>›</Text>
      </TouchableOpacity>
    </View>
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
  loadingText: {
    color: '#B3B3B3',
    fontSize: 15,
  },
  errorIcon: {
    fontSize: 40,
  },
  errorHeading: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  errorBody: {
    color: '#B3B3B3',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  sessionCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  sportIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  sessionName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  sportLabel: {
    color: '#B3B3B3',
    fontSize: 15,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  guestNotice: {
    color: '#535353',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  roleHeading: {
    color: '#B3B3B3',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  roleCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  roleIcon: {
    fontSize: 28,
  },
  roleTextBlock: {
    flex: 1,
  },
  roleTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  roleDesc: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  roleChevron: {
    color: '#535353',
    fontSize: 22,
  },
})
