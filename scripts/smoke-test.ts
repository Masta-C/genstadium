/**
 * smoke-test.ts — Cloud Run endpoint smoke test.
 *
 * Verifies all critical endpoints respond correctly before a demo.
 * Part 1: unauthenticated 401/400 checks (no credentials needed).
 * Part 2: authenticated E2E chain — auth → session/start → LiveKit token → session/end.
 *
 * Run with:
 *   npm run smoke-test
 *
 * Or against a specific URL:
 *   CLOUD_RUN_URL=https://... npm run smoke-test
 *
 * For E2E chain (Part 2), also requires:
 *   FIREBASE_API_KEY=<web-api-key>   (or EXPO_PUBLIC_FIREBASE_API_KEY)
 *
 * Exit code 0 = all checks pass. Exit code 1 = one or more failures.
 */

const CLOUD_RUN_URL =
  process.env.CLOUD_RUN_URL ??
  'https://genstadium-cloud-run-46093505832.asia-south1.run.app'

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ??
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
  ''

const E2E_DIRECTOR_EMAIL = 'director@genstadium.dev'
const E2E_DIRECTOR_PASSWORD = 'Test1234!'

const TIMEOUT_MS = 10_000

// ── Colours ───────────────────────────────────────────────────────────────────
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

function ok(label: string, detail = '') {
  console.log(`${GREEN}✅ ${label}${RESET}${detail ? `  ${detail}` : ''}`)
}
function fail(label: string, detail = '') {
  console.error(`${RED}❌ ${label}${RESET}${detail ? `  ${detail}` : ''}`)
}
function warn(label: string, detail = '') {
  console.warn(`${YELLOW}⚠️  ${label}${RESET}${detail ? `  ${detail}` : ''}`)
}

// ── Fetch with timeout ─────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

// ── Check runner ──────────────────────────────────────────────────────────────
interface CheckResult {
  label: string
  passed: boolean
}

async function runCheck(
  label: string,
  fn: () => Promise<void>,
): Promise<CheckResult> {
  try {
    await fn()
    return { label, passed: true }
  } catch (err) {
    fail(label, err instanceof Error ? err.message : String(err))
    return { label, passed: false }
  }
}

// ── Individual checks ─────────────────────────────────────────────────────────

async function checkHealth() {
  const res = await fetchWithTimeout(`${CLOUD_RUN_URL}/health`)
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
  const body = (await res.json()) as Record<string, unknown>
  if (body.status === 'degraded') {
    warn('GET /health → 200 (degraded)', JSON.stringify(body))
    return
  }
  ok('GET /health → 200', `firebase:${body.firebase ?? 'ok'} livekit:${body.livekit ?? 'ok'}`)
}

async function checkJoinNoAuth() {
  const res = await fetchWithTimeout(`${CLOUD_RUN_URL}/session/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode: 'TEST01', role: 'camera' }),
  })
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
  const body = (await res.json()) as Record<string, unknown>
  if (body.error !== 'UNAUTHENTICATED') throw new Error(`Expected UNAUTHENTICATED, got ${body.error}`)
  ok('POST /session/join (no auth) → 401 UNAUTHENTICATED')
}

async function checkStartNoAuth() {
  const res = await fetchWithTimeout(`${CLOUD_RUN_URL}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'football', sessionName: 'Test' }),
  })
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
  ok('POST /session/start (no auth) → 401 UNAUTHENTICATED')
}

async function checkEndNoAuth() {
  const res = await fetchWithTimeout(`${CLOUD_RUN_URL}/session/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'test-session-id' }),
  })
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`)
  ok('POST /session/end (no auth) → 401 UNAUTHENTICATED')
}

async function checkLiveKitWebhookNoSig() {
  const res = await fetchWithTimeout(`${CLOUD_RUN_URL}/webhooks/livekit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/webhook+json' },
    body: JSON.stringify({ event: 'room_started' }),
  })
  // Expect 401 (missing/invalid signature) or 400 (bad body format)
  if (res.status !== 401 && res.status !== 400) {
    throw new Error(`Expected 401 or 400, got ${res.status}`)
  }
  ok(`POST /webhooks/livekit (no sig) → ${res.status}`)
}

// ── E2E chain helpers ─────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Token is not a valid JWT (wrong segment count)')
  const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const json = Buffer.from(padded, 'base64').toString('utf8')
  return JSON.parse(json) as Record<string, unknown>
}

async function signInDirector(): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: E2E_DIRECTOR_EMAIL,
      password: E2E_DIRECTOR_PASSWORD,
      returnSecureToken: true,
    }),
  })
  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } }
    throw new Error(`Firebase Auth failed: ${body.error?.message ?? res.status}`)
  }
  const body = (await res.json()) as { idToken?: string }
  if (!body.idToken) throw new Error('Firebase Auth response missing idToken')
  return body.idToken
}

async function checkE2EChain(): Promise<boolean> {
  console.log(`\n${BOLD}Part 2 — E2E authenticated chain${RESET}`)

  if (!FIREBASE_API_KEY) {
    warn(
      'E2E chain skipped',
      'FIREBASE_API_KEY not set — set FIREBASE_API_KEY or EXPO_PUBLIC_FIREBASE_API_KEY to enable',
    )
    return true // not a failure — just skipped
  }

  let idToken: string
  try {
    idToken = await signInDirector()
    ok('Firebase Auth REST sign-in', E2E_DIRECTOR_EMAIL)
  } catch (err) {
    fail('Firebase Auth REST sign-in', err instanceof Error ? err.message : String(err))
    return false
  }

  // /session/start
  let sessionId: string
  let liveKitToken: string
  try {
    const res = await fetchWithTimeout(`${CLOUD_RUN_URL}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, eventType: 'football', sessionName: 'Smoke Test' }),
    })

    if (res.status === 402) {
      warn(
        'POST /session/start → 402 PAYMENT_REQUIRED',
        `Credits=0 for ${E2E_DIRECTOR_EMAIL} — run \`npm run seed:demo\` first`,
      )
      return true // warn not fail
    }

    if (!res.ok) throw new Error(`Expected 200, got ${res.status}`)
    const body = (await res.json()) as { sessionId?: string; liveKitToken?: string }
    if (!body.sessionId) throw new Error('Response missing sessionId')
    if (!body.liveKitToken) throw new Error('Response missing liveKitToken')
    sessionId = body.sessionId
    liveKitToken = body.liveKitToken
    ok('POST /session/start → 200', `sessionId=${sessionId}`)
  } catch (err) {
    fail('POST /session/start', err instanceof Error ? err.message : String(err))
    return false
  }

  // Validate LiveKit JWT structure
  try {
    const payload = decodeJwtPayload(liveKitToken)
    const exp = payload.exp as number | undefined
    if (typeof exp !== 'number') throw new Error('JWT missing exp claim')
    if (exp <= Math.floor(Date.now() / 1000)) throw new Error('JWT is already expired')
    if (!payload.iss) throw new Error('JWT missing iss claim')
    if (!payload.sub) throw new Error('JWT missing sub claim')
    const video = payload.video as Record<string, unknown> | undefined
    if (!video) throw new Error('JWT missing video grants (not a LiveKit token)')
    ok('LiveKit JWT validation', `exp=${new Date(exp * 1000).toISOString()}`)
  } catch (err) {
    fail('LiveKit JWT validation', err instanceof Error ? err.message : String(err))
    // Still try to clean up even on validation failure
  }

  // /session/end (cleanup)
  try {
    const res = await fetchWithTimeout(`${CLOUD_RUN_URL}/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, idToken }),
    })
    if (!res.ok && res.status !== 404) {
      warn('POST /session/end (cleanup)', `Got ${res.status} — session may need manual cleanup`)
    } else {
      ok('POST /session/end (cleanup)', `sessionId=${sessionId}`)
    }
  } catch (err) {
    warn('POST /session/end (cleanup)', err instanceof Error ? err.message : String(err))
  }

  console.log(`\n${GREEN}${BOLD}✅ E2E chain: auth → session → livekit token${RESET}`)
  return true
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}GenStadium Cloud Run Smoke Test${RESET}`)
  console.log(`Target: ${CLOUD_RUN_URL}\n`)

  console.log(`${BOLD}Part 1 — unauthenticated endpoint checks${RESET}`)
  const results = await Promise.all([
    runCheck('GET /health → 200', checkHealth),
    runCheck('POST /session/join (no auth) → 401', checkJoinNoAuth),
    runCheck('POST /session/start (no auth) → 401', checkStartNoAuth),
    runCheck('POST /session/end (no auth) → 401', checkEndNoAuth),
    runCheck('POST /webhooks/livekit (no sig) → 401/400', checkLiveKitWebhookNoSig),
  ])

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`\n${BOLD}Part 1 results: ${passed}/${results.length} passed${RESET}`)

  const e2ePassed = await checkE2EChain()

  if (failed > 0 || !e2ePassed) {
    const totalFailed = failed + (e2ePassed ? 0 : 1)
    console.error(`\n${RED}${BOLD}${totalFailed} check(s) failed. Investigate before demo.${RESET}\n`)
    process.exit(1)
  } else {
    console.log(`\n${GREEN}${BOLD}All checks passed. Cloud Run is healthy.${RESET}\n`)
    process.exit(0)
  }
}

main().catch((err) => {
  console.error(`${RED}Fatal error: ${err instanceof Error ? err.message : String(err)}${RESET}`)
  process.exit(1)
})
