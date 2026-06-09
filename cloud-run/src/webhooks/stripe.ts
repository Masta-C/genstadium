/**
 * stripe.ts — Stripe webhook handler.
 *
 * Handles `checkout.session.completed` events. Verifies the Stripe-Signature
 * header using HMAC-SHA256 (Node.js crypto — no Stripe SDK needed for verification).
 *
 * Idempotency: each checkout session ID is written as its own doc under
 * users/{uid}/credits/transactions/{checkoutSessionId}. A Firestore transaction
 * checks for existence before incrementing balance, so replayed webhooks are no-ops.
 *
 * ADR-009: Stripe handles Android + Web purchases. iOS StoreKit handled separately.
 * Cloud Run only — never call from client.
 *
 * IMPORTANT: must be registered BEFORE express.json() to receive the raw body
 * required for HMAC signature verification.
 */

import crypto from 'crypto'
import express from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb } from '../lib/firebase'
import type { Router, Request, Response } from 'express'

// Reject events older than 5 minutes (replay attack protection)
const STRIPE_TOLERANCE_SECONDS = 300

interface CheckoutSessionObject {
  id: string
  amount_total: number | null
  metadata: {
    uid?: string
    credits?: string
  }
}

interface StripeEvent {
  type: string
  data: {
    object: CheckoutSessionObject
  }
}

/**
 * Verifies Stripe-Signature header.
 * Returns the parsed event body or throws if invalid.
 */
function constructEvent(rawBody: string, signature: string, secret: string): StripeEvent {
  // signature format: t=timestamp,v1=sig1,v1=sig2,...
  const parts: Record<string, string[]> = {}
  for (const part of signature.split(',')) {
    const [key, value] = part.split('=')
    if (!key || !value) continue
    parts[key] = parts[key] ?? []
    parts[key].push(value)
  }

  const timestamp = parts['t']?.[0]
  const signatures = parts['v1'] ?? []

  if (!timestamp || signatures.length === 0) {
    throw new Error('Missing timestamp or v1 signature in Stripe-Signature header')
  }

  // Replay attack protection
  const tsSeconds = parseInt(timestamp, 10)
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - tsSeconds) > STRIPE_TOLERANCE_SECONDS) {
    throw new Error('Stripe webhook timestamp too old')
  }

  const signedPayload = `${timestamp}.${rawBody}`
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex')

  const sigMatches = signatures.some(
    (sig) => crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex')),
  )
  if (!sigMatches) {
    throw new Error('Stripe webhook signature mismatch')
  }

  return JSON.parse(rawBody) as StripeEvent
}

async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string | undefined
  if (!signature) {
    res.status(400).json({ error: 'Missing Stripe-Signature header' })
    return
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body)

  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event: StripeEvent
  try {
    event = constructEvent(rawBody, signature, secret)
  } catch (err) {
    res.status(400).json({ error: 'Invalid webhook signature', message: (err as Error).message })
    return
  }

  if (event.type !== 'checkout.session.completed') {
    // Acknowledge non-targeted events without error
    res.json({ received: true, handled: false })
    return
  }

  const session = event.data.object
  const uid = session.metadata?.uid
  const creditsStr = session.metadata?.credits
  const checkoutSessionId = session.id

  if (!uid || !creditsStr) {
    // Misconfigured checkout — log and return 200 so Stripe doesn't retry
    console.error('[stripe-webhook] missing uid or credits in metadata', { checkoutSessionId })
    res.json({ received: true, handled: false })
    return
  }

  const creditsToAdd = parseInt(creditsStr, 10)
  if (!Number.isInteger(creditsToAdd) || creditsToAdd <= 0) {
    console.error('[stripe-webhook] invalid credits value in metadata', { creditsStr, checkoutSessionId })
    res.json({ received: true, handled: false })
    return
  }

  const db = getDb()
  const creditsRef = db.doc(`users/${uid}/credits/balance`)
  const txRef = db.doc(`users/${uid}/credits/transactions/${checkoutSessionId}`)

  await db.runTransaction(async (tx) => {
    const txSnap = await tx.get(txRef)
    if (txSnap.exists) {
      // Already processed — idempotent no-op
      return
    }

    const balanceSnap = await tx.get(creditsRef)
    const currentBalance = (balanceSnap.data()?.balance as number | undefined) ?? 0

    tx.set(creditsRef, {
      balance: currentBalance + creditsToAdd,
      updatedAt: FieldValue.serverTimestamp(),
    })

    tx.set(txRef, {
      checkoutSessionId,
      uid,
      creditsAdded: creditsToAdd,
      amountTotal: session.amount_total,
      createdAt: FieldValue.serverTimestamp(),
    })
  })

  res.json({ received: true, handled: true })
}

/**
 * Must be registered BEFORE app.use(express.json()) to capture raw body for HMAC.
 */
export function registerStripeWebhook(router: Router): void {
  router.post(
    '/webhooks/stripe',
    express.raw({ type: '*/*' }),
    stripeWebhookHandler,
  )
}
