/**
 * sk-log.tsx — Event Log screen
 *
 * Shows the last 10 non-deleted events for the session.
 * Score Keepers can remove any event (soft-delete → deleted: true).
 * scoreStateAggregator Cloud Function excludes deleted events — score corrects silently.
 */

import { router, useLocalSearchParams } from 'expo-router'
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'

interface EventDoc {
  id: string
  eventType: string
  team: string
  scoreDelta: { team: number } | null
  timestamp: { seconds: number } | null
}

const EVENT_ICONS: Record<string, string> = {
  goal: '⚽',
  own_goal: '⚽',
  touchdown: '🏈',
  field_goal: '🏈',
  six: '🏏',
  four: '🏏',
  wicket: '🏏',
  points_3: '🏀',
  points_2: '🏀',
  points_1: '🏀',
  foul: '🟨',
  yellow_card: '🟨',
  red_card: '🟥',
  fault: '❌',
}

function formatTime(ts: { seconds: number } | null): string {
  if (!ts) return '—'
  const d = new Date(ts.seconds * 1000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function SkLogScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [events, setEvents] = useState<EventDoc[]>([])

  useEffect(() => {
    if (!sessionId) return

    const q = query(
      collection(db, 'sessions', sessionId, 'events'),
      where('deleted', '!=', true),
      orderBy('deleted'),
      orderBy('timestamp', 'desc'),
      limit(10),
    )

    const unsub = onSnapshot(q, (snap) => {
      setEvents(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            eventType: (data.eventType as string) ?? '',
            team: (data.team as string) ?? '',
            scoreDelta: (data.scoreDelta as { team: number } | null) ?? null,
            timestamp: (data.timestamp as { seconds: number } | null) ?? null,
          }
        }),
      )
    })

    return unsub
  }, [sessionId])

  function handleRemove(eventId: string) {
    if (!sessionId) return
    updateDoc(doc(db, 'sessions', sessionId, 'events', eventId), {
      deleted: true,
    }).catch(() => {
      // Silent failure
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Event Log</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>No events logged yet.</Text>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.eventIcon}>
                {EVENT_ICONS[event.eventType] ?? '📌'}
              </Text>
              <View style={styles.eventInfo}>
                <Text style={styles.eventType}>{event.eventType.replace(/_/g, ' ')}</Text>
                <Text style={styles.eventMeta}>
                  {event.team.replace(/-/g, ' ').toUpperCase()}
                  {event.scoreDelta ? ` · +${event.scoreDelta.team}` : ''}
                  {' · '}{formatTime(event.timestamp)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemove(event.id)}
                activeOpacity={0.7}
                accessibilityLabel="Remove event"
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  backButton: { padding: 4 },
  backText: { color: '#1DB954', fontSize: 15, fontWeight: '600' },
  heading: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSpacer: { width: 48 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },
  emptyText: { color: '#535353', fontSize: 15, textAlign: 'center', paddingVertical: 32 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  eventIcon: { fontSize: 22 },
  eventInfo: { flex: 1 },
  eventType: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  eventMeta: { color: '#535353', fontSize: 12, marginTop: 2 },
  removeButton: {
    backgroundColor: '#3D0A0F',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeText: { color: '#FF4444', fontSize: 13, fontWeight: '600' },
})
