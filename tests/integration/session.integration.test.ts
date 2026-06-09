/**
 * session.integration.test.ts
 *
 * Integration tests for session lifecycle handlers (join, start idempotency, end).
 * These tests hit a REAL Firestore emulator — not a mock.
 *
 * Prerequisites:
 *   npm run emulators          (starts Firestore + Auth emulators)
 *
 * Run with:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   npm run test:integration --workspace=cloud-run
 *
 * These tests do NOT run in CI's main job. They're for local validation
 * of Firestore field names, document structure, and session status transitions.
 */

// ── LiveKit mocks (no LiveKit server in integration environment) ──────────────
jest.mock('livekit-server-sdk', () => ({
  AccessToken: jest.fn().mockImplementation(() => ({
    addGrant: jest.fn(),
    toJwt: jest.fn().mockReturnValue('mock-lk-token'),
  })),
  EgressClient: jest.fn().mockImplementation(() => ({
    startRoomCompositeEgress: jest.fn().mockResolvedValue({ egressId: 'egress-a' }),
    startTrackCompositeEgress: jest.fn().mockResolvedValue({ egressId: 'egress-b' }),
    listEgress: jest.fn().mockResolvedValue([]),
    stopEgress: jest.fn().mockResolvedValue({}),
  })),
  RoomServiceClient: jest.fn().mockImplementation(() => ({
    createRoom: jest.fn().mockResolvedValue({}),
    listParticipants: jest.fn().mockResolvedValue([]),
    deleteRoom: jest.fn().mockResolvedValue({}),
  })),
  SegmentedFileOutput: jest.fn().mockImplementation((opts) => opts),
  SegmentedFileProtocol: { HLS_PROTOCOL: 1 },
  GCPUpload: jest.fn().mockImplementation((opts) => opts),
  TrackType: { VIDEO: 0 },
}))

jest.mock('../../cloud-run/src/session/egressA', () => ({
  startEgressA: jest.fn().mockResolvedValue({ egressId: 'egress-a' }),
  waitForEgressActive: jest.fn().mockResolvedValue(undefined),
}))

// ── Auth middleware mock ──────────────────────────────────────────────────────
jest.mock('../../cloud-run/src/middleware/auth', () => ({
  requireAuth: (
    req: { headers: { authorization?: string } },
    res: { status: (n: number) => { json: (b: unknown) => void }; locals: Record<string, unknown> },
    next: () => void,
  ) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHENTICATED' })
      return
    }
    res.locals.token = { uid: TEST_DIRECTOR_UID }
    next()
  },
}))

import * as admin from 'firebase-admin'
import express from 'express'
import request from 'supertest'
import { FieldValue } from 'firebase-admin/firestore'
import { registerJoinRoute } from '../../cloud-run/src/session/join'
import { registerEndRoute } from '../../cloud-run/src/session/end'
import { registerStartRoute } from '../../cloud-run/src/session/start'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_ID = 'genstadium-2321'
const TEST_DIRECTOR_UID = 'integration-director-uid'
const TEST_SESSION_ID = 'integration-test-session'
const TEST_JOIN_CODE = 'INT001'

// ── Admin SDK setup (emulator auto-detected via FIRESTORE_EMULATOR_HOST) ──────

function getAdminDb(): admin.firestore.Firestore {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID })
  }
  return admin.firestore()
}

// ── Test app factory ──────────────────────────────────────────────────────────

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((_req, res, next) => {
    res.locals.body = _req.body
    next()
  })
  registerJoinRoute(app)
  registerEndRoute(app)
  registerStartRoute(app)
  return app
}

const app = buildApp()
const AUTH_HEADER = 'Bearer integration-test-token'

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function seedSession(overrides: Record<string, unknown> = {}) {
  const db = getAdminDb()
  await db.doc(`sessions/${TEST_SESSION_ID}`).set({
    id: TEST_SESSION_ID,
    joinCode: TEST_JOIN_CODE,
    status: 'lobby',
    createdBy: TEST_DIRECTOR_UID,
    eventType: 'football',
    teams: [
      { name: 'Home', colour: '#FF0000' },
      { name: 'Away', colour: '#0000FF' },
    ],
    replayCameraSlot: 'cam_1',
    createdAt: FieldValue.serverTimestamp(),
    ...overrides,
  })
}

async function deleteSession() {
  const db = getAdminDb()
  const session = db.doc(`sessions/${TEST_SESSION_ID}`)
  const participants = await session.collection('participants').get()
  await Promise.all(participants.docs.map((d) => d.ref.delete()))
  await session.delete()
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. Run: npm run emulators before test:integration',
    )
  }
})

afterEach(async () => {
  await deleteSession()
})

// ── join session ──────────────────────────────────────────────────────────────

describe('POST /session/join', () => {
  beforeEach(async () => {
    await seedSession()
  })

  test('writes participant doc to Firestore with correct role and displayName', async () => {
    const res = await request(app)
      .post('/session/join')
      .set('Authorization', AUTH_HEADER)
      .send({ joinCode: TEST_JOIN_CODE, role: 'scorekeeper', displayName: 'Alex' })

    expect(res.status).toBe(200)
    expect(res.body.liveKitToken).toBe('mock-lk-token')

    const db = getAdminDb()
    const participants = await db
      .collection(`sessions/${TEST_SESSION_ID}/participants`)
      .get()
    expect(participants.size).toBe(1)

    const participant = participants.docs[0].data()
    expect(participant.role).toBe('scorekeeper')
    expect(participant.displayName).toBe('Alex')
    expect(participant.uid).toBe(TEST_DIRECTOR_UID)
  })

  test('camera join writes participant with slot identity', async () => {
    const res = await request(app)
      .post('/session/join')
      .set('Authorization', AUTH_HEADER)
      .send({
        joinCode: TEST_JOIN_CODE,
        role: 'camera',
        displayName: 'Camera 1',
        slotId: 'cam_1',
      })

    expect(res.status).toBe(200)

    const db = getAdminDb()
    const participants = await db
      .collection(`sessions/${TEST_SESSION_ID}/participants`)
      .get()
    expect(participants.size).toBe(1)
    expect(participants.docs[0].data().role).toBe('camera')
  })

  test('returns 404 for unknown joinCode', async () => {
    const res = await request(app)
      .post('/session/join')
      .set('Authorization', AUTH_HEADER)
      .send({ joinCode: 'NOPE99', role: 'scorekeeper', displayName: 'Test' })

    expect(res.status).toBe(404)
  })
})

// ── start session (idempotency) ───────────────────────────────────────────────

describe('POST /session/start — idempotency', () => {
  test('returns already_live when session is already live', async () => {
    await seedSession({ status: 'live', egressIds: { a: 'egress-a', b: 'egress-b' } })
    const db = getAdminDb()
    await db.doc(`users/${TEST_DIRECTOR_UID}/credits/balance`).set({ balance: 5 })

    const res = await request(app)
      .post('/session/start')
      .set('Authorization', AUTH_HEADER)
      .send({ sessionId: TEST_SESSION_ID })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('already_live')

    // Credits must not be decremented on idempotent call
    const creditsSnap = await db.doc(`users/${TEST_DIRECTOR_UID}/credits/balance`).get()
    expect(creditsSnap.data()?.balance).toBe(5)

    await db.doc(`users/${TEST_DIRECTOR_UID}/credits/balance`).delete()
  })

  test('returns 404 when session does not exist', async () => {
    const res = await request(app)
      .post('/session/start')
      .set('Authorization', AUTH_HEADER)
      .send({ sessionId: 'nonexistent-session-id' })

    expect(res.status).toBe(404)
  })
})

// ── end session ───────────────────────────────────────────────────────────────

describe('POST /session/end', () => {
  test('sets session status to ended and records endedAt', async () => {
    await seedSession({ status: 'live', egressIds: { a: 'egress-a', b: 'egress-b' } })

    const res = await request(app)
      .post('/session/end')
      .set('Authorization', AUTH_HEADER)
      .send({ sessionId: TEST_SESSION_ID })

    expect(res.status).toBe(200)

    const db = getAdminDb()
    const snap = await db.doc(`sessions/${TEST_SESSION_ID}`).get()
    expect(snap.data()?.status).toBe('ended')
    expect(snap.data()?.endedAt).toBeDefined()
  })

  test('is idempotent — re-calling on ended session succeeds', async () => {
    await seedSession({ status: 'ended' })

    const res = await request(app)
      .post('/session/end')
      .set('Authorization', AUTH_HEADER)
      .send({ sessionId: TEST_SESSION_ID })

    expect(res.status).toBe(200)
  })

  test('returns 403 when caller is not the session creator', async () => {
    await seedSession({ createdBy: 'other-director-uid' })

    const res = await request(app)
      .post('/session/end')
      .set('Authorization', AUTH_HEADER)
      .send({ sessionId: TEST_SESSION_ID })

    expect(res.status).toBe(403)
  })
})
