// ── LiveKit SDK mock ──────────────────────────────────────────────────────────
const mockCreateIngress = jest.fn().mockResolvedValue({ ingressId: 'ing-1' })

jest.mock('livekit-server-sdk', () => ({
  IngressClient: jest.fn().mockImplementation(() => ({
    createIngress: mockCreateIngress,
  })),
  IngressInput: { URL_INPUT: 4 },
}))

// ── Firebase Admin mocks ──────────────────────────────────────────────────────
const mockGetSignedUrl = jest.fn().mockResolvedValue(['https://signed.url/clip.mp4'])

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn().mockReturnValue({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        getSignedUrl: mockGetSignedUrl,
      }),
    }),
  }),
}))

const mockClipUpdate = jest.fn().mockResolvedValue(undefined)
const mockClipGet = jest.fn()
const mockDoc = jest.fn()

jest.mock('../lib/firebase', () => ({
  getDb: () => ({ doc: mockDoc }),
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__serverTimestamp__' },
}))

import express from 'express'
import request from 'supertest'
import { registerBroadcastRoute } from './broadcast'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((_req, res, next) => { res.locals.body = _req.body; next() })
  registerBroadcastRoute(app)
  return app
}

function makeClipSnap(gcsPath: string | undefined = 'gs://genstadium-prefetched/sess1/cam_1/1234567890.mp4') {
  return {
    exists: !!gcsPath,
    data: () => (gcsPath ? { gcsPath } : undefined),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockClipGet.mockResolvedValue(makeClipSnap())
  mockDoc.mockReturnValue({ get: mockClipGet, update: mockClipUpdate })
  mockGetSignedUrl.mockResolvedValue(['https://signed.url/clip.mp4'])
  mockCreateIngress.mockResolvedValue({ ingressId: 'ing-1' })
})

describe('POST /replay/broadcast', () => {
  it('returns 400 when required fields missing', async () => {
    const app = buildApp()
    const res = await request(app).post('/replay/broadcast').send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 when clip doc does not exist', async () => {
    mockClipGet.mockResolvedValueOnce({ exists: false, data: () => undefined })
    const app = buildApp()
    const res = await request(app)
      .post('/replay/broadcast')
      .send({ sessionId: 'sess1', clipId: 'cam_1-9999' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('CLIP_NOT_FOUND')
  })

  it('returns 404 when clip doc has no gcsPath', async () => {
    mockClipGet.mockResolvedValueOnce({ exists: true, data: () => ({}) })
    const app = buildApp()
    const res = await request(app)
      .post('/replay/broadcast')
      .send({ sessionId: 'sess1', clipId: 'cam_1-9999' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('CLIP_NOT_FOUND')
  })

  it('generates signed URL from clip gcsPath', async () => {
    const app = buildApp()
    await request(app)
      .post('/replay/broadcast')
      .send({ sessionId: 'sess1', clipId: 'cam_1-1234567890' })

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'read' }),
    )
  })

  it('creates Ingress with signed URL and replay-clip- identity', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/replay/broadcast')
      .send({ sessionId: 'sess1', clipId: 'cam_1-1234567890' })

    expect(res.status).toBe(200)
    expect(mockCreateIngress).toHaveBeenCalledWith(
      4, // IngressInput.URL_INPUT
      expect.objectContaining({
        roomName: 'sess1',
        participantIdentity: 'replay-clip-cam_1-1234567890',
        url: 'https://signed.url/clip.mp4',
      }),
    )
    expect(res.body.participantIdentity).toBe('replay-clip-cam_1-1234567890')
    expect(res.body.ingressId).toBe('ing-1')
  })

  it('writes ingressId and participantIdentity back to clip doc', async () => {
    const app = buildApp()
    await request(app)
      .post('/replay/broadcast')
      .send({ sessionId: 'sess1', clipId: 'cam_1-1234567890' })

    expect(mockClipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        ingressId: 'ing-1',
        participantIdentity: 'replay-clip-cam_1-1234567890',
      }),
    )
  })
})
