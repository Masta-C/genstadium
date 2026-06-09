/**
 * render.ts — POST /replay/animation endpoint.
 *
 * Renders a Remotion composition to MP4 using renderMedia() on Cloud Run.
 * ADR-003: renderMedia() is called ONLY here — never in browser code.
 * ADR-006: output streamed to GCS immediately after encode; never held in memory.
 *
 * Requires:
 *   - CHROMIUM_PATH env var (path to Chromium binary in Cloud Run container)
 *   - PREFETCH_BUCKET env var
 */

import path from 'path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { z } from 'zod'
import { getStorage } from 'firebase-admin/storage'
import { validate } from '../middleware/validate'
import type { Router, Request, Response } from 'express'

const PREFETCH_BUCKET = process.env.PREFETCH_BUCKET ?? 'genstadium-prefetched'
const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium'

// Remotion bundle entry — graphics/src/remotion/Root.tsx built by @remotion/bundler
const REMOTION_ENTRY = path.resolve(__dirname, '../../../../graphics/src/remotion/Root.tsx')

const AnimationSchema = z.object({
  sessionId: z.string().min(1),
  eventId: z.string().min(1),
  compositionId: z.enum(['GoalFlash', 'WicketAnimation', 'RedCard']),
  inputProps: z.record(z.string(), z.unknown()).optional(),
})

type AnimationBody = z.infer<typeof AnimationSchema>

async function animationHandler(req: Request, res: Response): Promise<void> {
  const { sessionId, eventId, compositionId, inputProps } = res.locals.body as AnimationBody

  // Bundle the Remotion entry (cached in production via filesystem)
  const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY, onProgress: () => undefined })

  // Select and validate the composition
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps: inputProps ?? {},
    browserExecutable: CHROMIUM_PATH,
  })

  // Render to temp file — never hold MP4 bytes in memory (ADR-006)
  const outputPath = `/tmp/${sessionId}-${eventId}-${compositionId}.mp4`
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: inputProps ?? {},
    browserExecutable: CHROMIUM_PATH,
  })

  // Stream-upload to GCS (no memory buffering)
  const gcsObjectPath = `${sessionId}/animations/${eventId}.mp4`
  const { createReadStream } = await import('fs')
  await new Promise<void>((resolve, reject) => {
    const writeStream = getStorage()
      .bucket(PREFETCH_BUCKET)
      .file(gcsObjectPath)
      .createWriteStream({ resumable: false, contentType: 'video/mp4' })
    createReadStream(outputPath).pipe(writeStream).on('finish', resolve).on('error', reject)
  })

  // Clean up temp file
  const { unlink } = await import('fs/promises')
  await unlink(outputPath).catch(() => undefined)

  res.json({
    gcsPath: `gs://${PREFETCH_BUCKET}/${gcsObjectPath}`,
    compositionId,
    durationSecs: composition.durationInFrames / composition.fps,
  })
}

export function registerAnimationRoute(router: Router): void {
  router.post('/replay/animation', validate(AnimationSchema), animationHandler)
}
