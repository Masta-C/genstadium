import { router, useLocalSearchParams } from 'expo-router'
import { doc, onSnapshot } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { db } from '../../lib/firebase/client'

interface ScoreState {
  homeScore: number
  awayScore: number
}

interface Team {
  id: string
  name: string
  colour: string
}

export default function CamEndedScreen() {
  const { sessionId, sessionName } = useLocalSearchParams<{
    sessionId: string
    sessionName: string
  }>()

  const [teams, setTeams] = useState<Team[]>([])
  const [scoreState, setScoreState] = useState<ScoreState>({ homeScore: 0, awayScore: 0 })

  useEffect(() => {
    if (!sessionId) return

    const sessionRef = doc(db, 'sessions', sessionId)
    const unsubSession = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      setTeams((data.teams as Team[]) ?? [])
    })

    const scoreRef = doc(db, 'sessions', sessionId, 'scoreState', 'current')
    const unsubScore = onSnapshot(scoreRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setScoreState({
          homeScore: (data.homeScore as number) ?? 0,
          awayScore: (data.awayScore as number) ?? 0,
        })
      }
    })

    return () => {
      unsubSession()
      unsubScore()
    }
  }, [sessionId])

  const teamA = teams[0]
  const teamB = teams[1]

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🎬</Text>
        <Text style={styles.heading}>Stream Ended</Text>
        {sessionName ? (
          <Text style={styles.sessionName}>{sessionName}</Text>
        ) : null}

        {/* Final score */}
        <View style={styles.scoreCard}>
          <Text style={styles.finalLabel}>FINAL SCORE</Text>
          <View style={styles.scoreRow}>
            <View style={styles.teamBlock}>
              <Text
                style={[styles.teamName, teamA && { color: teamA.colour }]}
                numberOfLines={1}
              >
                {teamA?.name ?? 'Team A'}
              </Text>
              <Text style={styles.scoreValue}>{scoreState.homeScore}</Text>
            </View>

            <Text style={styles.dash}>–</Text>

            <View style={[styles.teamBlock, styles.teamBlockRight]}>
              <Text style={styles.scoreValue}>{scoreState.awayScore}</Text>
              <Text
                style={[styles.teamName, teamB && { color: teamB.colour }]}
                numberOfLines={1}
              >
                {teamB?.name ?? 'Team B'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.compliment}>Great work! 💪</Text>
        <Text style={styles.subtitle}>Thanks for being part of the broadcast.</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.replace('/(guest)/landing')}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  icon: { fontSize: 56, marginBottom: 8 },
  heading: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  sessionName: {
    color: '#B3B3B3',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 4,
  },

  scoreCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  finalLabel: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  teamBlock: { flex: 1, alignItems: 'flex-start', gap: 4 },
  teamBlockRight: { alignItems: 'flex-end' },
  teamName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 50,
  },
  dash: { color: '#535353', fontSize: 28, fontWeight: '300' },

  compliment: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  subtitle: {
    color: '#535353',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  footer: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  doneButton: {
    backgroundColor: '#1DB954',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: { color: '#000000', fontSize: 16, fontWeight: '800' },
})
