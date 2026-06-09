// ── LiveKit SDK mocks ────────────────────────────────────────────────────────
const mockCreateRoom = jest.fn().mockResolvedValue({})
const mockStartTrackCompositeEgress = jest.fn().mockResolvedValue({ egressId: 'egress-b-id' })

const mockListParticipants = jest.fn()

jest.mock('livekit-server-sdk', () => ({
  EgressClient: jest.fn().mockImplementation(() => ({
    startTrackCompositeEgress: mockStartTrackCompositeEgress,
    startRoomCompositeEgress: jest.fn().mockResolvedValue({ egressId: 'egress-b-id' }),
    listEgress: jest.fn().mockResolvedValue([]),
  })),
  RoomServiceClient: jest.fn().mockImplementation(() => ({
    createRoom: mockCreateRoom,
    listParticipants: (...args: unknown[]) => mockListParticipants(...args),
  })),
  SegmentedFileOutput: jest.fn().mockImplementation((opts) => opts),
  SegmentedFileProtocol: { HLS_PROTOCOL: 1 },
  GCPUpload: jest.fn().mockImplementation((opts) => opts),
  TrackType: { VIDEO: 0 },
}))

// ── egressA helpers mock ─────────────────────────────────────────────────────
const mockStartEgressA = jest.fn().mockResolvedValue({ egressId: 'egress-a-id' })
const mockWaitForEgressActive = jest.fn().mockResolvedValue(undefined)

jest.mock('./egressA', () => ({
  startEgressA: (...args: unknown[]) => mockStartEgressA(...args),
  waitForEgressActive: (...args: unknown[]) => mockWaitForEgressActive(...args),
}))

// ── Firebase mock ────────────────────────────────────────────────────────────
const mockDocUpdate = jest.fn().mockResolvedValue(undefined)
const mockDocSet = jest.fn().mockResolvedValue(undefined)
const mockRunTransaction = jest.fn()
const mockDoc = jest.fn()

jest.mock('../lib/firebase', () => ({
  getDb: () => ({
    doc: mockDoc,
    runTransaction: mockRunTransaction,
  }),
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__serverTimestamp__' },
}))

// ── Auth middleware mock ─────────────────────────────────────────────────────
jest.mock('../middleware/auth', () => ({
  requireAuth: (
    req: { headers: { authorization?: string } },
    res: { status: (n: number) => { json: (b: unknown) => void }; locals: Record<string, unknown> },
    next: () => void,
  ) => {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHENTICATED' })
      return
    }
    res.locals.token = { uid: 'director-uid' }
    next()
  },
}))

import express from 'express'
import request from 'supertest'
import { registerStartRoute } from './start'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((_req, res, next) => { res.locals.body = _req.body; next() })
  registerStartRoute(app)
  return app
}

function makeSessionSnap(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      createdBy: 'director-uid',
      status: 'lobby',
      replayCameraSlot: 'cam_1',
      ...overrides,
    }),
  }
}

function makeCreditsSnap(balance: number) {
  return { exists: true, data: () => ({ balance }) }
}

beforeEach(() => {
  jest.clearAllMocks()

  // Default: ISO Camera 'cam_1' is in Room with a video track
  mockListParticipants.mockResolvedValue([
    { identity: 'cam_1', tracks: [{ type: 0, sid: 'TR_cam1_video' }] },
  ])

  mockDoc.mockImplementation((path: string) => {
    return {
      get: () => {
        if (path.includes('/credits/balance')) return Promise.resolve(makeCreditsSnap(2))
        return Promise.resolve(makeSessionSnap())
      },
      update: mockDocUpdate,
      set: mockDocSet,
    }
  })

  // Default transaction: success (balance decrements)
  mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      get: () => Promise.resolve(makeCreditsSnap(2)),
      set: mockDocSet,
    }
    await fn(tx)
  })
})

describe('POST /session/start', () => {
  it('returns 401 without auth token', async () => {
    const app = buildApp()
    const res = await request(app).post('/session/start').send({ sessionId: 'sess1' })
    expect(res.status).toBe(401)
  })

  it('returns 402 PAYMENT_REQUIRED when balance is 0', async () => {
    mockDoc.mockImplementation((path: string) => ({
      get: () => Promise.resolve(
        path.includes('/credits/balance')
          ? makeCreditsSnap(0)
          : makeSessionSnap()
      ),
      update: mockDocUpdate,
      set: mockDocSet,
    }))

    const app = buildApp()
    const res = await request(app)
      .post('/session/start')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: 'sess1' })

    expect(res.status).toBe(402)
    expect(res.body.error).toBe('PAYMENT_REQUIRED')
    expect(res.body.message).toMatch(/genstadium\.com/)
    // Egress must NOT start when balance is zero
    expect(mockStartEgressA).not.toHaveBeenCalled()
  })

  it('starts Egress A and decrements credits when balance > 0', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/session/start')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: 'sess1' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'live', egressAId: 'egress-a-id' })
    expect(mockStartEgressA).toHaveBeenCalledWith('sess1')
    expect(mockWaitForEgressActive).toHaveBeenCalledWith('egress-a-id')
    // Credits decremented in transaction
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ balance: 1 }),
    )
  })

  it('returns already_live for idempotent re-call', async () => {
    mockDoc.mockImplementation((_path: string) => ({
      get: () => Promise.resolve(makeSessionSnap({ status: 'live' })),
      update: mockDocUpdate,
      set: mockDocSet,
    }))

    const app = buildApp()
    const res = await request(app)
      .post('/session/start')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: 'sess1' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('already_live')
    expect(mockStartEgressA).not.toHaveBeenCalled()
    expect(mockRunTransaction).not.toHaveBeenCalled()
  })

  it('returns 403 when caller is not the session creator', async () => {
    mockDoc.mockImplementation((_path: string) => ({
      get: () => Promise.resolve(makeSessionSnap({ createdBy: 'other-uid' })),
      update: mockDocUpdate,
      set: mockDocSet,
    }))

    const app = buildApp()
    const res = await request(app)
      .post('/session/start')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: 'sess1' })

    expect(res.status).toBe(403)
  })

  it('decrement only runs AFTER Egress A is ACTIVE', async () => {
    const callOrder: string[] = []
    mockStartEgressA.mockImplementationOnce(async () => {
      callOrder.push('egressA_started')
      return { egressId: 'egress-a-id' }
    })
    mockWaitForEgressActive.mockImplementationOnce(async () => {
      callOrder.push('egressA_active')
    })
    mockRunTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      callOrder.push('credits_decremented')
      const tx = { get: () => Promise.resolve(makeCreditsSnap(1)), set: mockDocSet }
      await fn(tx)
    })

    const app = buildApp()
    await request(app)
      .post('/session/start')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: 'sess1' })

    expect(callOrder).toEqual(['egressA_started', 'egressA_active', 'credits_decremented'])
  })

  it('returns 400 ISO_CAMERA_NOT_READY when ISO Camera is not in Room', async () => {
    mockListParticipants.mockResolvedValueOnce([]) // no participants

    const app = buildApp()
    const res = await request(app)
      .post('/session/start')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: 'sess1' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ISO_CAMERA_NOT_READY')
    expect(mockStartEgressA).not.toHaveBeenCalled()
  })

  it('uses ISO Camera video track ID for targeted Egress B', async () => {
    const app = buildApp()
    await request(app)
      .post('/session/start')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: 'sess1' })

    // startTrackCompositeEgress called with the ISO Camera's video track SID
    expect(mockStartTrackCompositeEgress).toHaveBeenCalledWith(
      'sess1',
      expect.anything(),
      expect.objectContaining({ videoTrackId: 'TR_cam1_video' }),
    )
  })

  it('stores Egress B ID at egressIds.b and sets replayCameraOnline true', async () => {
    const app = buildApp()
    await request(app)
      .post('/session/start')
      .set('Authorization', 'Bearer valid-token')
      .send({ sessionId: 'sess1' })

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'egressIds.b': 'egress-b-id', replayCameraOnline: true }),
    )
  })
})
