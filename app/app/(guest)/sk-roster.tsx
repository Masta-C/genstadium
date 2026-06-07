import { router, useLocalSearchParams } from 'expo-router'
import { doc, updateDoc } from 'firebase/firestore'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { db } from '../../lib/firebase/client'

interface Player {
  id: string
  teamId: 'team-a' | 'team-b'
  jerseyNumber: string
  name: string
  position: string
}

interface PlayerDraft {
  jerseyNumber: string
  name: string
  position: string
}

const EMPTY_DRAFT: PlayerDraft = { jerseyNumber: '', name: '', position: '' }

function PlayerRow({
  player,
  onRemove,
}: {
  player: Player
  onRemove: () => void
}) {
  return (
    <View style={styles.playerRow}>
      <View style={styles.jerseyBadge}>
        <Text style={styles.jerseyText}>{player.jerseyNumber || '—'}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{player.name}</Text>
        {player.position ? (
          <Text style={styles.playerPosition}>{player.position}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        accessibilityLabel={`Remove ${player.name}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.removeButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

function AddPlayerForm({
  draft,
  onChange,
  onAdd,
}: {
  draft: PlayerDraft
  onChange: (patch: Partial<PlayerDraft>) => void
  onAdd: () => void
}) {
  const canAdd = draft.jerseyNumber.trim().length > 0 && draft.name.trim().length > 0

  return (
    <View style={styles.addForm}>
      <View style={styles.addFormRow}>
        <TextInput
          style={[styles.input, styles.inputJersey]}
          placeholder="#"
          placeholderTextColor="#535353"
          value={draft.jerseyNumber}
          onChangeText={(v) => onChange({ jerseyNumber: v })}
          maxLength={3}
          keyboardType="number-pad"
          accessibilityLabel="Jersey number"
        />
        <TextInput
          style={[styles.input, styles.inputName]}
          placeholder="Player name"
          placeholderTextColor="#535353"
          value={draft.name}
          onChangeText={(v) => onChange({ name: v })}
          maxLength={40}
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="Player name"
        />
      </View>
      <TextInput
        style={[styles.input, styles.inputPosition]}
        placeholder="Position (optional)"
        placeholderTextColor="#535353"
        value={draft.position}
        onChangeText={(v) => onChange({ position: v })}
        maxLength={30}
        autoCapitalize="words"
        autoCorrect={false}
        accessibilityLabel="Position"
      />
      <TouchableOpacity
        style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
        onPress={onAdd}
        disabled={!canAdd}
        activeOpacity={0.8}
      >
        <Text style={styles.addButtonText}>+ Add Player</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function SkRosterScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()

  const [activeTab, setActiveTab] = useState<'team-a' | 'team-b'>('team-a')
  const [players, setPlayers] = useState<Player[]>([])
  const [draft, setDraft] = useState<PlayerDraft>(EMPTY_DRAFT)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const teamAPlayers = players.filter((p) => p.teamId === 'team-a')
  const teamBPlayers = players.filter((p) => p.teamId === 'team-b')
  const activePlayers = activeTab === 'team-a' ? teamAPlayers : teamBPlayers

  function handleAddPlayer() {
    if (!draft.jerseyNumber.trim() || !draft.name.trim()) return
    const newPlayer: Player = {
      id: `${activeTab}-${Date.now()}`,
      teamId: activeTab,
      jerseyNumber: draft.jerseyNumber.trim(),
      name: draft.name.trim(),
      position: draft.position.trim(),
    }
    setPlayers((prev) => [...prev, newPlayer])
    setDraft(EMPTY_DRAFT)
  }

  function handleRemovePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id))
  }

  async function saveAndNavigate() {
    if (!sessionId) return
    setSubmitting(true)
    setError('')
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { players })
      router.push({ pathname: '/(guest)/sk-toss', params: { sessionId } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save roster. Please try again.')
      setSubmitting(false)
    }
  }

  async function handleContinue() {
    await saveAndNavigate()
  }

  async function handleSkip() {
    if (!sessionId) return
    setSubmitting(true)
    setError('')
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { players: [] })
      router.push({ pathname: '/(guest)/sk-toss', params: { sessionId } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to continue. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {/* Progress */}
      <View style={styles.progressRow}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[styles.progressDot, step === 2 && styles.progressDotActive]}
          />
        ))}
        <Text style={styles.progressLabel}>Step 2 of 4</Text>
      </View>

      <Text style={styles.heading}>Roster Setup</Text>
      <Text style={styles.sub}>Add players to attribute events during the match.</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['team-a', 'team-b'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab)
              setDraft(EMPTY_DRAFT)
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'team-a' ? 'Team A' : 'Team B'}
              {tab === 'team-a' && teamAPlayers.length > 0 ? ` (${teamAPlayers.length})` : ''}
              {tab === 'team-b' && teamBPlayers.length > 0 ? ` (${teamBPlayers.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Player list */}
      <View style={styles.playerList}>
        {activePlayers.length === 0 ? (
          <Text style={styles.emptyText}>No players added yet.</Text>
        ) : (
          activePlayers.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              onRemove={() => handleRemovePlayer(player.id)}
            />
          ))
        )}
      </View>

      {/* Add Player form */}
      <AddPlayerForm
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onAdd={handleAddPlayer}
      />

      <Text style={styles.helperText}>
        You can add more players mid-session from the event log.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#121212" size="small" />
        ) : (
          <Text style={styles.continueButtonText}>Continue →</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        disabled={submitting}
        activeOpacity={0.7}
      >
        <Text style={styles.skipButtonText}>Skip roster — add later</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  scroll: { padding: 24, paddingBottom: 48 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A2A2A',
  },
  progressDotActive: { backgroundColor: '#1DB954' },
  progressLabel: { color: '#535353', fontSize: 13, marginLeft: 4 },
  heading: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 6 },
  sub: { color: '#B3B3B3', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#2A2A2A' },
  tabText: { color: '#535353', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  playerList: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    marginBottom: 16,
  },
  emptyText: {
    color: '#535353',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  jerseyBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  jerseyText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  playerInfo: { flex: 1 },
  playerName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  playerPosition: { color: '#535353', fontSize: 12, marginTop: 2 },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeButtonText: { color: '#535353', fontSize: 16 },
  addForm: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  addFormRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  inputJersey: { width: 64 },
  inputName: { flex: 1 },
  inputPosition: { marginBottom: 12 },
  addButton: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: { color: '#1DB954', fontSize: 15, fontWeight: '700' },
  helperText: {
    color: '#535353',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  errorText: { color: '#FF4444', fontSize: 13, marginBottom: 12 },
  continueButton: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueButtonDisabled: { opacity: 0.4 },
  continueButtonText: { color: '#121212', fontSize: 17, fontWeight: '700' },
  skipButton: {
    alignItems: 'center',
    padding: 14,
  },
  skipButtonText: { color: '#535353', fontSize: 14, textDecorationLine: 'underline' },
})
