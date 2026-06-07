/**
 * OnboardingOverlay — one-time T1/T2/T3 guide overlay.
 *
 * Appears over the live scoring screen the first time the Score Keeper reaches it.
 * Dismissed state is persisted to AsyncStorage — never shown again on this device.
 *
 * Wired from sk-ready.tsx before navigating to sk-live (issue #26 placeholder).
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { useCallback, useEffect, useRef } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

const STORAGE_KEY = '@genstadium/onboarding_sk_shown'

const TIERS = [
  {
    tier: 'T1',
    colour: '#1DB954',
    bg: '#0D2B14',
    border: '#1DB954',
    title: 'Big scoring buttons',
    description: 'Goals, points, runs. These change the score instantly.',
  },
  {
    tier: 'T2',
    colour: '#F59B23',
    bg: '#2A2214',
    border: '#F59B23',
    title: 'Discipline events',
    description: 'Cards, fouls, wickets. Fires broadcast animation.',
  },
  {
    tier: 'T3',
    colour: '#535353',
    bg: '#1E1E1E',
    border: '#2A2A2A',
    title: 'Stats only (small)',
    description: 'Corners, subs, extras. Hold any to see full name.',
  },
]

interface OnboardingOverlayProps {
  onDismiss: () => void
}

export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start()
  }, [fadeAnim])

  const handleDismiss = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {/* silent */})
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onDismiss())
  }, [fadeAnim, onDismiss])

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.card}>
        <Text style={styles.heading}>Welcome to live scoring 🏟️</Text>
        <Text style={styles.sub}>Three types of buttons, each with a different job.</Text>

        <View style={styles.tiers}>
          {TIERS.map((t) => (
            <View key={t.tier} style={[styles.tierRow, { backgroundColor: t.bg, borderColor: t.border }]}>
              <View style={[styles.tierBadge, { borderColor: t.border }]}>
                <Text style={[styles.tierBadgeText, { color: t.colour }]}>{t.tier}</Text>
              </View>
              <View style={styles.tierText}>
                <Text style={[styles.tierTitle, { color: t.colour }]}>{t.title}</Text>
                <Text style={styles.tierDesc}>{t.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.tipRow}>
          <Text style={styles.tip}>💡 Hold any small button for 0.3s to see its full name.</Text>
        </View>

        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss} activeOpacity={0.8}>
          <Text style={styles.dismissText}>Got it →</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

/**
 * Returns whether the onboarding overlay should be shown on this device.
 * Reads from AsyncStorage — returns true if not yet shown.
 */
export async function shouldShowOnboarding(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY)
    return val === null
  } catch {
    return false
  }
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 480,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  sub: {
    color: '#B3B3B3',
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  tiers: { gap: 10, marginBottom: 16 },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  tierBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tierBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  tierText: { flex: 1 },
  tierTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  tierDesc: { color: '#B3B3B3', fontSize: 12, lineHeight: 18 },
  tipRow: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  tip: { color: '#535353', fontSize: 13, lineHeight: 18 },
  dismissButton: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  dismissText: { color: '#121212', fontSize: 17, fontWeight: '800' },
})
