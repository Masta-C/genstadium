/**
 * EventButtons — 3-tier scoring button panel for one team.
 *
 * Renders buttons from eventConfig for the active sport:
 *   T1 — Large scoring buttons (green tint, bold label)
 *   T2 — Medium discipline events (amber/red tint)
 *   T3 — Small admin/stats (grey, 3–4 per row)
 *
 * Special rendering:
 *   yellow_card / red_card → card shape (View, no text)
 *   wicket (cricket)       → SVG stumps icon
 *
 * Event writes wired in #30. Score flash animation wired in #36.
 */

import type { SportEvent, SportKey } from '@genstadium/event-config'
import { eventConfig } from '@genstadium/event-config'
import React, { useCallback } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import Svg, { Line, Rect } from 'react-native-svg'

// ─── Special button renderers ─────────────────────────────────────────────────

function YellowCard() {
  return (
    <View
      style={[styles.cardShape, { backgroundColor: '#EAB308' }]}
      accessibilityLabel="Yellow card"
    />
  )
}

function RedCard() {
  return (
    <View
      style={[styles.cardShape, { backgroundColor: '#E91429' }]}
      accessibilityLabel="Red card"
    />
  )
}

function StumpsIcon({ size = 28 }: { size?: number }) {
  const s = size
  return (
    <Svg width={s} height={s} viewBox="0 0 28 28" accessibilityLabel="Wicket / stumps">
      {/* Three stumps */}
      <Rect x="5" y="8" width="3" height="16" rx="1" fill="#FFFFFF" />
      <Rect x="12.5" y="8" width="3" height="16" rx="1" fill="#FFFFFF" />
      <Rect x="20" y="8" width="3" height="16" rx="1" fill="#FFFFFF" />
      {/* Two bails */}
      <Line x1="4" y1="9" x2="14" y2="9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <Line x1="14" y1="9" x2="24" y2="9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  )
}

// ─── Tier button components ───────────────────────────────────────────────────

function T1Button({ event, teamId, onPress }: ButtonProps) {
  const isYellowCard = event.id === 'yellow_card'
  const isRedCard = event.id === 'red_card'
  const isWicket = event.id === 'wicket'

  return (
    <TouchableOpacity
      style={styles.t1Button}
      onPress={() => onPress(event, teamId)}
      activeOpacity={0.7}
      accessibilityLabel={event.label}
      accessibilityRole="button"
    >
      {isYellowCard ? (
        <YellowCard />
      ) : isRedCard ? (
        <RedCard />
      ) : isWicket ? (
        <StumpsIcon size={32} />
      ) : (
        <Text style={styles.t1Label}>{event.label}</Text>
      )}
    </TouchableOpacity>
  )
}

function T2Button({ event, teamId, onPress }: ButtonProps) {
  const isYellowCard = event.id === 'yellow_card'
  const isRedCard = event.id === 'red_card'

  const bgColour = isRedCard ? '#3D0A0F' : isYellowCard ? '#3D2E00' : '#2A2214'

  return (
    <TouchableOpacity
      style={[styles.t2Button, { backgroundColor: bgColour }]}
      onPress={() => onPress(event, teamId)}
      activeOpacity={0.7}
      accessibilityLabel={event.label}
      accessibilityRole="button"
    >
      {isYellowCard ? (
        <YellowCard />
      ) : isRedCard ? (
        <RedCard />
      ) : (
        <Text style={styles.t2Label}>{event.label}</Text>
      )}
    </TouchableOpacity>
  )
}

function T3Button({ event, teamId, onPress }: ButtonProps) {
  return (
    <TouchableOpacity
      style={styles.t3Button}
      onPress={() => onPress(event, teamId)}
      activeOpacity={0.7}
      accessibilityLabel={event.tip ?? event.label}
      accessibilityRole="button"
    >
      <Text style={styles.t3Label}>{event.label}</Text>
    </TouchableOpacity>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ButtonProps {
  event: SportEvent
  teamId: string
  onPress: (event: SportEvent, teamId: string) => void
}

interface EventButtonsProps {
  sportKey: SportKey
  teamId: string
  /** Called when any event button is tapped. Wires to Firestore write in #30. */
  onEventTap: (event: SportEvent, teamId: string) => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EventButtons({ sportKey, teamId, onEventTap }: EventButtonsProps) {
  const config = eventConfig[sportKey] ?? eventConfig.custom
  const t1Events = config.events.filter((e) => e.tier === 1)
  const t2Events = config.events.filter((e) => e.tier === 2)
  const t3Events = config.events.filter((e) => e.tier === 3)

  const handlePress = useCallback(
    (event: SportEvent, tId: string) => {
      onEventTap(event, tId)
    },
    [onEventTap],
  )

  return (
    <View style={styles.container}>
      {/* T1 — primary scoring */}
      {t1Events.length > 0 && (
        <View style={styles.t1Row}>
          {t1Events.map((event) => (
            <T1Button key={event.id} event={event} teamId={teamId} onPress={handlePress} />
          ))}
        </View>
      )}

      {/* T2 — discipline events */}
      {t2Events.length > 0 && (
        <View style={styles.t2Row}>
          {t2Events.map((event) => (
            <T2Button key={event.id} event={event} teamId={teamId} onPress={handlePress} />
          ))}
        </View>
      )}

      {/* T3 — admin/stats (3–4 per row) */}
      {t3Events.length > 0 && (
        <View style={styles.t3Row}>
          {t3Events.map((event) => (
            <T3Button key={event.id} event={event} teamId={teamId} onPress={handlePress} />
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 6,
  },
  // T1
  t1Row: {
    flexDirection: 'row',
    gap: 6,
    flex: 2,
  },
  t1Button: {
    flex: 1,
    minHeight: 56,
    backgroundColor: '#0D2B14',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  t1Label: {
    color: '#1DB954',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // T2
  t2Row: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  t2Button: {
    flex: 1,
    minHeight: 48,
    backgroundColor: '#2A2214',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F59B23',
  },
  t2Label: {
    color: '#F59B23',
    fontSize: 15,
    fontWeight: '700',
  },
  // T3
  t3Row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  t3Button: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  t3Label: {
    color: '#535353',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Card shape (yellow/red card)
  cardShape: {
    width: 18,
    height: 24,
    borderRadius: 3,
  },
})
