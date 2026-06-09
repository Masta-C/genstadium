/**
 * render.ts — POST /replay/animation endpoint.
 *
 * Renders a Remotion composition to MP4 using renderMedia() on Cloud Run.
 * ADR-003: renderMedia() is called ONLY here — never in browser code.
 * ADR-006: output streamed to GCS immediately after encode; never held in memory.
 *
 * After render: generates a signed GCS URL, creates a LiveKit URL Ingress so
 * the animation clip plays in the room as a participant, then updates Firestore
 * directorState so the layout page switches to the clip. Auto-return is handled
 * by the existing participant_left webhook when the Ingress finishes.
 *
 * Requires:
 *   - CHROMIUM_PATH env var (path to Chromium binary in Cloud Run container)
 *   - PREFETCH_BUCKET env var
 */

import path from 'path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { IngressClient, IngressInput } from 'livekit-server-sdk'
import { z } from 'zod'
import { getStorage } from 'firebase-admin/storage'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '../lib/firebase'
import { validate } from '../middleware/validate'
import type { Router, Request, Response } from 'express'

const PREFETCH_BUCKET = process.env.PREFETCH_BUCKET ?? 'genstadium-prefetched'
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium'
const LIVEKIT_HOST = process.env.LIVEKIT_URL ?? 'wss://localhost:7880'
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? ''
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? ''
const SIGNED_URL_EXPIRY_MS = 60_000

// Remotion bundle entry — graphics/src/remotion/Root.tsx built by @remotion/bundler
const REMOTION_ENTRY = path.resolve(__dirname, '../../../../graphics/src/remotion/Root.tsx')

// Map score event types to Remotion composition IDs (ADR-003)
const EVENT_TYPE_TO_COMPOSITION: Record<string, string> = {
  goal: 'GoalFlash',
  wicket: 'WicketAnimation',
  red_card: 'RedCard',
}

const AnimationSchema = z.object({
  sessionId: z.string().min(1),
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  inputProps: z.record(z.string(), z.unknown()).optional(),
})

type AnimationBody = z.infer<typeof AnimationSchema>

async function animationHandler(req: Request, res: Response): Promise<void> {
  const { sessionId, eventId, eventType, inputProps } = res.locals.body as AnimationBody

  const compositionId = EVENT_TYPE_TO_COMPOSITION[eventType]
  if (!compositionId) {
    // No animation registered for this event type — skip silently
    res.json({ skipped: true, reason: `No animation for eventType '${eventType}'` })
    return
  }

  // Bundle the Remotion entry (cached in production via filesystem)
  const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY, onProgress: () => undefined })

  // Select and validate the composition
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps: inputProps ?? {},
    browserExecutable: CHROMIUM_PATH,
  })

  // Render to temp file — never hold MP4 bytes in memory (ADR-006)
  const outputPath = `/tmp/${sessionId}-${eventId}-${compositionId}.mp4`
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: inputProps ?? {},
    browserExecutable: CHROMIUM_PATH,
  })

  // Stream-upload to GCS (no memory buffering)
  const gcsObjectPath = `${sessionId}/animations/${eventId}.mp4`
  const { createReadStream } = await import('fs')
  await new Promise<void>((resolve, reject) => {
    const writeStream = getStorage()
      .bucket(PREFETCH_BUCKET)
      .file(gcsObjectPath)
      .createWriteStream({ resumable: false, contentType: 'video/mp4' })
    createReadStream(outputPath).pipe(writeStream).on('finish', resolve).on('error', reject)
  })

  // Clean up temp file
  const { unlink } = await import('fs/promises')
  await unlink(outputPath).catch(() => undefined)

  // Generate signed GCS URL (60-second expiry — Ingress starts immediately)
  const [signedUrl] = await getStorage()
    .bucket(PREFETCH_BUCKET)
    .file(gcsObjectPath)
    .getSignedUrl({ action: 'read', expires: Date.now() + SIGNED_URL_EXPIRY_MS })

  // Create LiveKit URL Ingress — animation joins Room as replay-clip-{eventId} participant
  // Uses replay-clip- prefix so the existing participant_left webhook auto-returns to live source
  const ingressClient = new IngressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  const participantIdentity = `replay-clip-${eventId}`
  await ingressClient.createIngress(IngressInput.URL_INPUT, {
    roomName: sessionId,
    participantIdentity,
    participantName: `Animation: ${compositionId}`,
    url: signedUrl,
  })

  // Switch layout page to animation participant, save previous source for auto-return
  const db = getDb()
  const sessionRef = db.doc(`sessions/${sessionId}`)
  const sessionSnap = await sessionRef.get()
  const previousSource = (sessionSnap.data()?.directorState?.activeSource as string | null | undefined) ?? null

  await sessionRef.update({
    'directorState.activeSource': participantIdentity,
    'directorState.previousSource': previousSource,
    updatedAt: FieldValue.serverTimestamp(),
  })

  res.json({
    gcsPath: `gs://${PREFETCH_BUCKET}/${gcsObjectPath}`,
    compositionId,
    durationSecs: composition.durationInFrames / composition.fps,
    participantIdentity,
  })
}

export function registerAnimationRoute(router: Router): void {
  router.post('/replay/animation', validate(AnimationSchema), animationHandler)
}
