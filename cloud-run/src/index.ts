/**
 * index.ts — GenStadium Cloud Run Express app.
 *
 * All routes are JWT-verified via requireAuth middleware.
 * All POST/PATCH bodies are Zod-validated via validate() middleware.
 * Structured JSON error responses for all error paths.
 *
 * Local dev: npm run dev → http://localhost:8081
 */

import express, { NextFunction, Request, Response } from 'express'
import { RoomServiceClient } from 'livekit-server-sdk'
import { initAdminApp, getDb } from './lib/firebase'
import { registerJoinRoute } from './session/join'
import { registerStartRoute } from './session/start'
import { registerEndRoute } from './session/end'
import { registerPrefetchRoute } from './replay/prefetch'
import { registerInjectRoute } from './replay/inject'
import { registerBroadcastRoute } from './replay/broadcast'
import { registerAnimationRoute } from './animation/render'
import { registerVerifyReceiptRoute } from './iap/verifyReceipt'
import { registerLiveKitWebhook } from './webhooks/livekit'
import { registerStripeWebhook } from './webhooks/stripe'

// Initialise Firebase Admin SDK before any route handler uses it
initAdminApp()

const app = express()

// ---------------------------------------------------------------------------
// Webhook routes — MUST be before express.json() to receive raw body for HMAC
// ---------------------------------------------------------------------------
registerLiveKitWebhook(app)
registerStripeWebhook(app)

app.use(express.json())

// ---------------------------------------------------------------------------
// Health check — no auth required (Cloud Run health probe + uptime check)
// Checks real Firestore + LiveKit connectivity. Returns 200 always (never 500)
// so Cloud Run probe stays green. Returns status:"degraded" if a dep fails.
// ---------------------------------------------------------------------------
const HEALTH_TIMEOUT_MS = 5_000
const LIVEKIT_URL_HEALTH = process.env.LIVEKIT_URL ?? 'wss://localhost:7880'
const LIVEKIT_API_KEY_HEALTH = process.env.LIVEKIT_API_KEY ?? ''
const LIVEKIT_API_SECRET_HEALTH = process.env.LIVEKIT_API_SECRET ?? ''

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ])
}

app.get('/health', (_req: Request, res: Response) => {
  const db = getDb()
  const livekitClient = new RoomServiceClient(
    LIVEKIT_URL_HEALTH,
    LIVEKIT_API_KEY_HEALTH,
    LIVEKIT_API_SECRET_HEALTH,
  )

  const firebaseCheck = withTimeout(
    db.collection('_health').doc('ping').get().then(() => 'ok' as const),
    HEALTH_TIMEOUT_MS,
  ).catch((err: Error) => `error: ${err.message}`)

  const livekitCheck = withTimeout(
    livekitClient.listRooms().then(() => 'ok' as const),
    HEALTH_TIMEOUT_MS,
  ).catch((err: Error) => `error: ${err.message}`)

  void Promise.all([firebaseCheck, livekitCheck]).then(([firebase, livekit]) => {
    const allOk = firebase === 'ok' && livekit === 'ok'
    res.status(200).json({
      status: allOk ? 'ok' : 'degraded',
      firebase,
      livekit,
      timestamp: new Date().toISOString(),
    })
  })
})

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
registerStartRoute(app)
registerJoinRoute(app)
registerEndRoute(app)
registerPrefetchRoute(app)
registerInjectRoute(app)
registerBroadcastRoute(app)
registerAnimationRoute(app)
registerVerifyReceiptRoute(app)

// ---------------------------------------------------------------------------
// Global error handler — converts unhandled errors to structured JSON
// ---------------------------------------------------------------------------
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[cloud-run] unhandled error:', err)
  const message =
    err instanceof Error ? err.message : 'Internal server error'
  res.status(500).json({ error: 'INTERNAL_ERROR', message })
})

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT ?? 8081
app.listen(PORT, () => {
  console.log(`[cloud-run] listening on :${PORT}`)
})

export default app
