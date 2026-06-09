import crypto from 'crypto'

// ── Firebase mock ────────────────────────────────────────────────────────────
const mockSet = jest.fn().mockResolvedValue(undefined)
const mockGet = jest.fn()
const mockRunTransaction = jest.fn()
const mockDoc = jest.fn()

jest.mock('../lib/firebase', () => ({
  getDb: () => ({
    doc: mockDoc,
    runTransaction: mockRunTransaction,
  }),
}))

// ── firebase-admin/firestore ─────────────────────────────────────────────────
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '__serverTimestamp__',
  },
}))

import express from 'express'
import request from 'supertest'
import { registerStripeWebhook } from './stripe'

// ── Test helpers ─────────────────────────────────────────────────────────────

const TEST_SECRET = 'whsec_test_secret'
const VALID_CREDITS = 1

function buildApp() {
  const app = express()
  // Webhook route must be before express.json() — matches production wiring
  registerStripeWebhook(app)
  app.use(express.json())
  return app
}

function makeSignature(rawBody: string, secret: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000)
  const signedPayload = `${ts}.${rawBody}`
  const sig = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex')
  return `t=${ts},v1=${sig}`
}

function makeCheckoutEvent(overrides: Partial<{
  sessionId: string
  uid: string
  credits: string
  amountTotal: number
}> = {}) {
  const {
    sessionId = 'cs_test_abc123',
    uid = 'firebase-uid-abc',
    credits = String(VALID_CREDITS),
    amountTotal = 999,
  } = overrides
  return JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        amount_total: amountTotal,
        metadata: { uid, credits },
      },
    },
  })
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET

  // Default: transaction doc does NOT exist (first time)
  const txSnap = { exists: false, data: () => undefined }
  const balanceSnap = { exists: true, data: () => ({ balance: 2 }) }

  mockGet.mockResolvedValueOnce(txSnap).mockResolvedValueOnce(balanceSnap)
  mockDoc.mockReturnValue({ get: mockGet, set: mockSet })

  // Simulate runTransaction by calling the callback with a mock tx object
  mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    let callCount = 0
    const tx = {
      get: () => {
        callCount++
        // First call → txSnap (idempotency check); second call → balanceSnap
        return Promise.resolve(callCount === 1 ? txSnap : balanceSnap)
      },
      set: mockSet,
    }
    await fn(tx)
  })
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /webhooks/stripe', () => {
  it('returns 400 when Stripe-Signature header is missing', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(makeCheckoutEvent())

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Missing Stripe-Signature header')
  })

  it('returns 400 when signature is invalid', async () => {
    const app = buildApp()
    const body = makeCheckoutEvent()
    const sig = makeSignature(body, 'wrong_secret')

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', sig)
      .send(Buffer.from(body))

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid webhook signature')
  })

  it('returns 400 when timestamp is too old (replay attack)', async () => {
    const app = buildApp()
    const body = makeCheckoutEvent()
    const staleTs = Math.floor(Date.now() / 1000) - 400 // > 300s tolerance
    const sig = makeSignature(body, TEST_SECRET, staleTs)

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', sig)
      .send(Buffer.from(body))

    expect(res.status).toBe(400)
  })

  it('increments credits balance and writes transaction doc on valid event', async () => {
    const app = buildApp()
    const body = makeCheckoutEvent({ uid: 'user-abc', credits: '1', sessionId: 'cs_test_001' })
    const sig = makeSignature(body, TEST_SECRET)

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', sig)
      .send(Buffer.from(body))

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ received: true, handled: true })

    // Credits balance written: existing 2 + 1 new = 3
    expect(mockSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ balance: 3 }),
    )
    // Transaction doc written with checkoutSessionId
    expect(mockSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ checkoutSessionId: 'cs_test_001', creditsAdded: 1 }),
    )
  })

  it('is idempotent: skips credit write if transaction doc already exists', async () => {
    const app = buildApp()
    const body = makeCheckoutEvent({ sessionId: 'cs_already_processed' })
    const sig = makeSignature(body, TEST_SECRET)

    // Override: tx doc already exists
    mockRunTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        get: () => Promise.resolve({ exists: true, data: () => ({ checkoutSessionId: 'cs_already_processed' }) }),
        set: mockSet,
      }
      await fn(tx)
    })

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', sig)
      .send(Buffer.from(body))

    expect(res.status).toBe(200)
    // mockSet should NOT have been called — idempotent no-op
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('returns 200 with handled:false for non-checkout event types', async () => {
    const app = buildApp()
    const body = JSON.stringify({ type: 'payment_intent.created', data: { object: {} } })
    const sig = makeSignature(body, TEST_SECRET)

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', sig)
      .send(Buffer.from(body))

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ received: true, handled: false })
    expect(mockRunTransaction).not.toHaveBeenCalled()
  })

  it('returns 200 with handled:false when uid is missing from metadata', async () => {
    const app = buildApp()
    const body = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_no_uid', amount_total: 999, metadata: { credits: '1' } } },
    })
    const sig = makeSignature(body, TEST_SECRET)

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', sig)
      .send(Buffer.from(body))

    expect(res.status).toBe(200)
    expect(res.body.handled).toBe(false)
    expect(mockRunTransaction).not.toHaveBeenCalled()
  })
})
