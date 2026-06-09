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
import { initAdminApp } from './lib/firebase'
import { registerJoinRoute } from './session/join'
import { registerPrefetchRoute } from './replay/prefetch'

// Initialise Firebase Admin SDK before any route handler uses it
initAdminApp()

const app = express()
app.use(express.json())

// ---------------------------------------------------------------------------
// Health check — no auth required (Cloud Run health probe + uptime check)
// ---------------------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
registerJoinRoute(app)
registerPrefetchRoute(app)

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
