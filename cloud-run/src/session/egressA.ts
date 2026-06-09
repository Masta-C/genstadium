/**
 * egressA.ts — Egress A configuration and start helper.
 *
 * Egress A = Room Composite → YouTube RTMPS (or GCS file fallback).
 * Layout page at https://graphics.genstadium.com composites overlays over
 * active camera feed. sessionId is passed as the ?layout= query param so
 * the layout page subscribes to the correct Firestore session.
 *
 * Stream key read from sessions/{sessionId}/private/youtubeStreamKey.
 * If livestreamEnabled=false (Director skipped YouTube), writes to GCS instead.
 *
 * Egress A ID stored at sessions/{sessionId}.egressAId after start.
 */

import { EgressClient, EncodedFileOutput, EncodedFileType, GCPUpload, StreamOutput, StreamProtocol } from 'livekit-server-sdk'
import type { EgressInfo } from 'livekit-server-sdk'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '../lib/firebase'

const LIVEKIT_HOST = process.env.LIVEKIT_URL ?? 'wss://localhost:7880'
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? ''
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? ''
const LAYOUT_BASE_URL = 'https://graphics.genstadium.com'
const GCS_BUCKET = process.env.GCS_BUCKET ?? 'genstadium-recordings'

export async function startEgressA(sessionId: string): Promise<EgressInfo> {
  const db = getDb()
  const egressClient = new EgressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

  // Read session to determine if YouTube is configured
  const sessionRef = db.doc(`sessions/${sessionId}`)
  const sessionSnap = await sessionRef.get()
  if (!sessionSnap.exists) {
    throw new Error(`Session ${sessionId} not found`)
  }
  const sessionData = sessionSnap.data()!
  const livestreamEnabled = sessionData.livestreamEnabled !== false

  let egressA: EgressInfo

  if (livestreamEnabled) {
    // Read stream key from private sub-document (Director-only rules)
    const privateSnap = await db.doc(`sessions/${sessionId}/private/youtubeStreamKey`).get()
    const streamKey = privateSnap.exists ? (privateSnap.data()?.key as string | undefined) : undefined

    if (!streamKey) {
      throw new Error('YouTube stream key not configured. Use golive with YouTubeStreamKey or skip to record-only.')
    }

    egressA = await egressClient.startRoomCompositeEgress(
      sessionId,
      new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [`rtmps://a.rtmp.youtube.com/live2/${streamKey}`],
      }),
      { customBaseUrl: LAYOUT_BASE_URL, layout: sessionId },
    )
  } else {
    // File fallback: record to GCS when YouTube is not connected (ADR-007)
    egressA = await egressClient.startRoomCompositeEgress(
      sessionId,
      new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: `recordings/${sessionId}/stream.mp4`,
        output: {
          case: 'gcp',
          value: new GCPUpload({ bucket: GCS_BUCKET }),
        },
      }),
      { customBaseUrl: LAYOUT_BASE_URL, layout: sessionId },
    )
  }

  // Store Egress A ID for later use (stop, status checks)
  await sessionRef.update({
    egressAId: egressA.egressId,
    updatedAt: FieldValue.serverTimestamp(),
  })

  return egressA
}

export async function waitForEgressActive(
  egressId: string,
  timeoutMs = 8_000,
): Promise<void> {
  const egressClient = new EgressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  const deadline = Date.now() + timeoutMs
  const POLL_INTERVAL = 500

  while (Date.now() < deadline) {
    const egresses = await egressClient.listEgress({ egressId })
    const egress = egresses[0]
    if (!egress) throw new Error(`Egress ${egressId} not found`)

    // EgressStatus.EGRESS_ACTIVE = 1
    if (egress.status === 1) return

    // EgressStatus.EGRESS_FAILED = 4 or higher = terminal error states
    if (egress.status >= 4) {
      throw new Error(`Egress ${egressId} failed with status ${egress.status}: ${egress.error}`)
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
  }

  throw new Error(`Egress ${egressId} did not become ACTIVE within ${timeoutMs}ms`)
}
