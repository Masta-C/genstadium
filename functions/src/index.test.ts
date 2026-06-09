import { handlePrefetchTrigger, handleAnimationTrigger } from './index'

// Mock firebase-admin before import
jest.mock('firebase-admin', () => {
  const firestoreMock = {
    doc: jest.fn(),
  }
  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => firestoreMock),
    apps: [],
  }
})

jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: jest.fn(),
}))

import * as admin from 'firebase-admin'

const mockDoc = admin.firestore().doc as jest.Mock

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({ ok: true } as Response)
  mockDoc.mockReturnValue({
    get: jest.fn().mockResolvedValue({
      data: () => ({ replayCameraSlot: 'cam_1' }),
    }),
  })
})

describe('handlePrefetchTrigger', () => {
  it('does nothing when triggers does not include prefetch', async () => {
    await handlePrefetchTrigger('sess1', { triggers: ['animation'] }, 'http://cloud-run')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does nothing when triggers is absent', async () => {
    await handlePrefetchTrigger('sess1', {}, 'http://cloud-run')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls /replay/prefetch when triggers includes prefetch', async () => {
    await handlePrefetchTrigger(
      'sess1',
      { triggers: ['prefetch'], timestamp: { toMillis: () => 1_000_000 } as admin.firestore.Timestamp },
      'http://cloud-run',
    )

    expect(mockFetch).toHaveBeenCalledWith('http://cloud-run/replay/prefetch', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ sessionId: 'sess1', cameraId: 'cam_1', eventTimestamp: 1_000_000 })
  })

  it('reads replayCameraSlot from session doc', async () => {
    mockDoc.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        data: () => ({ replayCameraSlot: 'cam_3' }),
      }),
    })

    await handlePrefetchTrigger('sess1', { triggers: ['prefetch'] }, 'http://cloud-run')

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.cameraId).toBe('cam_3')
  })

  it('falls back to cam_1 if replayCameraSlot is absent', async () => {
    mockDoc.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        data: () => ({}),
      }),
    })

    await handlePrefetchTrigger('sess1', { triggers: ['prefetch'] }, 'http://cloud-run')

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.cameraId).toBe('cam_1')
  })

  it('swallows fetch errors without throwing', async () => {
    mockFetch.mockRejectedValue(new Error('network failure'))
    await expect(
      handlePrefetchTrigger('sess1', { triggers: ['prefetch'] }, 'http://cloud-run'),
    ).resolves.not.toThrow()
  })
})

describe('handleAnimationTrigger', () => {
  it('does nothing when triggers does not include animation', async () => {
    await handleAnimationTrigger('sess1', 'evt1', { triggers: ['prefetch'], eventType: 'goal' }, 'http://cloud-run')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does nothing when triggers is absent', async () => {
    await handleAnimationTrigger('sess1', 'evt1', {}, 'http://cloud-run')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls /replay/animation with sessionId, eventId, eventType when triggers includes animation', async () => {
    await handleAnimationTrigger(
      'sess1',
      'evt1',
      { triggers: ['animation'], eventType: 'goal' },
      'http://cloud-run',
    )

    expect(mockFetch).toHaveBeenCalledWith('http://cloud-run/replay/animation', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({ sessionId: 'sess1', eventId: 'evt1', eventType: 'goal' })
  })

  it('swallows fetch errors without throwing', async () => {
    mockFetch.mockRejectedValue(new Error('network failure'))
    await expect(
      handleAnimationTrigger('sess1', 'evt1', { triggers: ['animation'], eventType: 'goal' }, 'http://cloud-run'),
    ).resolves.not.toThrow()
  })
})
