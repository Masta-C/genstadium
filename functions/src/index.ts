/**
 * GenStadium Cloud Functions
 *
 * scoreStateAggregator — triggered on events/{eventId} onCreate.
 * Sums scoreDelta per team across all non-deleted events and writes
 * sessions/{sessionId}/scoreState/current. This is the ONLY writer of scoreState —
 * clients are read-only (enforced by Firestore rules).
 */

import * as admin from 'firebase-admin'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'

admin.initializeApp()
const db = admin.firestore()

interface ScoreEvent {
  eventType: string
  team: string
  scoreDelta: { team: number } | null
  timestamp: admin.firestore.Timestamp
  deleted?: boolean
}

/**
 * Triggered on every new event document.
 * Reads all events for the session, computes homeScore / awayScore, writes scoreState.
 */
export const scoreStateAggregator = onDocumentCreated(
  'sessions/{sessionId}/events/{eventId}',
  async (event) => {
    const { sessionId } = event.params

    // Fetch the session to determine which teamId maps to home/away
    const sessionSnap = await db.doc(`sessions/${sessionId}`).get()
    if (!sessionSnap.exists) return

    const sessionData = sessionSnap.data() as {
      teams?: { id: string; name: string; colour: string }[]
      eventType?: string
    }
    const teams = sessionData.teams ?? []
    const homeTeamId = teams[0]?.id ?? 'team-a'
    const awayTeamId = teams[1]?.id ?? 'team-b'

    // Read all non-deleted events for the session
    const eventsSnap = await db
      .collection(`sessions/${sessionId}/events`)
      .orderBy('timestamp', 'asc')
      .get()

    let homeScore = 0
    let awayScore = 0
    let lastEvent: { eventType: string; team: string; timestamp: admin.firestore.Timestamp } | null = null

    for (const doc of eventsSnap.docs) {
      const e = doc.data() as ScoreEvent
      if (e.deleted) continue

      if (e.scoreDelta && typeof e.scoreDelta.team === 'number') {
        if (e.team === homeTeamId) {
          homeScore += e.scoreDelta.team
        } else if (e.team === awayTeamId) {
          awayScore += e.scoreDelta.team
        }
      }

      if (e.timestamp) {
        lastEvent = { eventType: e.eventType, team: e.team, timestamp: e.timestamp }
      }
    }

    // Fetch current period from scoreState (preserved across updates)
    const scoreStateSnap = await db.doc(`sessions/${sessionId}/scoreState/current`).get()
    const currentPeriod = scoreStateSnap.exists
      ? (scoreStateSnap.data()?.period as string | undefined) ?? '1st'
      : '1st'

    await db.doc(`sessions/${sessionId}/scoreState/current`).set({
      homeScore,
      awayScore,
      period: currentPeriod,
      lastEvent: lastEvent ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  },
)
