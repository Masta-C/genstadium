/**
 * seed-demo.ts — Prepares real Firebase for a demo run in under 30 seconds.
 *
 * Sets Director credits so Cloud Run's PAYMENT_REQUIRED gate is cleared,
 * and optionally creates a DEMO01 session in lobby state.
 *
 * Uses Application Default Credentials:
 *   gcloud auth application-default login
 * Or:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
 *
 * Usage:
 *   npx ts-node --esm scripts/seed-demo.ts --email director@genstadium.dev --confirm
 *   npx ts-node --esm scripts/seed-demo.ts --uid <uid> --create-session --confirm
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'genstadium-2321'

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('ERROR: FIRESTORE_EMULATOR_HOST is set. Use seed.ts for emulator seeding.')
  process.exit(1)
}

const args = process.argv.slice(2)
const emailIdx = args.indexOf('--email')
const uidIdx = args.indexOf('--uid')
const argEmail = emailIdx >= 0 ? args[emailIdx + 1] : undefined
const argUid = uidIdx >= 0 ? args[uidIdx + 1] : undefined
const createSession = args.includes('--create-session')
const confirmed = args.includes('--confirm')

if (!argEmail && !argUid) {
  console.error('ERROR: Provide --email <email> or --uid <uid>')
  process.exit(1)
}

if (!confirmed) {
  console.warn(`\n⚠️  Writing to REAL Firebase project: ${PROJECT_ID}`)
  console.warn('   This will modify production Firestore data.')
  const flags = argEmail ? `--email ${argEmail}` : `--uid ${argUid}`
  const sessionFlag = createSession ? ' --create-session' : ''
  console.warn(`\n   Re-run with --confirm to proceed:\n`)
  console.warn(`   npx ts-node --esm scripts/seed-demo.ts ${flags}${sessionFlag} --confirm\n`)
  process.exit(0)
}

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  })
}

const auth = getAuth()
const db = getFirestore()

async function resolveUid(): Promise<{ uid: string; email: string }> {
  if (argUid) {
    const user = await auth.getUser(argUid)
    return { uid: argUid, email: user.email ?? `uid:${argUid}` }
  }
  const user = await auth.getUserByEmail(argEmail!)
  return { uid: user.uid, email: argEmail! }
}

async function setCredits(uid: string, email: string) {
  await db.doc(`users/${uid}/credits/balance`).set(
    { balance: 5, seeded: true, seededAt: Timestamp.now() },
    { merge: true },
  )
  console.log(`✅ credits set: 5 for ${email} (uid: ${uid})`)
}

async function createDemoSession(uid: string) {
  const SESSION_ID = 'demo-session-001'
  await db.doc(`sessions/${SESSION_ID}`).set(
    {
      id: SESSION_ID,
      sessionName: 'Demo Session',
      joinCode: 'DEMO01',
      status: 'lobby',
      eventType: 'football',
      createdBy: uid,
      cameraSlots: [
        { id: 'cam_1', name: 'Wide Angle' },
        { id: 'cam_2', name: 'Close Up' },
      ],
      replayCameraSlot: 'cam_1',
      teams: [
        { id: 'team-a', name: 'Home', colour: '#1DB954' },
        { id: 'team-b', name: 'Away', colour: '#CC0000' },
      ],
      players: [],
      participants: {},
      directorState: { activeSource: 'cam_1', scorebugVisible: true },
      egressIds: { a: null, b: null },
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  console.log(`✅ demo session created: ${SESSION_ID} (joinCode=DEMO01)`)
}

async function main() {
  console.log(`\n⚠️  Writing to REAL Firebase project: ${PROJECT_ID}\n`)

  const { uid, email } = await resolveUid()

  await setCredits(uid, email)

  if (createSession) {
    await createDemoSession(uid)
  }

  console.log('\nDemo seed complete.')
}

main().catch((err) => {
  console.error('seed-demo failed:', err)
  process.exit(1)
})
