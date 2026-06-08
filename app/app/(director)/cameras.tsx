/**
 * cameras.tsx — Director Camera Slots setup screen.
 *
 * Step 2 of the Director flow: name camera angles + designate ISO Camera.
 * Writes cameraSlots[] + replayCameraSlot to sessions/{sessionId}.
 * Max 5 slots. Default: "Main Camera" at cam_1, designated as ISO Camera.
 *
 * Data model:
 *   cameraSlots: [{ id: 'cam_1', name: 'Main Camera' }, ...]
 *   replayCameraSlot: 'cam_1'   ← ISO Camera designation
 */

import { router, useLocalSearchParams } from 'expo-router'
import { doc, updateDoc } from 'firebase/firestore'
import React, { useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'

const MAX_SLOTS = 5
const SLOT_IDS = ['cam_1', 'cam_2', 'cam_3', 'cam_4', 'cam_5'] as const

interface CameraSlot {
  id: string
  name: string
}

export default function CamerasScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [slots, setSlots] = useState<CameraSlot[]>([
    { id: 'cam_1', name: 'Main Camera' },
  ])
  const [isoSlotId, setIsoSlotId] = useState<string>('cam_1')
  const [saving, setSaving] = useState(false)

  function addSlot() {
    if (slots.length >= MAX_SLOTS) return
    const nextId = SLOT_IDS[slots.length]
    setSlots((prev) => [...prev, { id: nextId, name: `Camera ${slots.length + 1}` }])
  }

  function updateSlotName(id: string, name: string) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  function deleteSlot(id: string) {
    if (slots.length === 1) {
      Alert.alert('Cannot remove', 'At least one camera slot is required.')
      return
    }
    if (id === isoSlotId) {
      // Reassign ISO Camera to the first remaining slot
      const remaining = slots.filter((s) => s.id !== id)
      setIsoSlotId(remaining[0].id)
    }
    setSlots((prev) => prev.filter((s) => s.id !== id))
  }

  function designateISO(id: string) {
    setIsoSlotId(id)
  }

  async function handleContinue() {
    if (!sessionId) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        cameraSlots: slots,
        replayCameraSlot: isoSlotId,
      })
      router.replace({ pathname: '/(director)/share', params: { sessionId } })
    } catch {
      Alert.alert('Error', 'Could not save camera slots. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera Slots</Text>
      <Text style={styles.subtitle}>
        Name your camera angles. Operators will pick their slot when they join.
      </Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {slots.map((slot) => {
          const isISO = slot.id === isoSlotId
          return (
            <View key={slot.id} style={[styles.slotCard, isISO && styles.slotCardISO]}>
              {/* Slot code badge */}
              <View style={styles.slotCodeBadge}>
                <Text style={styles.slotCode}>{slot.id}</Text>
              </View>

              {/* Name input */}
              <TextInput
                style={styles.nameInput}
                value={slot.name}
                onChangeText={(text) => updateSlotName(slot.id, text)}
                placeholder="Camera name"
                placeholderTextColor="#535353"
                maxLength={24}
                returnKeyType="done"
              />

              {/* ISO Camera radio */}
              <TouchableOpacity
                style={[styles.isoButton, isISO && styles.isoButtonActive]}
                onPress={() => designateISO(slot.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.isoButtonText, isISO && styles.isoButtonTextActive]}>
                  {isISO ? '📹' : '○'}
                </Text>
              </TouchableOpacity>

              {/* Delete */}
              {slots.length > 1 ? (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteSlot(slot.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        })}

        {/* ISO Camera tip */}
        <View style={styles.isoTip}>
          <Text style={styles.isoTipText}>
            📹 Replay Source — This camera records the full match for instant replays. Choose your best wide-angle view.
          </Text>
        </View>

        {/* Add slot row */}
        {slots.length < MAX_SLOTS ? (
          <TouchableOpacity style={styles.addRow} onPress={addSlot} activeOpacity={0.7}>
            <Text style={styles.addRowText}>＋ Add camera slot</Text>
            <Text style={styles.addRowCount}>{slots.length}/{MAX_SLOTS}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.maxReached}>
            <Text style={styles.maxReachedText}>Maximum 5 camera slots reached</Text>
          </View>
        )}
      </ScrollView>

      {/* Continue CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, saving && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>
            {saving ? 'Saving…' : 'Continue → Overlays & Animations'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 6,
  },
  subtitle: {
    color: '#B3B3B3',
    fontSize: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  // Slot card
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 10,
  },
  slotCardISO: {
    borderColor: '#1DB954',
    backgroundColor: '#0D2B14',
  },
  slotCodeBadge: {
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 44,
    alignItems: 'center',
  },
  slotCode: {
    color: '#B3B3B3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nameInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  isoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A2A',
  },
  isoButtonActive: {
    borderColor: '#1DB954',
    backgroundColor: '#1DB95420',
  },
  isoButtonText: {
    fontSize: 16,
    color: '#535353',
  },
  isoButtonTextActive: {
    color: '#1DB954',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#535353',
    fontSize: 12,
    fontWeight: '700',
  },
  // ISO tip
  isoTip: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1DB95440',
    padding: 12,
    marginTop: 4,
  },
  isoTipText: {
    color: '#B3B3B3',
    fontSize: 13,
    lineHeight: 18,
  },
  // Add row
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
  },
  addRowText: {
    color: '#B3B3B3',
    fontSize: 15,
    fontWeight: '600',
  },
  addRowCount: {
    color: '#535353',
    fontSize: 13,
  },
  maxReached: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  maxReachedText: {
    color: '#535353',
    fontSize: 13,
  },
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
  continueButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
})
