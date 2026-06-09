/**
 * broadcast.ts — POST /replay/broadcast endpoint.
 *
 * Called when the Director taps the "🎬 Replay Ready" banner (via inject.ts).
 * Generates a signed GCS URL for the pre-fetched clip, creates a LiveKit URL
 * Ingress so the clip joins the Room as `replay-clip-{clipId}`, then writes
 * the Ingress ID and participant identity back to the Firestore clip doc.
 *
 * Auto-return to live source is handled by the existing participant_left
 * webhook (replay-clip- prefix triggers handleReplayEnded).
 */

import { IngressClient, IngressInput } from 'livekit-server-sdk'
import { z } from 'zod'
import { getStorage } from 'firebase-admin/storage'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '../lib/firebase'
import { validate } from '../middleware/validate'
import type { Router, Request, Response } from 'express'

const PREFETCH_BUCKET = process.env.PREFETCH_BUCKET ?? 'genstadium-prefetched'
const LIVEKIT_HOST = process.env.LIVEKIT_URL ?? 'wss://localhost:7880'
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? ''
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? ''
const SIGNED_URL_EXPIRY_MS = 60_000

const BroadcastSchema = z.object({
  sessionId: z.string().min(1),
  clipId: z.string().min(1),
})

type BroadcastBody = z.infer<typeof BroadcastSchema>

async function broadcastHandler(req: Request, res: Response): Promise<void> {
  const { sessionId, clipId } = res.locals.body as BroadcastBody
  const db = getDb()

  // Read clip doc to get the GCS path
  const clipRef = db.doc(`sessions/${sessionId}/replayClips/${clipId}`)
  const clipSnap = await clipRef.get()
  if (!clipSnap.exists) {
    res.status(404).json({ error: 'CLIP_NOT_FOUND', message: `Clip ${clipId} not found for session ${sessionId}` })
    return
  }

  const gcsPath = clipSnap.data()?.gcsPath as string | undefined
  if (!gcsPath) {
    res.status(404).json({ error: 'CLIP_NOT_FOUND', message: `Clip ${clipId} has no gcsPath` })
    return
  }

  // Derive GCS object name from gs://bucket/object-path
  const objectName = gcsPath.replace(`gs://${PREFETCH_BUCKET}/`, '')

  // Generate signed URL (60-second expiry — Ingress starts immediately)
  const [signedUrl] = await getStorage()
    .bucket(PREFETCH_BUCKET)
    .file(objectName)
    .getSignedUrl({ action: 'read', expires: Date.now() + SIGNED_URL_EXPIRY_MS })

  // Create LiveKit URL Ingress — clip joins Room as replay-clip-{clipId} participant
  const participantIdentity = `replay-clip-${clipId}`
  const ingressClient = new IngressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  const ingress = await ingressClient.createIngress(IngressInput.URL_INPUT, {
    roomName: sessionId,
    participantIdentity,
    participantName: `Replay: ${clipId}`,
    url: signedUrl,
  })

  // Write Ingress metadata back to clip doc for audit + status tracking
  await clipRef.update({
    ingressId: ingress.ingressId,
    participantIdentity,
    broadcastAt: FieldValue.serverTimestamp(),
  })

  res.json({ participantIdentity, ingressId: ingress.ingressId })
}

export function registerBroadcastRoute(router: Router): void {
  router.post('/replay/broadcast', validate(BroadcastSchema), broadcastHandler)
}
