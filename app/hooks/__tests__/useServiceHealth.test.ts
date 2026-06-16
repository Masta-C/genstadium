import React, { act } from 'react'
import { create } from 'react-test-renderer'
import { getDocs } from 'firebase/firestore'
import { useServiceHealth } from '../useServiceHealth'

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  query: jest.fn(),
}))

jest.mock('../../lib/firebase/client', () => ({ db: {} }))

const mockFetch = jest.fn()
global.fetch = mockFetch

function TestComponent() {
  useServiceHealth()
  return null
}

function healthResponse(
  status: string,
  firebase: string = 'ok',
  livekit: string = 'ok',
) {
  return Promise.resolve({
    json: () => Promise.resolve({ status, firebase, livekit }),
  } as Response)
}

beforeEach(() => {
  jest.useFakeTimers()
  mockFetch.mockReset()
  ;(getDocs as jest.Mock).mockReset()
})

afterEach(() => {
  jest.useRealTimers()
})

test('returns checking initially then ok when all deps healthy', async () => {
  ;(getDocs as jest.Mock).mockResolvedValue({})
  mockFetch.mockReturnValue(healthResponse('ok'))

  let result!: ReturnType<typeof useServiceHealth>
  function Capture() {
    result = useServiceHealth()
    return null
  }

  await act(async () => {
    create(React.createElement(Capture))
  })

  expect(result.firebase).toBe('ok')
  expect(result.cloudRun).toBe('ok')
  expect(result.livekit).toBe('ok')
  expect(result.cloudRunError).toBeUndefined()
})

test('firebase error when Firestore throws', async () => {
  ;(getDocs as jest.Mock).mockRejectedValue(new Error('permission-denied'))
  mockFetch.mockReturnValue(healthResponse('ok'))

  let result!: ReturnType<typeof useServiceHealth>
  function Capture() {
    result = useServiceHealth()
    return null
  }

  await act(async () => {
    create(React.createElement(Capture))
  })

  expect(result.firebase).toBe('error')
  expect(result.cloudRun).toBe('ok')
})

test('cloudRun + livekit error when /health returns degraded', async () => {
  ;(getDocs as jest.Mock).mockResolvedValue({})
  mockFetch.mockReturnValue(healthResponse('degraded', 'ok', 'error: timeout after 5000ms'))

  let result!: ReturnType<typeof useServiceHealth>
  function Capture() {
    result = useServiceHealth()
    return null
  }

  await act(async () => {
    create(React.createElement(Capture))
  })

  expect(result.cloudRun).toBe('error')
  expect(result.livekit).toBe('error')
  expect(result.cloudRunError).toContain('LiveKit')
})

test('cloudRun + livekit error when fetch throws', async () => {
  ;(getDocs as jest.Mock).mockResolvedValue({})
  mockFetch.mockRejectedValue(new Error('Network request failed'))

  let result!: ReturnType<typeof useServiceHealth>
  function Capture() {
    result = useServiceHealth()
    return null
  }

  await act(async () => {
    create(React.createElement(Capture))
  })

  expect(result.cloudRun).toBe('error')
  expect(result.livekit).toBe('error')
  expect(result.cloudRunError).toBe('Network request failed')
})

test('schedules retry after 30s when any service errored', async () => {
  ;(getDocs as jest.Mock).mockResolvedValue({})
  mockFetch.mockReturnValue(healthResponse('degraded', 'ok', 'error: timeout'))

  await act(async () => {
    create(React.createElement(TestComponent))
  })

  // Second call should fire after 30s
  ;(getDocs as jest.Mock).mockResolvedValue({})
  mockFetch.mockReturnValue(healthResponse('ok'))

  await act(async () => {
    jest.advanceTimersByTime(30_000)
    await Promise.resolve()
  })

  expect(mockFetch).toHaveBeenCalledTimes(2)
})
