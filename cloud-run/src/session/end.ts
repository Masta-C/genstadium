/**
 * end.ts — POST /session/end endpoint.
 *
 * Stops both Egress jobs, waits for them to finish, deletes the LiveKit Room,
 * then writes session.status='ended'. Idempotent — safe to call multiple times.
 */

import { EgressClient, RoomServiceClient } from 'livekit-server-sdk'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, type VerifiedToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { getDb } from '../lib/firebase'
import type { Router, Request, Response } from 'express'

const LIVEKIT_HOST = process.env.LIVEKIT_URL ?? 'wss://localhost:7880'
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? ''
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? ''
const EGRESS_STOP_TIMEOUT_MS = 10_000
const EGRESS_POLL_INTERVAL_MS = 500

const EndSchema = z.object({
  sessionId: z.string().min(1),
})

type EndBody = z.infer<typeof EndSchema>

/** Polls until egress status is terminal (complete/failed/aborted). Throws on timeout. */
async function waitForEgressEnded(egressId: string, timeoutMs: number): Promise<void> {
  const egressClient = new EgressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const egresses = await egressClient.listEgress({ egressId })
    const egress = egresses[0]
    if (!egress) return // already gone — treat as ended

    // EgressStatus >= 3: EGRESS_COMPLETE, EGRESS_FAILED, EGRESS_ABORTED, EGRESS_LIMIT_REACHED
    if (egress.status >= 3) return

    await new Promise((resolve) => setTimeout(resolve, EGRESS_POLL_INTERVAL_MS))
  }

  throw new Error(`Egress ${egressId} did not reach terminal state within ${timeoutMs}ms`)
}

async function endHandler(req: Request, res: Response): Promise<void> {
  const token = res.locals.token as VerifiedToken
  const { sessionId } = res.locals.body as EndBody
  const db = getDb()

  const sessionRef = db.doc(`sessions/${sessionId}`)
  const sessionSnap = await sessionRef.get()
  if (!sessionSnap.exists) {
    res.status(404).json({ error: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` })
    return
  }

  const data = sessionSnap.data()!

  // Verify requesting user is the session creator
  if (data.createdBy !== token.uid) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Only the session creator can end the session' })
    return
  }

  // Idempotency — already ended
  if (data.status === 'ended') {
    res.json({ status: 'already_ended' })
    return
  }

  const egressClient = new EgressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  const roomClient = new RoomServiceClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

  // Resolve egress IDs — support both egressAId/egressBId and nested egressIds.a/b
  const egressAId = (data.egressAId ?? data.egressIds?.a) as string | undefined
  const egressBId = (data.egressBId ?? data.egressIds?.b) as string | undefined

  // Stop Egress A + B concurrently, wait for both to reach terminal state
  const stopJobs: Promise<void>[] = []

  if (egressAId) {
    stopJobs.push(
      egressClient.stopEgress(egressAId)
        .then(() => waitForEgressEnded(egressAId, EGRESS_STOP_TIMEOUT_MS))
        .catch((err: unknown) => {
          // Egress already stopped — not an error
          console.warn(`[session/end] stopEgress A warning: ${String(err)}`)
        }),
    )
  }

  if (egressBId) {
    stopJobs.push(
      egressClient.stopEgress(egressBId)
        .then(() => waitForEgressEnded(egressBId, EGRESS_STOP_TIMEOUT_MS))
        .catch((err: unknown) => {
          console.warn(`[session/end] stopEgress B warning: ${String(err)}`)
        }),
    )
  }

  await Promise.all(stopJobs)

  // Delete LiveKit Room (removes all participants)
  try {
    await roomClient.deleteRoom(sessionId)
  } catch (err) {
    console.warn(`[session/end] deleteRoom warning: ${String(err)}`)
  }

  // Commit ended status
  await sessionRef.update({
    status: 'ended',
    endedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  res.json({ status: 'ended' })
}

export function registerEndRoute(router: Router): void {
  router.post('/session/end', requireAuth, validate(EndSchema), endHandler)
}
