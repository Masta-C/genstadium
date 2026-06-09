/**
 * prefetch.ts — POST /replay/prefetch endpoint.
 *
 * Triggered by the replayPrefetchTrigger Cloud Function when a scoring event
 * has triggers:['prefetch']. Encodes the last 20 seconds of the ISO Camera
 * DVR buffer into an MP4 clip and writes it directly to GCS.
 *
 * ADR-006: never buffer the encoded clip in Cloud Run memory — write to GCS
 * via a streaming upload immediately after FFmpeg writes to a temp file.
 * Temp files live in /tmp/ (ephemeral disk, not RAM).
 */

import { spawn } from 'child_process'
import { createReadStream } from 'fs'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { validate } from '../middleware/validate'
import { getDb } from '../lib/firebase'
import { getUsableSegments } from './dvr'
import type { Router, Request, Response } from 'express'

const DVR_BUCKET = process.env.DVR_BUCKET ?? 'genstadium-dvr'
const PREFETCH_BUCKET = process.env.PREFETCH_BUCKET ?? 'genstadium-prefetched'
const CLIP_DURATION_SEC = 20

const PrefetchSchema = z.object({
  sessionId: z.string().min(1),
  cameraId: z.string().min(1),
  eventTimestamp: z.number().int().positive(), // Unix ms
  eventId: z.string().optional(),
})

type PrefetchBody = z.infer<typeof PrefetchSchema>

/** Downloads a GCS object to a local path using a write stream (no memory buffering). */
async function downloadSegment(objectName: string, localPath: string): Promise<void> {
  await getStorage().bucket(DVR_BUCKET).file(objectName).download({ destination: localPath })
}

/** Strips gs://bucket/ prefix to get the GCS object name. */
function objectName(gcsPath: string, bucket: string): string {
  return gcsPath.replace(`gs://${bucket}/`, '')
}

/** Runs FFmpeg concat → MP4. Resolves when FFmpeg exits 0, rejects on error. */
function encodeToMp4(concatListPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ])
    const stderr: string[] = []
    proc.stderr.on('data', (d: Buffer) => stderr.push(d.toString()))
    proc.on('error', (err) => reject(new Error(`FFmpeg spawn failed: ${err.message}`)))
    proc.on('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-5).join('')}`))
    })
  })
}

/** Streams a local file to GCS without loading it into memory (ADR-006). */
function uploadToGcs(localPath: string, gcsObjectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = getStorage()
      .bucket(PREFETCH_BUCKET)
      .file(gcsObjectPath)
      .createWriteStream({ resumable: false, contentType: 'video/mp4' })

    createReadStream(localPath)
      .pipe(writeStream)
      .on('finish', resolve)
      .on('error', reject)
  })
}

async function prefetchHandler(req: Request, res: Response): Promise<void> {
  const body = res.locals.body as PrefetchBody
  const { sessionId, cameraId, eventTimestamp, eventId } = body
  const eventSec = Math.floor(eventTimestamp / 1000)

  // Get DVR segments within the last 120s window, then select the 20s clip
  const allSegments = await getUsableSegments(sessionId, cameraId, eventSec)
  const clipStartSec = eventSec - CLIP_DURATION_SEC
  const clipSegments = allSegments.filter((s) => s.timestampSec >= clipStartSec)

  if (clipSegments.length === 0) {
    res.status(404).json({ error: 'NO_SEGMENTS', message: 'No DVR segments available for clip' })
    return
  }

  const tmpDir = await mkdtemp(join('/tmp', `replay-${sessionId.slice(0, 8)}-`))
  try {
    // Download segments to temp dir (streaming, not buffered)
    const localPaths: string[] = []
    for (const seg of clipSegments) {
      const localPath = join(tmpDir, `${seg.timestampSec}.ts`)
      await downloadSegment(objectName(seg.gcsPath, DVR_BUCKET), localPath)
      localPaths.push(localPath)
    }

    // Write concat demuxer list
    const concatListPath = join(tmpDir, 'concat.txt')
    await writeFile(concatListPath, localPaths.map((p) => `file '${p}'`).join('\n'))

    // Encode
    const outputPath = join(tmpDir, 'clip.mp4')
    await encodeToMp4(concatListPath, outputPath)

    // Stream-upload to GCS (no memory buffering — ADR-006)
    const gcsObjectPath = `${sessionId}/${cameraId}/${eventTimestamp}.mp4`
    await uploadToGcs(outputPath, gcsObjectPath)

    // Write clip metadata to Firestore
    const clipId = `${cameraId}-${eventTimestamp}`
    const db = getDb()
    await db
      .collection('sessions')
      .doc(sessionId)
      .collection('replayClips')
      .doc(clipId)
      .set({
        gcsPath: `gs://${PREFETCH_BUCKET}/${gcsObjectPath}`,
        ...(eventId ? { eventId } : {}),
        duration: CLIP_DURATION_SEC,
        status: 'ready',
        createdAt: FieldValue.serverTimestamp(),
      })

    res.json({ clipId, gcsPath: `gs://${PREFETCH_BUCKET}/${gcsObjectPath}` })
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

export function registerPrefetchRoute(router: Router): void {
  router.post('/replay/prefetch', validate(PrefetchSchema), prefetchHandler)
}
