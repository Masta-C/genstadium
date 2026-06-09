/**
 * GenStadium Cloud Functions
 *
 * scoreStateAggregator — triggered on events/{eventId} onCreate.
 * Sums scoreDelta per team across all non-deleted events and writes
 * sessions/{sessionId}/scoreState/current. This is the ONLY writer of scoreState —
 * clients are read-only (enforced by Firestore rules).
 *
 * replayPrefetchTrigger — triggered on events/{eventId} onCreate.
 * Fires POST /replay/prefetch on Cloud Run when triggers includes 'prefetch' (ADR-006).
 */

import * as admin from 'firebase-admin'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'

admin.initializeApp()
const db = admin.firestore()

const CLOUD_RUN_URL = process.env.CLOUD_RUN_URL ?? 'http://localhost:8081'

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

interface ScoreEventForTriggers {
  triggers?: string[]
  eventType?: string
  timestamp?: admin.firestore.Timestamp
}

/**
 * Core pre-fetch logic — extracted for unit testing.
 * Calls Cloud Run /replay/prefetch when the event has triggers:['prefetch'].
 * Fire-and-forget: any network error is logged but does not throw.
 */
export async function handlePrefetchTrigger(
  sessionId: string,
  eventData: ScoreEventForTriggers,
  cloudRunUrl: string = CLOUD_RUN_URL,
): Promise<void> {
  if (!eventData.triggers?.includes('prefetch')) return

  const eventTimestamp = eventData.timestamp?.toMillis() ?? Date.now()

  // Read replayCameraSlot from the session (ISO Camera identity per ADR-007)
  const sessionSnap = await db.doc(`sessions/${sessionId}`).get()
  const cameraId = (sessionSnap.data()?.replayCameraSlot as string | undefined) ?? 'cam_1'

  try {
    await fetch(`${cloudRunUrl}/replay/prefetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, cameraId, eventTimestamp }),
    })
  } catch (err) {
    // Fire-and-forget: log and continue — replay unavailability must not block scoring
    console.error('replayPrefetchTrigger: Cloud Run call failed', err)
  }
}

/**
 * Core animation trigger logic — extracted for unit testing.
 * Calls Cloud Run /replay/animation when the event has triggers:['animation'].
 * Fire-and-forget: any network error is logged but does not throw.
 */
export async function handleAnimationTrigger(
  sessionId: string,
  eventId: string,
  eventData: ScoreEventForTriggers,
  cloudRunUrl: string = CLOUD_RUN_URL,
): Promise<void> {
  if (!eventData.triggers?.includes('animation')) return

  try {
    await fetch(`${cloudRunUrl}/replay/animation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, eventId, eventType: eventData.eventType ?? '' }),
    })
  } catch (err) {
    console.error('animationTrigger: Cloud Run call failed', err)
  }
}

/**
 * Triggered on every new score event.
 * If the event has triggers:['prefetch'], kicks off replay clip pre-encoding on Cloud Run (ADR-006).
 * If the event has triggers:['animation'], renders Remotion composition and injects via Ingress.
 * One function — not two — to avoid race conditions and double triggers (knowledge-graph: single-cloud-function).
 */
export const replayPrefetchTrigger = onDocumentCreated(
  'sessions/{sessionId}/events/{eventId}',
  async (event) => {
    const { sessionId, eventId } = event.params
    const eventData = (event.data?.data() ?? {}) as ScoreEventForTriggers
    await Promise.all([
      handlePrefetchTrigger(sessionId, eventData),
      handleAnimationTrigger(sessionId, eventId, eventData),
    ])
  },
)
