/**
 * OverCompleteModal — fires after 6 legal deliveries.
 *
 * Shows "✅ Over N complete" + bowler picker from bowling team roster.
 * Selecting a bowler writes the new bowler to cricketState in Firestore.
 */

import React from 'react'
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

interface Player {
  id: string
  teamId: string
  jerseyNumber: string
  name: string
  position: string
}

interface OverCompleteModalProps {
  overNumber: number
  bowlingPlayers: Player[]
  onSelectBowler: (name: string) => void
}

export function OverCompleteModal({
  overNumber,
  bowlingPlayers,
  onSelectBowler,
}: OverCompleteModalProps) {
  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.checkmark}>✅</Text>
          <Text style={styles.title}>Over {overNumber} complete</Text>
          <Text style={styles.sub}>Who bowls the next over?</Text>

          <View style={styles.playerList}>
            {bowlingPlayers.length === 0 ? (
              <TouchableOpacity
                style={styles.playerRow}
                onPress={() => onSelectBowler('Unknown')}
                activeOpacity={0.7}
              >
                <Text style={styles.playerName}>Unknown bowler</Text>
              </TouchableOpacity>
            ) : (
              bowlingPlayers.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.playerRow}
                  onPress={() => onSelectBowler(p.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.jerseyBadge}>
                    <Text style={styles.jerseyText}>{p.jerseyNumber}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{p.name}</Text>
                    {p.position ? (
                      <Text style={styles.playerPosition}>{p.position}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => onSelectBowler('')}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip — select later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  checkmark: { fontSize: 40, marginBottom: 8 },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  sub: {
    color: '#B3B3B3',
    fontSize: 14,
    marginBottom: 20,
  },
  playerList: { width: '100%', gap: 8, marginBottom: 16 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 14,
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
  skipButton: { paddingVertical: 10 },
  skipText: { color: '#535353', fontSize: 13, textDecorationLine: 'underline' },
})
