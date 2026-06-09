// ── LiveKit SDK mock ──────────────────────────────────────────────────────────
const mockCreateIngress = jest.fn().mockResolvedValue({ ingressId: 'ing-1' })

jest.mock('livekit-server-sdk', () => ({
  IngressClient: jest.fn().mockImplementation(() => ({
    createIngress: mockCreateIngress,
  })),
  IngressInput: { URL_INPUT: 4 },
}))

jest.mock('@remotion/bundler', () => ({
  bundle: jest.fn().mockResolvedValue('http://localhost:3000'),
}))

jest.mock('@remotion/renderer', () => ({
  renderMedia: jest.fn().mockResolvedValue(undefined),
  selectComposition: jest.fn().mockResolvedValue({
    id: 'GoalFlash',
    durationInFrames: 90,
    fps: 30,
    width: 1920,
    height: 1080,
    defaultProps: {},
  }),
}))

// ── Firebase Admin mocks ──────────────────────────────────────────────────────
const mockGetSignedUrl = jest.fn().mockResolvedValue(['https://signed.url/anim.mp4'])
const mockCreateWriteStream = jest.fn().mockReturnValue({
  on: jest.fn().mockImplementation(function (this: unknown, event: string, cb: () => void) {
    if (event === 'finish') cb()
    return this
  }),
})

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn().mockReturnValue({
    bucket: jest.fn().mockReturnValue({
      file: jest.fn().mockReturnValue({
        createWriteStream: mockCreateWriteStream,
        getSignedUrl: mockGetSignedUrl,
      }),
    }),
  }),
}))

const mockDocUpdate = jest.fn().mockResolvedValue(undefined)
const mockDoc = jest.fn()

jest.mock('../lib/firebase', () => ({
  getDb: () => ({ doc: mockDoc }),
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__serverTimestamp__' },
}))

// ── fs mocks ──────────────────────────────────────────────────────────────────
jest.mock('fs', () => ({
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function (this: unknown, event: string, cb: () => void) {
      if (event === 'finish') cb()
      return this
    }),
  }),
}))

jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}))

import { renderMedia, selectComposition } from '@remotion/renderer'
import { bundle } from '@remotion/bundler'

const mockRenderMedia = renderMedia as jest.MockedFunction<typeof renderMedia>
const mockSelectComposition = selectComposition as jest.MockedFunction<typeof selectComposition>
const mockBundle = bundle as jest.MockedFunction<typeof bundle>

import express from 'express'
import request from 'supertest'
import { registerAnimationRoute } from './render'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((_req, res, next) => { res.locals.body = _req.body; next() })
  registerAnimationRoute(app)
  return app
}

function makeSessionSnap(activeSource: string | null = 'cam_1') {
  return {
    exists: true,
    data: () => ({ directorState: { activeSource } }),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockDoc.mockReturnValue({
    get: jest.fn().mockResolvedValue(makeSessionSnap('cam_1')),
    update: mockDocUpdate,
  })
  mockGetSignedUrl.mockResolvedValue(['https://signed.url/anim.mp4'])
  mockCreateIngress.mockResolvedValue({ ingressId: 'ing-1' })
  mockCreateWriteStream.mockReturnValue({
    on: jest.fn().mockImplementation(function (this: unknown, event: string, cb: () => void) {
      if (event === 'finish') cb()
      return this
    }),
  })
})

describe('POST /replay/animation', () => {
  it('renders GoalFlash for eventType=goal and returns gcsPath + participantIdentity', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/replay/animation')
      .send({ sessionId: 'sess1', eventId: 'evt1', eventType: 'goal' })

    expect(res.status).toBe(200)
    expect(res.body.gcsPath).toMatch(/gs:\/\/genstadium-prefetched\/sess1\/animations\/evt1\.mp4/)
    expect(res.body.compositionId).toBe('GoalFlash')
    expect(res.body.participantIdentity).toBe('replay-clip-evt1')
    expect(mockBundle).toHaveBeenCalledTimes(1)
    expect(mockSelectComposition).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'GoalFlash' }),
    )
    expect(mockRenderMedia).toHaveBeenCalledWith(
      expect.objectContaining({ codec: 'h264' }),
    )
  })

  it('returns skipped:true for unmapped eventType', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/replay/animation')
      .send({ sessionId: 's', eventId: 'e', eventType: 'corner' })

    expect(res.status).toBe(200)
    expect(res.body.skipped).toBe(true)
    expect(mockBundle).not.toHaveBeenCalled()
    expect(mockCreateIngress).not.toHaveBeenCalled()
  })

  it('rejects missing required fields with 400', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/replay/animation')
      .send({ sessionId: 's' }) // missing eventId, eventType
    expect(res.status).toBe(400)
  })

  it('passes inputProps to selectComposition and renderMedia', async () => {
    const app = buildApp()
    await request(app)
      .post('/replay/animation')
      .send({
        sessionId: 's',
        eventId: 'e',
        eventType: 'goal',
        inputProps: { playerName: 'J. Smith' },
      })

    expect(mockSelectComposition).toHaveBeenCalledWith(
      expect.objectContaining({ inputProps: { playerName: 'J. Smith' } }),
    )
  })

  it('creates Ingress with signed URL and replay-clip- identity', async () => {
    const app = buildApp()
    await request(app)
      .post('/replay/animation')
      .send({ sessionId: 'sess1', eventId: 'evt1', eventType: 'goal' })

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'read' }),
    )
    expect(mockCreateIngress).toHaveBeenCalledWith(
      4, // IngressInput.URL_INPUT
      expect.objectContaining({
        roomName: 'sess1',
        participantIdentity: 'replay-clip-evt1',
        url: 'https://signed.url/anim.mp4',
      }),
    )
  })

  it('updates Firestore activeSource and saves previousSource for auto-return', async () => {
    const app = buildApp()
    await request(app)
      .post('/replay/animation')
      .send({ sessionId: 'sess1', eventId: 'evt1', eventType: 'goal' })

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        'directorState.activeSource': 'replay-clip-evt1',
        'directorState.previousSource': 'cam_1',
      }),
    )
  })
})
