import { filterByWindow, getUsableSegments } from './dvr'
import type { DvrSegment } from './dvr'

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(),
}))

import { getStorage } from 'firebase-admin/storage'

const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>

describe('filterByWindow', () => {
  const now = 1_000_000

  it('returns segments at or after the 120-second cutoff', () => {
    const segments: DvrSegment[] = [
      { gcsPath: 'gs://b/a.ts', timestampSec: now - 121 }, // too old
      { gcsPath: 'gs://b/b.ts', timestampSec: now - 120 }, // exactly at boundary — included
      { gcsPath: 'gs://b/c.ts', timestampSec: now - 119 }, // in window
      { gcsPath: 'gs://b/d.ts', timestampSec: now },        // newest
    ]
    const result = filterByWindow(segments, now)
    expect(result.map((s) => s.timestampSec)).toEqual([now - 120, now - 119, now])
  })

  it('returns empty array when all segments are outside the window', () => {
    const segments: DvrSegment[] = [
      { gcsPath: 'gs://b/a.ts', timestampSec: now - 200 },
      { gcsPath: 'gs://b/b.ts', timestampSec: now - 300 },
    ]
    expect(filterByWindow(segments, now)).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(filterByWindow([], now)).toEqual([])
  })

  it('sorts results oldest-first', () => {
    const segments: DvrSegment[] = [
      { gcsPath: 'gs://b/c.ts', timestampSec: now - 10 },
      { gcsPath: 'gs://b/a.ts', timestampSec: now - 50 },
      { gcsPath: 'gs://b/b.ts', timestampSec: now - 30 },
    ]
    const result = filterByWindow(segments, now)
    expect(result.map((s) => s.timestampSec)).toEqual([now - 50, now - 30, now - 10])
  })

  it('respects a custom windowSec value', () => {
    const segments: DvrSegment[] = [
      { gcsPath: 'gs://b/a.ts', timestampSec: now - 50 }, // outside 30s window
      { gcsPath: 'gs://b/b.ts', timestampSec: now - 10 }, // inside
    ]
    const result = filterByWindow(segments, now, 30)
    expect(result).toHaveLength(1)
    expect(result[0].timestampSec).toBe(now - 10)
  })
})

describe('getUsableSegments', () => {
  function mockBucket(fileNames: string[]) {
    const mockGetFiles = jest.fn().mockResolvedValue([
      fileNames.map((name) => ({ name })),
    ])
    mockGetStorage.mockReturnValue({
      bucket: () => ({ getFiles: mockGetFiles }),
    } as unknown as ReturnType<typeof getStorage>)
    return mockGetFiles
  }

  it('returns segments within the 120-second window', async () => {
    const now = 2_000_000
    mockBucket([
      `dvr/sess1/cam_1/${now - 60}.ts`,
      `dvr/sess1/cam_1/${now - 130}.ts`, // outside window
      `dvr/sess1/cam_1/${now - 10}.ts`,
    ])

    const result = await getUsableSegments('sess1', 'cam_1', now)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.timestampSec)).toEqual([now - 60, now - 10])
  })

  it('passes the correct GCS prefix when listing', async () => {
    const now = 2_000_000
    const mockGetFiles = mockBucket([`dvr/sess1/cam_2/${now - 5}.ts`])

    await getUsableSegments('sess1', 'cam_2', now)
    expect(mockGetFiles).toHaveBeenCalledWith({ prefix: 'dvr/sess1/cam_2/' })
  })

  it('includes full gs:// path in returned segments', async () => {
    const now = 2_000_000
    mockBucket([`dvr/sess1/cam_1/${now - 10}.ts`])

    const result = await getUsableSegments('sess1', 'cam_1', now)
    expect(result[0].gcsPath).toBe(`gs://genstadium-dvr/dvr/sess1/cam_1/${now - 10}.ts`)
  })

  it('ignores non-segment files such as playlist.m3u8', async () => {
    const now = 2_000_000
    mockBucket([
      `dvr/sess1/cam_1/${now - 10}.ts`,
      `dvr/sess1/cam_1/index.m3u8`,
    ])

    const result = await getUsableSegments('sess1', 'cam_1', now)
    expect(result).toHaveLength(1)
  })

  it('returns empty array when no segments exist', async () => {
    mockBucket([])
    const result = await getUsableSegments('sess1', 'cam_1', 2_000_000)
    expect(result).toEqual([])
  })
})
