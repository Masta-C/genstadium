/**
 * inject.ts — POST /replay/inject endpoint.
 *
 * Called when Director taps the "🎬 Replay Ready" banner. Writes the Firestore
 * director command so the layout page switches to the replay participant.
 * Saves the current live source as `previousSource` so the LiveKit webhook
 * can auto-return once the Ingress clip ends.
 *
 * LiveKit Ingress creation is handled in issue #77 — this endpoint orchestrates
 * the Firestore state; the Ingress feeds actual video to the room.
 */

import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { validate } from '../middleware/validate'
import { getDb } from '../lib/firebase'
import type { Router, Request, Response } from 'express'

const InjectSchema = z.object({
  sessionId: z.string().min(1),
  clipId: z.string().min(1),
})

type InjectBody = z.infer<typeof InjectSchema>

async function injectHandler(req: Request, res: Response): Promise<void> {
  const { sessionId, clipId } = res.locals.body as InjectBody
  const db = getDb()

  const sessionRef = db.doc(`sessions/${sessionId}`)
  const sessionSnap = await sessionRef.get()
  if (!sessionSnap.exists) {
    res.status(404).json({ error: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` })
    return
  }

  const directorState = sessionSnap.data()?.directorState as
    | { activeSource?: string | null }
    | undefined

  const previousSource = directorState?.activeSource ?? null
  const replayIdentity = `replay-clip-${clipId}`

  await sessionRef.update({
    // Switch layout page to the Ingress replay participant
    'directorState.activeSource': replayIdentity,
    // Store previous source so the webhook can auto-return when clip ends
    'directorState.previousSource': previousSource,
    // Clear the ready banner — most-recent-clip semantics (ADR-006)
    latestReplayClip: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  res.json({ identity: replayIdentity })
}

export function registerInjectRoute(router: Router): void {
  router.post('/replay/inject', validate(InjectSchema), injectHandler)
}
