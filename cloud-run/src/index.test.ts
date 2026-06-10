/**
 * index.ts — /health endpoint tests.
 *
 * Verifies Firestore + LiveKit dependency checks and degraded/ok responses.
 */
import request from 'supertest'

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('./lib/firebase', () => ({
  initAdminApp: jest.fn(),
  getDb: jest.fn(),
}))

jest.mock('livekit-server-sdk', () => ({
  RoomServiceClient: jest.fn(),
  EgressClient: jest.fn(),
  IngressClient: jest.fn(),
  WebhookReceiver: jest.fn().mockImplementation(() => ({
    receive: jest.fn().mockResolvedValue({}),
  })),
  IngressInput: {},
  GCPUpload: jest.fn(),
  SegmentedFileOutput: jest.fn(),
  SegmentedFileProtocol: {},
  TrackType: {},
}))

// Mock all route registers so we only test the health endpoint in isolation
jest.mock('./session/join', () => ({ registerJoinRoute: jest.fn() }))
jest.mock('./session/start', () => ({ registerStartRoute: jest.fn() }))
jest.mock('./session/end', () => ({ registerEndRoute: jest.fn() }))
jest.mock('./replay/prefetch', () => ({ registerPrefetchRoute: jest.fn() }))
jest.mock('./replay/inject', () => ({ registerInjectRoute: jest.fn() }))
jest.mock('./replay/broadcast', () => ({ registerBroadcastRoute: jest.fn() }))
jest.mock('./animation/render', () => ({ registerAnimationRoute: jest.fn() }))
jest.mock('./iap/verifyReceipt', () => ({ registerVerifyReceiptRoute: jest.fn() }))
jest.mock('./webhooks/livekit', () => ({ registerLiveKitWebhook: jest.fn() }))
jest.mock('./webhooks/stripe', () => ({ registerStripeWebhook: jest.fn() }))

import { getDb } from './lib/firebase'
import { RoomServiceClient } from 'livekit-server-sdk'
import app from './index'

const mockGet = jest.fn()
const mockDoc = jest.fn(() => ({ get: mockGet }))
const mockCollection = jest.fn(() => ({ doc: mockDoc }))
const mockListRooms = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ collection: mockCollection })
  ;(RoomServiceClient as jest.Mock).mockImplementation(() => ({ listRooms: mockListRooms }))
})

describe('GET /health', () => {
  it('returns 200 with status:ok when Firestore and LiveKit both pass', async () => {
    mockGet.mockResolvedValue({})
    mockListRooms.mockResolvedValue([])

    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.firebase).toBe('ok')
    expect(res.body.livekit).toBe('ok')
    expect(res.body.timestamp).toBeDefined()
  })

  it('returns 200 with status:degraded when Firestore fails', async () => {
    mockGet.mockRejectedValue(new Error('PERMISSION_DENIED'))
    mockListRooms.mockResolvedValue([])

    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('degraded')
    expect(res.body.firebase).toMatch(/error:/)
    expect(res.body.livekit).toBe('ok')
  })

  it('returns 200 with status:degraded when LiveKit fails', async () => {
    mockGet.mockResolvedValue({})
    mockListRooms.mockRejectedValue(new Error('invalid API key'))

    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('degraded')
    expect(res.body.firebase).toBe('ok')
    expect(res.body.livekit).toMatch(/error:/)
  })

  it('returns 200 with status:degraded when both services fail', async () => {
    mockGet.mockRejectedValue(new Error('Firestore unavailable'))
    mockListRooms.mockRejectedValue(new Error('LiveKit unreachable'))

    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('degraded')
    expect(res.body.firebase).toMatch(/error:/)
    expect(res.body.livekit).toMatch(/error:/)
  })

  it('never returns 500 — always 200', async () => {
    // Even with completely broken dependencies, health stays 200
    mockGet.mockRejectedValue(new Error('catastrophic failure'))
    mockListRooms.mockRejectedValue(new Error('catastrophic failure'))

    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
  })
})
