import { useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import React, { useState } from 'react'
import {
  Alert,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'

const JOIN_BASE_URL = 'https://genstadium.com/join'

function buildJoinUrl(joinCode: string): string {
  return `${JOIN_BASE_URL}/${joinCode}`
}

function buildDeepLink(joinCode: string): string {
  return `genstadium://join/${joinCode}`
}

interface JoiningChip {
  icon: string
  label: string
}

export default function ShareSessionScreen() {
  const { joinCode, sessionName } = useLocalSearchParams<{
    joinCode: string
    sessionName: string
  }>()
  const [copied, setCopied] = useState(false)

  const code = joinCode ?? 'REDS01'
  const name = sessionName ?? 'Session'
  const joinUrl = buildJoinUrl(code)
  const deepLink = buildDeepLink(code)

  const chips: JoiningChip[] = [
    { icon: '📷', label: 'Camera' },
    { icon: '📊', label: 'Score Keeper' },
  ]

  async function handleCopyLink() {
    await Clipboard.setStringAsync(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Join ${name} on GenStadium → ${joinUrl}`,
        url: joinUrl,
        title: `Join ${name}`,
      })
    } catch {
      Alert.alert('Share failed', 'Could not open share sheet.')
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Share with your crew</Text>
      <Text style={styles.subheading}>{name}</Text>

      <View style={styles.qrContainer}>
        <QRCode value={deepLink} size={200} backgroundColor="#121212" color="#FFFFFF" />
      </View>

      <Text style={styles.joinCodeLabel}>Join code</Text>
      <Text style={styles.joinCode}>{code}</Text>

      <View style={styles.chipsRow}>
        {chips.map((chip) => (
          <View key={chip.label} style={styles.chip}>
            <Text style={styles.chipText}>
              {chip.icon} {chip.label}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleShare} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Share via…</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, copied && styles.secondaryButtonCopied]}
        onPress={handleCopyLink}
        activeOpacity={0.8}
      >
        <Text style={styles.secondaryButtonText}>{copied ? '✓ Copied!' : 'Copy Link'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    padding: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 16,
    color: '#B3B3B3',
    marginBottom: 32,
  },
  qrContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  joinCodeLabel: {
    fontSize: 13,
    color: '#B3B3B3',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  joinCode: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 8,
    marginBottom: 24,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  chip: {
    backgroundColor: '#2A2A2A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#1DB954',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#121212',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonCopied: {
    backgroundColor: '#158A3E',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
