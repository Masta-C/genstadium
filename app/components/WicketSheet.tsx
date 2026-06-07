/**
 * WicketSheet — cricket wicket attribution flow.
 *
 * Step 1: Select dismissal type (2×3 grid)
 * Non-Run Out: done in 1 tap — logs dismissalType + bowler (from cricketState) + striker
 * Run Out → Step 2: which batsman? (striker or non-striker)
 * Run Out → Step 3: which fielder? (from bowling team)
 *
 * Does NOT replace the attribution sheet — this is a specialised flow for the
 * wicket event only. Slides up from bottom like AttributionSheet.
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

interface WicketSheetProps {
  sessionId: string
  eventId: string
  bowlingTeamId: string
  currentBowler: string
  strikerName: string
  nonStrikerName: string
  players: Player[]
  onDismiss: () => void
}

const DISMISSAL_TYPES = [
  { id: 'bowled',      label: 'Bowled',      emoji: '🎳' },
  { id: 'caught',      label: 'Caught',      emoji: '🙌' },
  { id: 'lbw',         label: 'LBW',         emoji: '🦵' },
  { id: 'run_out',     label: 'Run Out',     emoji: '🏃' },
  { id: 'stumped',     label: 'Stumped',     emoji: '🧤' },
  { id: 'hit_wicket',  label: 'Hit Wicket',  emoji: '💥' },
]

export function WicketSheet({
  sessionId,
  eventId,
  bowlingTeamId,
  currentBowler,
  strikerName,
  nonStrikerName,
  players,
  onDismiss,
}: WicketSheetProps) {
  const slideAnim = useRef(new Animated.Value(400)).current
  const dismissedRef = useRef(false)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [dismissalType, setDismissalType] = useState('')
  const [dismissedBatsman, setDismissedBatsman] = useState('')
  const [summaryParts, setSummaryParts] = useState<string[]>([])

  // Slide up on mount
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
  }, [slideAnim])

  const slideDownAndDismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDismiss())
  }, [slideAnim, onDismiss])

  const completeWicket = useCallback(
    (metadata: Record<string, string>) => {
      updateDoc(doc(db, 'sessions', sessionId, 'events', eventId), {
        playerId: metadata.batsmanId ?? strikerName,
        metadata,
      }).catch(() => {/* silent */})
      slideDownAndDismiss()
    },
    [sessionId, eventId, strikerName, slideDownAndDismiss],
  )

  // Step 1: Select dismissal type
  function handleDismissalType(typeId: string, typeLabel: string) {
    setDismissalType(typeId)
    if (typeId === 'run_out') {
      setSummaryParts([typeLabel])
      setStep(2)
      return
    }

    // All other types: 1 tap done
    completeWicket({
      dismissalType: typeId,
      bowler: currentBowler,
      batsmanId: strikerName,
    })
  }

  // Step 2 (Run Out only): which batsman?
  function handleBatsman(name: string) {
    setDismissedBatsman(name)
    setSummaryParts((p) => [...p, name])
    setStep(3)
  }

  // Step 3 (Run Out only): which fielder?
  function handleFielder(fielderId: string, fielderName: string) {
    completeWicket({
      dismissalType: 'run_out',
      bowler: currentBowler,
      batsmanId: dismissedBatsman,
      fielderId,
      fielder: fielderName,
    })
  }

  const bowlingPlayers = players.filter((p) => p.teamId === bowlingTeamId)

  // Progress pips
  const totalSteps = dismissalType === 'run_out' ? 3 : 1
  const currentStep = step

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Progress pips */}
        <View style={styles.pipsRow}>
          {Array.from({ length: step === 1 ? 1 : totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[styles.pip, i < currentStep && styles.pipActive]}
            />
          ))}
        </View>

        {/* Summary strip */}
        {summaryParts.length > 0 && (
          <Text style={styles.summary}>{summaryParts.join(' · ')}</Text>
        )}

        {/* Step 1: Dismissal type grid */}
        {step === 1 && (
          <>
            <Text style={styles.title}>🏏 How was the wicket?</Text>
            <View style={styles.grid}>
              {DISMISSAL_TYPES.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.typeButton}
                  onPress={() => handleDismissalType(d.id, d.label)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.typeEmoji}>{d.emoji}</Text>
                  <Text style={styles.typeLabel}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Step 2 (Run Out): which batsman? */}
        {step === 2 && (
          <>
            <Text style={styles.title}>🏃 Which batsman ran out?</Text>
            <View style={styles.batsmanRow}>
              <TouchableOpacity
                style={styles.batsmanButton}
                onPress={() => handleBatsman(strikerName)}
                activeOpacity={0.7}
              >
                <Text style={styles.batsmanName}>{strikerName || 'Striker'}</Text>
                <Text style={styles.batsmanRole}>On strike *</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.batsmanButton}
                onPress={() => handleBatsman(nonStrikerName)}
                activeOpacity={0.7}
              >
                <Text style={styles.batsmanName}>{nonStrikerName || 'Non-striker'}</Text>
                <Text style={styles.batsmanRole}>Non-striker</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Step 3 (Run Out): which fielder? */}
        {step === 3 && (
          <>
            <Text style={styles.title}>🧤 Which fielder?</Text>
            <View style={styles.fielderList}>
              {bowlingPlayers.length === 0 ? (
                <TouchableOpacity
                  style={styles.fielderButton}
                  onPress={() => handleFielder('', 'Unknown')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fielderName}>Unknown fielder</Text>
                </TouchableOpacity>
              ) : (
                bowlingPlayers.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.fielderButton}
                    onPress={() => handleFielder(p.id, p.name)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.jerseyBadge}>
                      <Text style={styles.jerseyText}>{p.jerseyNumber}</Text>
                    </View>
                    <Text style={styles.fielderName}>{p.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.skipButton} onPress={slideDownAndDismiss} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip — log without detail</Text>
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
    maxHeight: '80%',
  },
  pipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    justifyContent: 'center',
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A2A2A',
  },
  pipActive: { backgroundColor: '#1DB954' },
  summary: {
    color: '#B3B3B3',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  typeButton: {
    width: '30%',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  typeEmoji: { fontSize: 22 },
  typeLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  batsmanRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  batsmanButton: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  batsmanName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  batsmanRole: { color: '#535353', fontSize: 12 },
  fielderList: {
    gap: 8,
    marginBottom: 16,
    maxHeight: 200,
  },
  fielderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  jerseyBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  fielderName: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  skipButton: { alignItems: 'center', paddingVertical: 12 },
  skipText: { color: '#535353', fontSize: 13, textDecorationLine: 'underline' },
})
