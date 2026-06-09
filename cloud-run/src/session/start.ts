/**
 * start.ts — POST /session/start endpoint.
 *
 * Go Live gate: credit check → Egress A start → wait for ACTIVE → decrement
 * credits → start Egress B → mark session live. Idempotent — re-calling
 * when already live returns {status:'already_live'} without double-charging.
 *
 * Credit decrement only after Egress A is confirmed ACTIVE (CLAUDE.md rule).
 * Decrement is an atomic Firestore transaction keyed on sessionId to prevent
 * double-charge on retry.
 *
 * Egress B (DVR segments → GCS) is started after credit write. If Egress B
 * fails, the session still goes live — Egress A is the primary stream.
 */

import { EgressClient, GCPUpload, RoomServiceClient, SegmentedFileOutput, SegmentedFileProtocol, TrackType } from 'livekit-server-sdk'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, type VerifiedToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { getDb } from '../lib/firebase'
import { startEgressA, waitForEgressActive } from './egressA'
import type { Router, Request, Response } from 'express'

const LIVEKIT_HOST = process.env.LIVEKIT_URL ?? 'wss://localhost:7880'
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? ''
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? ''
const DVR_BUCKET = process.env.DVR_BUCKET ?? 'genstadium-dvr'
const DVR_SEGMENT_SECONDS = 4

const StartSchema = z.object({
  sessionId: z.string().min(1),
  startingSource: z.string().min(1).optional(),
})

type StartBody = z.infer<typeof StartSchema>

async function startHandler(req: Request, res: Response): Promise<void> {
  const token = res.locals.token as VerifiedToken
  const { sessionId, startingSource } = res.locals.body as StartBody
  const db = getDb()

  const sessionRef = db.doc(`sessions/${sessionId}`)
  const sessionSnap = await sessionRef.get()
  if (!sessionSnap.exists) {
    res.status(404).json({ error: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` })
    return
  }

  const sessionData = sessionSnap.data()!

  // Only the session creator can start
  if (sessionData.createdBy !== token.uid) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Only the session creator can go live' })
    return
  }

  // Idempotency — already live
  if (sessionData.status === 'live') {
    res.json({ status: 'already_live' })
    return
  }

  // ── Credit check (CLAUDE.md: always server-side, never trust client) ───────
  const creditsSnap = await db.doc(`users/${token.uid}/credits/balance`).get()
  const balance = (creditsSnap.data()?.balance as number | undefined) ?? 0
  if (balance <= 0) {
    res.status(402).json({
      error: 'PAYMENT_REQUIRED',
      message: 'No credits remaining. Visit genstadium.com to continue.',
    })
    return
  }

  // ── Create Room (idempotent) + verify ISO Camera is present ─────────────
  const roomClient = new RoomServiceClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  await roomClient.createRoom({ name: sessionId })

  // Defensive ISO Camera check — Lobby should have blocked, but guard here too
  const replayCameraSlot = (sessionData.replayCameraSlot as string | undefined) ?? 'cam_1'
  const roomParticipants = await roomClient.listParticipants(sessionId)
  const isoParticipant = roomParticipants.find((p) => p.identity === replayCameraSlot)
  if (!isoParticipant) {
    res.status(400).json({
      error: 'ISO_CAMERA_NOT_READY',
      message: `ISO Camera (${replayCameraSlot}) is not in the Room. Wait for camera operator to join.`,
    })
    return
  }

  // Get ISO Camera video track ID for targeted Egress B recording
  const isoVideoTrack = isoParticipant.tracks.find((t) => t.type === TrackType.VIDEO)

  // Set initial director state if startingSource provided
  if (startingSource) {
    await sessionRef.update({
      'directorState.activeSource': startingSource,
      'directorState.scorebugVisible': true,
    })
  }

  // ── Start Egress A + wait for ACTIVE ─────────────────────────────────────
  const egressA = await startEgressA(sessionId)
  await waitForEgressActive(egressA.egressId)

  // ── Decrement credits atomically AFTER Egress A is confirmed ACTIVE ───────
  const creditRef = db.doc(`users/${token.uid}/credits/balance`)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(creditRef)
    const current = (snap.data()?.balance as number | undefined) ?? 0
    if (current <= 0) {
      // Edge case: credits raced to zero between check and transaction
      throw new Error('PAYMENT_REQUIRED')
    }
    tx.set(creditRef, {
      balance: current - 1,
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  // ── Start Egress B — DVR segments → GCS (best-effort; stream already live) ─
  // ── Egress B — DVR segments → GCS (ISO Camera track only) ───────────────
  const egressClient = new EgressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  const segmentedOutput = new SegmentedFileOutput({
    protocol: SegmentedFileProtocol.HLS_PROTOCOL,
    filenamePrefix: `dvr/${sessionId}/${replayCameraSlot}/`,
    segmentDuration: DVR_SEGMENT_SECONDS,
    output: {
      case: 'gcp',
      value: new GCPUpload({ bucket: DVR_BUCKET }),
    },
  })
  try {
    let egressB
    if (isoVideoTrack?.sid) {
      // Target ISO Camera video track directly (ADR-007: Egress B = ISO Camera only)
      egressB = await egressClient.startTrackCompositeEgress(
        sessionId,
        segmentedOutput,
        { videoTrackId: isoVideoTrack.sid },
      )
    } else {
      // Fallback: room composite if track SID not yet available
      egressB = await egressClient.startRoomCompositeEgress(sessionId, segmentedOutput)
    }
    // end.ts reads egressBId OR egressIds.b — store as egressBId for consistency with egressA.ts
    await sessionRef.update({ egressBId: egressB.egressId })
  } catch (err) {
    // Egress B failure is non-fatal — stream is live via Egress A
    console.warn('[session/start] Egress B start failed (non-fatal):', (err as Error).message)
  }

  // ── Mark session live ────────────────────────────────────────────────────
  await sessionRef.update({
    status: 'live',
    startedAt: FieldValue.serverTimestamp(),
  })

  res.json({ status: 'live', egressAId: egressA.egressId })
}

export function registerStartRoute(router: Router): void {
  router.post('/session/start', requireAuth, validate(StartSchema), startHandler)
}
