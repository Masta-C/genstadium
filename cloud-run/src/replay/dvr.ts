/**
 * dvr.ts — DVR segment access helpers for the replay engine.
 *
 * The ISO Camera track is recorded by Egress B as 4-second HLS segments at:
 *   gs://{DVR_BUCKET}/dvr/{sessionId}/{cameraId}/{segmentTimestamp}.ts
 *
 * ADR-006: the 120-second rolling window is enforced here in code.
 * The GCS object lifecycle (1 day) is a safety net only — never rely on it
 * for the window. GCS lifecycle minimum granularity is ~1 day, not seconds.
 */

import { getStorage } from 'firebase-admin/storage'

const DVR_BUCKET = process.env.DVR_BUCKET ?? 'genstadium-dvr'

/** A single DVR segment within the rolling buffer. */
export interface DvrSegment {
  /** Full GCS path, e.g. gs://genstadium-dvr/dvr/sess1/cam_1/1718900000.ts */
  gcsPath: string
  /** Unix timestamp in seconds, parsed from the segment filename. */
  timestampSec: number
}

/**
 * Lists all DVR segments for the given camera and returns only those within
 * the last 120 seconds. Segments outside the window are ignored even if they
 * still exist in GCS. Results are sorted oldest-first.
 *
 * @param sessionId - Firestore session ID (also the LiveKit room name)
 * @param cameraId  - Camera slot identity (e.g. "cam_1")
 * @param nowSec    - Override for current time in Unix seconds (default: Date.now()/1000)
 */
export async function getUsableSegments(
  sessionId: string,
  cameraId: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<DvrSegment[]> {
  const prefix = `dvr/${sessionId}/${cameraId}/`
  const [files] = await getStorage().bucket(DVR_BUCKET).getFiles({ prefix })

  const parsed: DvrSegment[] = files
    .map((f) => {
      const basename = f.name.split('/').pop() ?? ''
      const ts = parseInt(basename.replace('.ts', ''), 10)
      return { gcsPath: `gs://${DVR_BUCKET}/${f.name}`, timestampSec: ts }
    })
    .filter((s) => Number.isFinite(s.timestampSec))

  return filterByWindow(parsed, nowSec)
}

/**
 * Pure filter: returns segments with timestampSec >= (nowSec - windowSec), sorted oldest-first.
 * Exported for unit testing without GCS dependency.
 */
export function filterByWindow(
  segments: DvrSegment[],
  nowSec: number,
  windowSec: number = 120,
): DvrSegment[] {
  const cutoff = nowSec - windowSec
  return segments
    .filter((s) => s.timestampSec >= cutoff)
    .sort((a, b) => a.timestampSec - b.timestampSec)
}
