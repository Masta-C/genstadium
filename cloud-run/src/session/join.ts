/**
 * join.ts — POST /session/join endpoint.
 *
 * Accepts { joinCode, role, displayName } and returns a LiveKit participant
 * token with role-appropriate grants. Writes participant to Firestore.
 *
 * Grant matrix:
 *   Director    — subscribe only
 *   Camera      — canPublish (video+audio) + canSubscribe
 *   Score Keeper — no AV (canPublish:false, canSubscribe:false)
 *
 * Camera participant identity = slot name (e.g. 'cam_1') per ADR-007 /
 * slot-identity decision. Director/SK identity = Firebase UID.
 *
 * Token TTL: 6 hours (covers any match length — CLAUDE.md auth arch).
 */

import { AccessToken, type VideoGrant } from 'livekit-server-sdk'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '../lib/firebase'
import { requireAuth, type VerifiedToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import type { Router, Request, Response } from 'express'

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? ''
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? ''
const TOKEN_TTL_SECONDS = 6 * 60 * 60 // 6 hours

type Role = 'director' | 'camera' | 'scorekeeper'

const JoinSchema = z.object({
  joinCode: z.string().min(1).max(10),
  role: z.enum(['director', 'camera', 'scorekeeper']),
  displayName: z.string().min(1).max(60),
  slotId: z.string().optional(), // Required for camera role
})

type JoinBody = z.infer<typeof JoinSchema>

function buildGrants(role: Role): VideoGrant {
  switch (role) {
    case 'director':
      return { roomJoin: true, canPublish: false, canSubscribe: true }
    case 'camera':
      return { roomJoin: true, canPublish: true, canSubscribe: true }
    case 'scorekeeper':
      return { roomJoin: true, canPublish: false, canSubscribe: false }
  }
}

function buildParticipantIdentity(
  role: Role,
  uid: string,
  slotId?: string,
): string {
  if (role === 'camera' && slotId) {
    // Camera identity = slot name (ADR-007 slot-identity decision)
    return slotId
  }
  return uid
}

async function joinHandler(req: Request, res: Response): Promise<void> {
  const token = res.locals.token as VerifiedToken
  const body = res.locals.body as JoinBody
  const db = getDb()

  // Camera must provide slotId
  if (body.role === 'camera' && !body.slotId) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'slotId is required for camera role',
    })
    return
  }

  // Look up session by joinCode
  const sessionsRef = db.collection('sessions')
  const snap = await sessionsRef
    .where('joinCode', '==', body.joinCode)
    .where('status', 'in', ['lobby', 'live'])
    .limit(1)
    .get()

  if (snap.empty) {
    res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      message: 'No active session found for this join code',
    })
    return
  }

  const sessionDoc = snap.docs[0]
  const sessionId = sessionDoc.id

  // Generate LiveKit token
  const identity = buildParticipantIdentity(body.role, token.uid, body.slotId)
  const grants = buildGrants(body.role)
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    ttl: TOKEN_TTL_SECONDS,
    name: body.displayName,
  })
  at.addGrant({ ...grants, room: sessionId })
  const liveKitToken = await at.toJwt()

  // Write participant to Firestore
  const participantData = {
    uid: token.uid,
    role: body.role,
    displayName: body.displayName,
    status: 'setting_up',
    joinedAt: FieldValue.serverTimestamp(),
    ...(body.slotId ? { slotId: body.slotId } : {}),
  }
  await db
    .collection('sessions')
    .doc(sessionId)
    .collection('participants')
    .doc(token.uid)
    .set(participantData, { merge: true })

  res.json({
    liveKitToken,
    sessionId,
    roomName: sessionId,
  })
}

export function registerJoinRoute(router: Router): void {
  router.post('/session/join', requireAuth, validate(JoinSchema), joinHandler)
}
