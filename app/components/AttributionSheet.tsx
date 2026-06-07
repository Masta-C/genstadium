/**
 * AttributionSheet — slides up from bottom after a scoring event.
 *
 * Gives the Score Keeper 8 seconds to tag the player who scored/fouled.
 * Score has already been logged to Firestore — attribution never blocks the game.
 *
 * Key principle (CLAUDE.md): score registers instantly; this is best-effort.
 */

import { doc, updateDoc } from 'firebase/firestore'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../lib/firebase/client'

interface Player {
  id: string
  teamId: string
  jerseyNumber: string
  name: string
  position: string
}

interface AttributionSheetProps {
  sessionId: string
  eventId: string
  teamId: string
  eventLabel: string
  eventEmoji: string
  players: Player[]
  onDismiss: () => void
}

const ATTRIBUTION_TIMEOUT_MS = 8_000

export function AttributionSheet({
  sessionId,
  eventId,
  teamId,
  eventLabel,
  eventEmoji,
  players,
  onDismiss,
}: AttributionSheetProps) {
  const [secondsLeft, setSecondsLeft] = useState(8)
  const progressAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(300)).current
  const dismissedRef = useRef(false)

  const dismiss = useCallback(
    (playerId: string) => {
      if (dismissedRef.current) return
      dismissedRef.current = true

      // Update the event document — fire-and-forget, score already registered
      updateDoc(doc(db, 'sessions', sessionId, 'events', eventId), {
        playerId,
      }).catch(() => {
        // Silent failure — attribution is best-effort
      })

      // Slide down then dismiss
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onDismiss())
    },
    [sessionId, eventId, slideAnim, onDismiss],
  )

  // Slide up on mount
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
  }, [slideAnim])

  // 8-second countdown
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: ATTRIBUTION_TIMEOUT_MS,
      useNativeDriver: false,
    }).start()

    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          return 0
        }
        return s - 1
      })
    }, 1_000)

    const timeout = setTimeout(() => {
      dismiss('unknown')
    }, ATTRIBUTION_TIMEOUT_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [dismiss, progressAnim])

  const teamPlayers = players.filter((p) => p.teamId === teamId)

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Header */}
        <Text style={styles.title}>
          {eventEmoji} {eventLabel} — Who?
        </Text>

        {/* Progress bar + countdown */}
        <View style={styles.timerRow}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            />
          </View>
          <Text style={styles.secondsLabel}>{secondsLeft}s</Text>
        </View>

        {/* Player list */}
        <View style={styles.playerList}>
          {teamPlayers.length === 0 ? (
            <Text style={styles.emptyText}>No players in roster — tap Skip to continue.</Text>
          ) : (
            teamPlayers.map((player) => (
              <TouchableOpacity
                key={player.id}
                style={styles.playerRow}
                onPress={() => dismiss(player.id)}
                activeOpacity={0.7}
              >
                <View style={styles.jerseyBadge}>
                  <Text style={styles.jerseyText}>{player.jerseyNumber}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  {player.position ? (
                    <Text style={styles.playerPosition}>{player.position}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Skip */}
        <TouchableOpacity style={styles.skipButton} onPress={() => dismiss('unknown')} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip — log as Unknown</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#2A2A2A',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  secondsLabel: {
    color: '#535353',
    fontSize: 13,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'right',
  },
  playerList: {
    gap: 4,
    maxHeight: 240,
    marginBottom: 12,
  },
  emptyText: {
    color: '#535353',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    gap: 12,
  },
  jerseyBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  playerInfo: { flex: 1 },
  playerName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  playerPosition: { color: '#535353', fontSize: 12, marginTop: 2 },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipText: {
    color: '#535353',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
})
