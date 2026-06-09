/**
 * verifyReceipt.ts — POST /iap/verify-receipt endpoint.
 *
 * Called by the iOS app after expo-iap returns a successful purchase.
 * Verifies the StoreKit 2 JWS token with Apple's App Store Server API,
 * then idempotently writes credits to users/{uid}/credits/balance.
 *
 * ADR-009: iOS purchases flow through StoreKit → this endpoint → Firestore.
 *
 * Apple verification: the JWS token (purchaseToken) from StoreKit 2 is a
 * signed JWT. In production, decode the payload to extract the transactionId
 * and verify the signature against Apple's JWKS. For now the verification
 * is scaffolded with a TODO — the credits write + idempotency logic is
 * production-ready.
 *
 * TODO(#85): Replace scaffold verification with Apple App Store Server API:
 *   POST https://api.storekit.itunes.apple.com/inApps/v1/transactions/{transactionId}
 *   Headers: { Authorization: `Bearer ${appleSignedJWT}` }
 *   Requires: APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY env vars
 */

import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, type VerifiedToken } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { getDb } from '../lib/firebase'
import type { Router, Request, Response } from 'express'

const VerifyReceiptSchema = z.object({
  productId: z.string().min(1),
  transactionId: z.string().min(1),
  purchaseToken: z.string().min(1),
})

type VerifyReceiptBody = z.infer<typeof VerifyReceiptSchema>

// Credits granted per purchase. In production, derive from productId lookup.
const CREDITS_PER_PURCHASE = 1

async function verifyReceiptHandler(req: Request, res: Response): Promise<void> {
  const token = res.locals.token as VerifiedToken
  const { productId, transactionId, purchaseToken } = res.locals.body as VerifyReceiptBody
  const db = getDb()

  // ── Apple verification (scaffold) ──────────────────────────────────────
  // TODO(#85): Verify purchaseToken (JWS) against Apple App Store Server API.
  // Until Apple credentials (APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY)
  // are configured, we trust the receipt from the authenticated app user.
  // The Firestore idempotency key prevents replay abuse.
  void productId
  void purchaseToken

  const uid = token.uid

  const balanceRef = db.doc(`users/${uid}/credits/balance`)
  const txRef = db.doc(`users/${uid}/credits/transactions/${transactionId}`)

  await db.runTransaction(async (tx) => {
    const txSnap = await tx.get(txRef)
    if (txSnap.exists) {
      // Already processed — idempotent no-op
      return
    }

    const balanceSnap = await tx.get(balanceRef)
    const currentBalance = (balanceSnap.data()?.balance as number | undefined) ?? 0

    tx.set(balanceRef, {
      balance: currentBalance + CREDITS_PER_PURCHASE,
      updatedAt: FieldValue.serverTimestamp(),
    })

    tx.set(txRef, {
      transactionId,
      productId,
      uid,
      creditsAdded: CREDITS_PER_PURCHASE,
      platform: 'ios',
      createdAt: FieldValue.serverTimestamp(),
    })
  })

  res.json({ credited: CREDITS_PER_PURCHASE })
}

export function registerVerifyReceiptRoute(router: Router): void {
  router.post(
    '/iap/verify-receipt',
    requireAuth,
    validate(VerifyReceiptSchema),
    verifyReceiptHandler,
  )
}
