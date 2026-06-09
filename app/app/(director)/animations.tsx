/**
 * animations.tsx — Director Overlays & Animations setup screen.
 *
 * Step 3 of the Director flow: pick overlay display style + per-event animation.
 * Writes animationConfig to sessions/{sessionId}.
 *
 * animationConfig: {
 *   displayStyle: 'scorebug' | 'lower-third',
 *   events: { [eventId]: 'score-flash' | 'alert-banner' | 'lower-third' | 'none' }
 * }
 */

import { router, useLocalSearchParams } from 'expo-router'
import { eventConfig } from '@genstadium/event-config'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'

type SportKey = keyof typeof eventConfig
type DisplayStyle = 'scorebug' | 'lower-third'
type AnimationStyle = 'score-flash' | 'alert-banner' | 'lower-third' | 'none'

const ANIMATION_OPTIONS: { id: AnimationStyle; label: string }[] = [
  { id: 'score-flash', label: 'Flash' },
  { id: 'alert-banner', label: 'Banner' },
  { id: 'lower-third', label: 'L/3' },
  { id: 'none', label: 'None' },
]

const DISPLAY_STYLE_OPTIONS: { id: DisplayStyle; label: string; description: string }[] = [
  {
    id: 'scorebug',
    label: 'Scorebug',
    description: 'Persistent corner overlay. Always visible.',
  },
  {
    id: 'lower-third',
    label: 'Event Lower Third',
    description: 'Slides up on events. Clears after 3s.',
  },
]

interface PreviewState {
  visible: boolean
  eventLabel: string
  animStyle: AnimationStyle
}

export default function AnimationsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [sportKey, setSportKey] = useState<SportKey | null>(null)
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>('scorebug')
  const [eventAnimations, setEventAnimations] = useState<Record<string, AnimationStyle>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({
    visible: false,
    eventLabel: '',
    animStyle: 'none',
  })

  useEffect(() => {
    if (!sessionId) return
    getDoc(doc(db, 'sessions', sessionId)).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      const sport = (data.eventType as SportKey) ?? 'soccer'
      setSportKey(sport)

      const existing = data.animationConfig
      if (existing) {
        setDisplayStyle(existing.displayStyle ?? 'scorebug')
        setEventAnimations(existing.events ?? {})
      } else {
        // Default: events with animation trigger → lower-third, rest → none
        const defaults: Record<string, AnimationStyle> = {}
        const events = eventConfig[sport]?.events ?? []
        for (const ev of events) {
          defaults[ev.id] = ev.triggers.includes('animation') ? 'lower-third' : 'none'
        }
        setEventAnimations(defaults)
      }
      setLoading(false)
    })
  }, [sessionId])

  function setEventAnim(eventId: string, style: AnimationStyle) {
    setEventAnimations((prev) => ({ ...prev, [eventId]: style }))
  }

  function openPreview(eventLabel: string, animStyle: AnimationStyle) {
    setPreview({ visible: true, eventLabel, animStyle })
  }

  function closePreview() {
    setPreview((p) => ({ ...p, visible: false }))
  }

  async function handleContinue() {
    if (!sessionId || !sportKey) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        animationConfig: {
          displayStyle,
          events: eventAnimations,
        },
      })
      router.replace({ pathname: '/(director)/share', params: { sessionId } })
    } catch {
      Alert.alert('Error', 'Could not save animation settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !sportKey) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#1DB954" size="large" />
      </View>
    )
  }

  const sport = eventConfig[sportKey]
  const events = sport.events

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Overlays & Animations</Text>
      <Text style={styles.subtitle}>{sport.displayName}</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Display Style toggle */}
        <Text style={styles.sectionLabel}>DISPLAY STYLE</Text>
        <View style={styles.displayStyleRow}>
          {DISPLAY_STYLE_OPTIONS.map((opt) => {
            const active = displayStyle === opt.id
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.displayStyleCard, active && styles.displayStyleCardActive]}
                onPress={() => setDisplayStyle(opt.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.displayStyleLabel, active && styles.displayStyleLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.displayStyleDesc, active && styles.displayStyleDescActive]}>
                  {opt.description}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Event rows */}
        <Text style={[styles.sectionLabel, styles.sectionLabelGap]}>PER-EVENT ANIMATION</Text>
        {events.map((ev) => {
          const scoreDeltaText =
            ev.scoreDelta != null ? `+${ev.scoreDelta.team}` : '—'
          const selectedStyle = eventAnimations[ev.id] ?? 'none'
          return (
            <View key={ev.id} style={styles.eventRow}>
              {/* Event info */}
              <View style={styles.eventInfo}>
                <Text style={styles.eventLabel}>{ev.label}</Text>
                <Text style={styles.eventDelta}>{scoreDeltaText}</Text>
              </View>

              {/* Animation style options */}
              <View style={styles.animOptions}>
                {ANIMATION_OPTIONS.map((opt) => {
                  const active = selectedStyle === opt.id
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.animChip, active && styles.animChipActive]}
                      onPress={() => setEventAnim(ev.id, opt.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.animChipText, active && styles.animChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Preview button */}
              <TouchableOpacity
                style={styles.previewButton}
                onPress={() => openPreview(ev.label, selectedStyle)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.previewButtonText}>▶</Text>
              </TouchableOpacity>
            </View>
          )
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, saving && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>
            {saving ? 'Saving…' : 'Continue → Share Link'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preview modal */}
      <Modal
        visible={preview.visible}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Animation Preview</Text>
            <Text style={styles.modalEvent}>{preview.eventLabel}</Text>
            <View style={styles.modalAnimBadge}>
              <Text style={styles.modalAnimText}>
                {ANIMATION_OPTIONS.find((o) => o.id === preview.animStyle)?.label ?? 'None'}
              </Text>
            </View>
            <Text style={styles.modalHint}>
              Full preview available in issue #55
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={closePreview} activeOpacity={0.8}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: { flex: 1, backgroundColor: '#121212' },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 4,
  },
  subtitle: {
    color: '#B3B3B3',
    fontSize: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionLabel: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  sectionLabelGap: { marginTop: 24 },
  // Display style cards
  displayStyleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  displayStyleCard: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  displayStyleCardActive: {
    borderColor: '#1DB954',
    backgroundColor: '#0D2B14',
  },
  displayStyleLabel: {
    color: '#B3B3B3',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  displayStyleLabelActive: { color: '#1DB954' },
  displayStyleDesc: {
    color: '#535353',
    fontSize: 12,
    lineHeight: 16,
  },
  displayStyleDescActive: { color: '#1DB95480' },
  // Event rows
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 8,
  },
  eventInfo: { flex: 1, minWidth: 0 },
  eventLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  eventDelta: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  // Animation option chips
  animOptions: { flexDirection: 'row', gap: 4 },
  animChip: {
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  animChipActive: {
    backgroundColor: '#1DB95420',
    borderColor: '#1DB954',
  },
  animChipText: {
    color: '#535353',
    fontSize: 11,
    fontWeight: '600',
  },
  animChipTextActive: { color: '#1DB954' },
  // Preview button
  previewButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewButtonText: { color: '#B3B3B3', fontSize: 10 },
  // Footer
  footer: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  continueButton: {
    backgroundColor: '#1DB954',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { color: '#000000', fontSize: 16, fontWeight: '800' },
  // Preview modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalEvent: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalAnimBadge: {
    backgroundColor: '#1DB95420',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  modalAnimText: {
    color: '#1DB954',
    fontSize: 13,
    fontWeight: '700',
  },
  modalHint: {
    color: '#535353',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalClose: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 4,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
})
