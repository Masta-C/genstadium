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

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(),
}))

// Mock dynamic imports
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
  mkdtemp: jest.fn(),
  writeFile: jest.fn(),
  rm: jest.fn(),
}))

import { renderMedia, selectComposition } from '@remotion/renderer'
import { bundle } from '@remotion/bundler'
import { getStorage } from 'firebase-admin/storage'

const mockRenderMedia = renderMedia as jest.MockedFunction<typeof renderMedia>
const mockSelectComposition = selectComposition as jest.MockedFunction<typeof selectComposition>
const mockBundle = bundle as jest.MockedFunction<typeof bundle>
const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>

function mockStorageBucket() {
  const mockCreateWriteStream = jest.fn().mockReturnValue({
    on: jest.fn().mockImplementation(function (this: unknown, event: string, cb: () => void) {
      if (event === 'finish') cb()
      return this
    }),
  })
  mockGetStorage.mockReturnValue({
    bucket: () => ({ file: () => ({ createWriteStream: mockCreateWriteStream }) }),
  } as unknown as ReturnType<typeof getStorage>)
  return mockCreateWriteStream
}

import express from 'express'
import request from 'supertest'
import { registerAnimationRoute } from './render'

// Minimal express app for testing
function buildApp() {
  const app = express()
  app.use(express.json())
  // Inject empty res.locals.body via middleware to simulate validate()
  app.use((_req, res, next) => {
    res.locals.body = _req.body
    next()
  })
  registerAnimationRoute(app)
  return app
}

beforeEach(() => {
  jest.clearAllMocks()
  mockStorageBucket()
})

describe('POST /replay/animation', () => {
  it('calls renderMedia with GoalFlash composition and returns gcsPath', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/replay/animation')
      .send({ sessionId: 'sess1', eventId: 'evt1', compositionId: 'GoalFlash' })

    expect(res.status).toBe(200)
    expect(res.body.gcsPath).toMatch(/gs:\/\/genstadium-prefetched\/sess1\/animations\/evt1\.mp4/)
    expect(mockBundle).toHaveBeenCalledTimes(1)
    expect(mockSelectComposition).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'GoalFlash' }),
    )
    expect(mockRenderMedia).toHaveBeenCalledWith(
      expect.objectContaining({ codec: 'h264' }),
    )
  })

  it('rejects unknown compositionId with 400', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/replay/animation')
      .send({ sessionId: 's', eventId: 'e', compositionId: 'Unknown' })
    expect(res.status).toBe(400)
  })

  it('passes inputProps to selectComposition and renderMedia', async () => {
    const app = buildApp()
    await request(app)
      .post('/replay/animation')
      .send({
        sessionId: 's',
        eventId: 'e',
        compositionId: 'RedCard',
        inputProps: { playerName: 'J. Smith', teamName: 'Home' },
      })

    expect(mockSelectComposition).toHaveBeenCalledWith(
      expect.objectContaining({ inputProps: { playerName: 'J. Smith', teamName: 'Home' } }),
    )
  })
})
