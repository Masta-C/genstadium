/**
 * smoke-test.ts — Cloud Run endpoint smoke test.
 *
 * Verifies all critical endpoints respond correctly before a demo.
 * Uses expected-failure paths (no real credentials needed for basic checks).
 *
 * Run with:
 *   npm run smoke-test
 *
 * Or against a specific URL:
 *   CLOUD_RUN_URL=https://... npm run smoke-test
 *
 * Exit code 0 = all checks pass. Exit code 1 = one or more failures.
 */

const CLOUD_RUN_URL =
  process.env.CLOUD_RUN_URL ??
  'https://genstadium-cloud-run-46093505832.asia-south1.run.app'

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}GenStadium Cloud Run Smoke Test${RESET}`)
  console.log(`Target: ${CLOUD_RUN_URL}\n`)

  const results = await Promise.all([
    runCheck('GET /health → 200', checkHealth),
    runCheck('POST /session/join (no auth) → 401', checkJoinNoAuth),
    runCheck('POST /session/start (no auth) → 401', checkStartNoAuth),
    runCheck('POST /session/end (no auth) → 401', checkEndNoAuth),
    runCheck('POST /webhooks/livekit (no sig) → 401/400', checkLiveKitWebhookNoSig),
  ])

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log(`\n${BOLD}Results: ${passed}/${results.length} passed${RESET}`)

  if (failed > 0) {
    console.error(`\n${RED}${BOLD}${failed} check(s) failed. Investigate before demo.${RESET}\n`)
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
