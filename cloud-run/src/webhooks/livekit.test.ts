// ── LiveKit SDK mocks ─────────────────────────────────────────────────────────
const mockStopEgress = jest.fn().mockResolvedValue(undefined)
const mockListEgress = jest.fn().mockResolvedValue([])
const mockStartTrackCompositeEgress = jest.fn().mockResolvedValue({ egressId: 'egress-b-new' })
const mockReceive = jest.fn()

jest.mock('livekit-server-sdk', () => ({
  EgressClient: jest.fn().mockImplementation(() => ({
    stopEgress: mockStopEgress,
    listEgress: mockListEgress,
    startTrackCompositeEgress: mockStartTrackCompositeEgress,
  })),
  WebhookReceiver: jest.fn().mockImplementation(() => ({
    receive: mockReceive,
  })),
  SegmentedFileOutput: jest.fn().mockImplementation((opts) => opts),
  SegmentedFileProtocol: { HLS_PROTOCOL: 1 },
  GCPUpload: jest.fn().mockImplementation((opts) => opts),
}))

// ── Firebase mock ─────────────────────────────────────────────────────────────
const mockDocUpdate = jest.fn().mockResolvedValue(undefined)
const mockDoc = jest.fn()

jest.mock('../lib/firebase', () => ({
  getDb: () => ({ doc: mockDoc }),
}))

import express from 'express'
import request from 'supertest'
import { registerLiveKitWebhook } from './livekit'

function buildApp() {
  const app = express()
  registerLiveKitWebhook(app)
  app.use(express.json())
  return app
}

function makeSessionSnap(data: Record<string, unknown>) {
  return { exists: true, data: () => data }
}

function makeWebhookBody(event: string, participantIdentity: string, roomName: string) {
  return JSON.stringify({ event, participant: { identity: participantIdentity }, room: { name: roomName } })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockDoc.mockImplementation((_path: string) => ({
    get: () => Promise.resolve(
      makeSessionSnap({
        status: 'live',
        replayCameraSlot: 'cam_1',
        egressIds: { b: 'egress-b-id' },
      }),
    ),
    update: mockDocUpdate,
  }))
})

describe('POST /webhooks/livekit', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/webhooks/livekit')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{}'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when webhook signature is invalid', async () => {
    mockReceive.mockRejectedValueOnce(new Error('bad signature'))
    const app = buildApp()
    const res = await request(app)
      .post('/webhooks/livekit')
      .set('Authorization', 'Bearer token')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{}'))
    expect(res.status).toBe(400)
  })

  describe('participant_left — replay Ingress', () => {
    it('auto-returns activeSource to previousSource when replay Ingress leaves', async () => {
      mockReceive.mockResolvedValueOnce({
        event: 'participant_left',
        participant: { identity: 'replay-clip-abc123' },
        room: { name: 'session-1' },
      })
      mockDoc.mockImplementation((_path: string) => ({
        get: () => Promise.resolve(makeSessionSnap({
          directorState: { activeSource: 'replay-clip-abc123', previousSource: 'cam_1' },
        })),
        update: mockDocUpdate,
      }))

      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from(makeWebhookBody('participant_left', 'replay-clip-abc123', 'session-1')))

      expect(res.status).toBe(200)
      expect(mockDocUpdate).toHaveBeenCalledWith({
        'directorState.activeSource': 'cam_1',
        'directorState.previousSource': null,
      })
    })
  })

  describe('participant_left — ISO Camera', () => {
    it('stops Egress B and writes replayCameraOnline=false when ISO Camera leaves', async () => {
      mockReceive.mockResolvedValueOnce({
        event: 'participant_left',
        participant: { identity: 'cam_1' },
        room: { name: 'session-1' },
      })

      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from(makeWebhookBody('participant_left', 'cam_1', 'session-1')))

      expect(res.status).toBe(200)
      expect(mockStopEgress).toHaveBeenCalledWith('egress-b-id')
      expect(mockDocUpdate).toHaveBeenCalledWith({ replayCameraOnline: false })
    })

    it('does not stop Egress B when a non-ISO Camera participant leaves', async () => {
      mockReceive.mockResolvedValueOnce({
        event: 'participant_left',
        participant: { identity: 'cam_2' },
        room: { name: 'session-1' },
      })

      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from(makeWebhookBody('participant_left', 'cam_2', 'session-1')))

      expect(res.status).toBe(200)
      expect(mockStopEgress).not.toHaveBeenCalled()
      expect(mockDocUpdate).not.toHaveBeenCalled()
    })

    it('skips Egress B stop when no egressIds.b stored yet', async () => {
      mockReceive.mockResolvedValueOnce({
        event: 'participant_left',
        participant: { identity: 'cam_1' },
        room: { name: 'session-1' },
      })
      mockDoc.mockImplementation((_path: string) => ({
        get: () => Promise.resolve(makeSessionSnap({
          replayCameraSlot: 'cam_1',
          // no egressIds
        })),
        update: mockDocUpdate,
      }))

      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from(makeWebhookBody('participant_left', 'cam_1', 'session-1')))

      expect(res.status).toBe(200)
      expect(mockStopEgress).not.toHaveBeenCalled()
      expect(mockDocUpdate).toHaveBeenCalledWith({ replayCameraOnline: false })
    })

    it('handles stopEgress failure gracefully (non-fatal)', async () => {
      mockReceive.mockResolvedValueOnce({
        event: 'participant_left',
        participant: { identity: 'cam_1' },
        room: { name: 'session-1' },
      })
      mockStopEgress.mockRejectedValueOnce(new Error('already stopped'))

      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from(makeWebhookBody('participant_left', 'cam_1', 'session-1')))

      expect(res.status).toBe(200)
      // Still marks offline even if stop failed
      expect(mockDocUpdate).toHaveBeenCalledWith({ replayCameraOnline: false })
    })
  })

  describe('participant_joined — ISO Camera reconnect', () => {
    function makeJoinedEvent(identity: string, roomName: string) {
      return {
        event: 'participant_joined',
        participant: { identity },
        room: { name: roomName },
      }
    }

    it('does nothing when joined participant is not ISO Camera', async () => {
      mockReceive.mockResolvedValueOnce(makeJoinedEvent('cam_2', 'session-1'))
      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('{}'))
      expect(res.status).toBe(200)
      expect(mockStartTrackCompositeEgress).not.toHaveBeenCalled()
      expect(mockDocUpdate).not.toHaveBeenCalled()
    })

    it('does nothing when session is not live', async () => {
      mockReceive.mockResolvedValueOnce(makeJoinedEvent('cam_1', 'session-1'))
      mockDoc.mockImplementation((_path: string) => ({
        get: () => Promise.resolve(makeSessionSnap({ replayCameraSlot: 'cam_1', status: 'lobby' })),
        update: mockDocUpdate,
      }))
      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('{}'))
      expect(res.status).toBe(200)
      expect(mockStartTrackCompositeEgress).not.toHaveBeenCalled()
    })

    it('skips restart when Egress B is already active (idempotency)', async () => {
      mockReceive.mockResolvedValueOnce(makeJoinedEvent('cam_1', 'session-1'))
      // listEgress returns the current Egress B as active
      mockListEgress.mockResolvedValueOnce([{ egressId: 'egress-b-id' }])
      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('{}'))
      expect(res.status).toBe(200)
      expect(mockStartTrackCompositeEgress).not.toHaveBeenCalled()
    })

    it('restarts Egress B and writes new egressIds.b + replayCameraOnline=true', async () => {
      mockReceive.mockResolvedValueOnce(makeJoinedEvent('cam_1', 'session-1'))
      mockListEgress.mockResolvedValueOnce([]) // no active egress
      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('{}'))
      expect(res.status).toBe(200)
      expect(mockStartTrackCompositeEgress).toHaveBeenCalledWith(
        'session-1',
        expect.anything(),
        expect.anything(),
      )
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ 'egressIds.b': 'egress-b-new', replayCameraOnline: true }),
      )
    })

    it('still writes replayCameraOnline=true if Egress B restart fails', async () => {
      mockReceive.mockResolvedValueOnce(makeJoinedEvent('cam_1', 'session-1'))
      mockListEgress.mockResolvedValueOnce([])
      mockStartTrackCompositeEgress.mockRejectedValueOnce(new Error('egress failed'))
      const app = buildApp()
      const res = await request(app)
        .post('/webhooks/livekit')
        .set('Authorization', 'Bearer token')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('{}'))
      expect(res.status).toBe(200)
      expect(mockDocUpdate).toHaveBeenCalledWith({ replayCameraOnline: true })
    })
  })
})
