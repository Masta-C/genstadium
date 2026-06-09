/**
 * livekit.ts — LiveKit webhook receiver.
 *
 * Handles `participant_left` events. When a replay-clip-{clipId} Ingress
 * participant leaves the room, auto-returns directorState.activeSource to the
 * camera that was live before the replay started.
 *
 * IMPORTANT: this route must be registered BEFORE app.use(express.json()) so
 * express.raw() can capture the raw body needed for signature verification.
 */

import express from 'express'
import { EgressClient, WebhookReceiver } from 'livekit-server-sdk'
import { getDb } from '../lib/firebase'
import type { Router, Request, Response } from 'express'

const LIVEKIT_HOST = process.env.LIVEKIT_URL ?? 'wss://localhost:7880'
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? ''
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? ''

async function livekitWebhookHandler(req: Request, res: Response): Promise<void> {
  const authorization = req.headers['authorization'] as string | undefined
  if (!authorization) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return
  }

  const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  let event
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body)
    event = await receiver.receive(rawBody, authorization)
  } catch {
    res.status(400).json({ error: 'Invalid webhook signature' })
    return
  }

  if (event.event === 'participant_left') {
    const identity = event.participant?.identity ?? ''
    const roomName = event.room?.name ?? ''
    if (roomName && identity) {
      if (identity.startsWith('replay-clip-')) {
        await handleReplayEnded(roomName)
      } else {
        await handleCameraLeft(roomName, identity)
      }
    }
  }

  res.json({ received: true })
}

async function handleReplayEnded(sessionId: string): Promise<void> {
  const db = getDb()
  const sessionRef = db.doc(`sessions/${sessionId}`)
  const snap = await sessionRef.get()
  if (!snap.exists) return

  const previousSource = snap.data()?.directorState?.previousSource as string | null | undefined

  await sessionRef.update({
    'directorState.activeSource': previousSource ?? null,
    'directorState.previousSource': null,
  })
}

/** Stops Egress B and marks ISO Camera offline when it disconnects. */
async function handleCameraLeft(sessionId: string, identity: string): Promise<void> {
  const db = getDb()
  const sessionRef = db.doc(`sessions/${sessionId}`)
  const snap = await sessionRef.get()
  if (!snap.exists) return

  const data = snap.data()!
  const replayCameraSlot = (data.replayCameraSlot as string | undefined) ?? 'cam_1'
  if (identity !== replayCameraSlot) return

  // ISO Camera left — stop Egress B and mark offline
  const egressBId = (data['egressIds']?.b ?? data.egressBId) as string | undefined
  if (egressBId) {
    const egressClient = new EgressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    try {
      await egressClient.stopEgress(egressBId)
    } catch (err) {
      console.warn('[webhooks/livekit] stopEgress B warning:', String(err))
    }
  }

  await sessionRef.update({ replayCameraOnline: false })
}

/**
 * Must be called BEFORE app.use(express.json()) to capture raw body for HMAC verification.
 */
export function registerLiveKitWebhook(router: Router): void {
  router.post(
    '/webhooks/livekit',
    express.raw({ type: '*/*' }),
    livekitWebhookHandler,
  )
}
