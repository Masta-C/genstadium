/**
 * auth.ts — JWT verification middleware.
 *
 * Uses jose's createRemoteJWKSet with timeoutDuration: 10_000 to prevent
 * indefinite hangs on Cloud Run cold starts (CLAUDE.md rule).
 *
 * Attaches verified token payload to res.locals.token for downstream handlers.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { NextFunction, Request, Response } from 'express'

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'genstadium-2321'
const JWKS_URL = `https://www.googleapis.com/service_accounts/v1/jwk/securetoken%40system.gserviceaccount.com`
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`
const AUDIENCE = PROJECT_ID

const JWKS = createRemoteJWKSet(new URL(JWKS_URL), {
  timeoutDuration: 10_000,
})

export interface VerifiedToken {
  uid: string
  email?: string
  firebase?: { sign_in_provider: string }
}

export async function verifyIdToken(idToken: string): Promise<VerifiedToken> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  return {
    uid: payload.sub ?? '',
    email: typeof payload.email === 'string' ? payload.email : undefined,
    firebase: payload.firebase as VerifiedToken['firebase'],
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Missing Bearer token' })
    return
  }
  const idToken = authHeader.slice(7)
  verifyIdToken(idToken)
    .then((token) => {
      res.locals.token = token
      next()
    })
    .catch(() => {
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Invalid or expired token' })
    })
}
