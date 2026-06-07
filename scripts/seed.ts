/**
 * seed.ts — Seeds Firestore emulator with a football session + sample events.
 *
 * Run with:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   npx ts-node --esm scripts/seed.ts
 *
 * Idempotent: uses fixed document IDs so running twice produces no duplicates.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'genstadium-2321'

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('ERROR: FIRESTORE_EMULATOR_HOST is not set. Refusing to run against production.')
  process.exit(1)
}

if (getApps().length === 0) {
  initializeApp({
    projectId: PROJECT_ID,
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: `firebase-adminsdk@${PROJECT_ID}.iam.gserviceaccount.com`,
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----\n',
    }),
  })
}

const db = getFirestore()

// ---------------------------------------------------------------------------
// Fixed IDs — guarantees idempotency
// ---------------------------------------------------------------------------
const SESSION_ID = 'test-session-001'
const DIRECTOR_UID = 'director-test-uid'
const JOIN_CODE = 'TEST01'

const TEAMS = [
  { id: 'team-a', name: 'Mumbai FC', colour: '#1DB954' },
  { id: 'team-b', name: 'Pune FC',   colour: '#2D86FF' },
]

const CAMERA_SLOTS = [
  { slotName: 'cam_1', label: 'Wide Angle',  takenBy: null },
  { slotName: 'cam_2', label: 'Close Up',    takenBy: null },
  { slotName: 'cam_3', label: 'Behind Goal', takenBy: null },
]

const SAMPLE_EVENTS = [
  {
    id: 'event-001',
    eventType: 'goal',
    team: 'team-a',
    playerId: 'unknown',
    scoreDelta: 1,
    metadata: {},
    triggers: ['prefetch', 'animation'],
    deleted: false,
  },
  {
    id: 'event-002',
    eventType: 'yellow_card',
    team: 'team-b',
    playerId: 'unknown',
    scoreDelta: 0,
    metadata: {},
    triggers: ['animation'],
    deleted: false,
  },
  {
    id: 'event-003',
    eventType: 'goal',
    team: 'team-b',
    playerId: 'unknown',
    scoreDelta: 1,
    metadata: {},
    triggers: ['prefetch', 'animation'],
    deleted: false,
  },
]

async function seedSession() {
  console.log('Seeding Firestore emulator…')

  const sessionRef = db.doc(`sessions/${SESSION_ID}`)

  // Idempotency: write with merge so existing fields are preserved
  await sessionRef.set(
    {
      id: SESSION_ID,
      eventType: 'soccer',
      joinCode: JOIN_CODE,
      status: 'lobby',
      createdBy: DIRECTOR_UID,
      sessionName: 'Test Match',
      teams: TEAMS,
      players: [],
      cameraSlots: CAMERA_SLOTS,
      replayCameraSlot: 'cam_1',
      replayCameraOnline: false,
      participants: {},
      directorState: {
        activeSource: null,
        scorebugVisible: true,
      },
      animationConfig: {},
      egressIds: { a: null, b: null },
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  console.log(`  ✓ Session ${SESSION_ID} (joinCode=${JOIN_CODE})`)

  // Director user document
  await db.doc(`users/${DIRECTOR_UID}`).set(
    {
      uid: DIRECTOR_UID,
      email: 'director@genstadium.dev',
      displayName: 'Test Director',
      role: 'director',
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  // Seed credits so Go Live doesn't immediately fail with PAYMENT_REQUIRED
  await db.doc(`users/${DIRECTOR_UID}/credits/balance`).set(
    { balance: 5, transactions: [] },
    { merge: true },
  )
  console.log(`  ✓ Director user ${DIRECTOR_UID} with 5 credits`)

  // Score events
  const batch = db.batch()
  for (const event of SAMPLE_EVENTS) {
    const ref = db.doc(`sessions/${SESSION_ID}/events/${event.id}`)
    batch.set(
      ref,
      {
        ...event,
        timestamp: Timestamp.fromMillis(Date.now() - (SAMPLE_EVENTS.indexOf(event) + 1) * 60_000),
        loggedBy: DIRECTOR_UID,
      },
      { merge: true },
    )
  }
  await batch.commit()
  console.log(`  ✓ ${SAMPLE_EVENTS.length} sample score events`)

  // scoreState (derived — normally written by Cloud Function)
  await db.doc(`sessions/${SESSION_ID}/scoreState`).set(
    {
      homeScore: 1,
      awayScore: 1,
      period: '1st Half',
      lastEvent: { eventType: 'goal', team: 'team-b', timestamp: Timestamp.now() },
    },
    { merge: true },
  )
  console.log('  ✓ scoreState (1 – 1)')

  console.log('\nFirestore seed complete.')
  console.log(`  Join code : ${JOIN_CODE}`)
  console.log(`  Session   : http://localhost:4000/firestore/data/sessions/${SESSION_ID}`)
}

seedSession().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
