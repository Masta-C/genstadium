/**
 * youtube.tsx — Director Livestream Setup screen.
 *
 * Director connects their YouTube channel via Google OAuth (YouTube scope) to
 * get a stream key, or skips to record-only mode.
 *
 * On connect: stores stream key in sessions/{sessionId}/private/youtubeStreamKey
 *             (Director-only Firestore rules).
 * On skip:    sets sessions/{sessionId}.livestreamEnabled = false.
 *
 * After either action the Director proceeds to the Go Live screen.
 */

import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { router, useLocalSearchParams } from 'expo-router'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
]

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
}

interface YouTubeChannelInfo {
  channelName: string
  streamKey: string
}

async function fetchYouTubeInfo(accessToken: string): Promise<YouTubeChannelInfo> {
  const [channelRes, streamRes] = await Promise.all([
    fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch('https://www.googleapis.com/youtube/v3/liveStreams?part=cdn&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ])

  if (!channelRes.ok || !streamRes.ok) {
    throw new Error('Failed to fetch YouTube channel info. Check YouTube Data API is enabled.')
  }

  const channelData = (await channelRes.json()) as { items?: { snippet?: { title?: string } }[] }
  const streamData = (await streamRes.json()) as {
    items?: { cdn?: { ingestionInfo?: { streamName?: string } } }[]
  }

  const channelName = channelData.items?.[0]?.snippet?.title ?? 'Unknown Channel'
  const streamKey = streamData.items?.[0]?.cdn?.ingestionInfo?.streamName ?? ''

  if (!streamKey) {
    throw new Error('No live stream found. Enable live streaming in YouTube Studio first.')
  }

  return { channelName, streamKey }
}

export default function YouTubeSetupScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [connecting, setConnecting] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState<{ channelName: string } | null>(null)

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'genstadium' })

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: YOUTUBE_SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
    },
    GOOGLE_DISCOVERY,
  )

  async function handleConnect() {
    if (!request || !sessionId) return
    setConnecting(true)
    setError('')
    try {
      const result = await promptAsync()
      if (result.type !== 'success' || !result.params.access_token) {
        if (result.type !== 'cancel' && result.type !== 'dismiss') {
          setError('YouTube authorization failed. Please try again.')
        }
        return
      }

      const { channelName, streamKey } = await fetchYouTubeInfo(result.params.access_token)

      // Store stream key in private sub-document (Director-only Firestore rules)
      await setDoc(doc(db, 'sessions', sessionId, 'private', 'youtubeStreamKey'), {
        key: streamKey,
        channelName,
        connectedAt: new Date().toISOString(),
      })

      setConnected({ channelName })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed. Please try again.')
    } finally {
      setConnecting(false)
    }
  }

  async function handleSkip() {
    if (!sessionId) return
    setSkipping(true)
    setError('')
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { livestreamEnabled: false })
      router.push({ pathname: '/(director)/golive', params: { sessionId } })
    } catch {
      setError('Failed to save. Please try again.')
      setSkipping(false)
    }
  }

  async function handleContinue() {
    if (!sessionId) return
    router.push({ pathname: '/(director)/golive', params: { sessionId } })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Livestream Setup</Text>
        <Text style={styles.subtitle}>Connect YouTube to stream live. Optional.</Text>
      </View>

      <View style={styles.body}>
        {connected ? (
          <View style={styles.connectedCard}>
            <Text style={styles.connectedIcon}>📺</Text>
            <Text style={styles.connectedChannel}>{connected.channelName}</Text>
            <Text style={styles.connectedLabel}>Stream key saved</Text>
          </View>
        ) : (
          <View style={styles.connectCard}>
            <Text style={styles.connectIcon}>📺</Text>
            <Text style={styles.connectHeading}>Connect YouTube</Text>
            <Text style={styles.connectBody}>
              Authorize GenStadium to read your YouTube live stream key. Your stream key is stored
              privately and never shown again.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={styles.footer}>
        {connected ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Continue →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, (!request || connecting) && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={!request || connecting}
            activeOpacity={0.85}
          >
            {connecting ? (
              <ActivityIndicator color="#121212" />
            ) : (
              <Text style={styles.primaryButtonText}>Connect YouTube</Text>
            )}
          </TouchableOpacity>
        )}

        {!connected && (
          <TouchableOpacity
            style={[styles.skipButton, skipping && styles.buttonDisabled]}
            onPress={handleSkip}
            disabled={skipping}
            activeOpacity={0.75}
          >
            {skipping ? (
              <ActivityIndicator color="#535353" size="small" />
            ) : (
              <Text style={styles.skipText}>Skip — record only</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: '#B3B3B3', fontSize: 15 },

  body: { flex: 1, padding: 24, justifyContent: 'center' },

  connectCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  connectIcon: { fontSize: 48, marginBottom: 16 },
  connectHeading: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 10 },
  connectBody: { color: '#B3B3B3', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  connectedCard: {
    backgroundColor: '#0D2B14',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1DB95440',
  },
  connectedIcon: { fontSize: 48, marginBottom: 12 },
  connectedChannel: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  connectedLabel: { color: '#1DB954', fontSize: 13 },

  errorText: { color: '#FF4444', fontSize: 13, textAlign: 'center', marginTop: 16 },

  footer: {
    padding: 24,
    paddingBottom: 40,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  primaryButton: {
    backgroundColor: '#FF0000',
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  skipButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { color: '#535353', fontSize: 15 },
  buttonDisabled: { opacity: 0.4 },
})
