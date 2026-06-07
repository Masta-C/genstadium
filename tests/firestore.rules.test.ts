/**
 * firestore.rules.test.ts
 *
 * Tests Firestore security rules against the local emulator.
 *
 * Run with:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   npm run test:rules --workspace=cloud-run
 *
 * Requires Firebase emulators to be running: npm run emulators
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
} from 'firebase/firestore'

const PROJECT_ID = 'genstadium-2321'
const RULES_PATH = resolve(__dirname, '../firestore.rules')

let testEnv: RulesTestEnvironment

const DIRECTOR_UID = 'director-uid-001'
const CAMERA_UID = 'camera-uid-001'
const SK_UID = 'sk-uid-001'
const OTHER_UID = 'other-uid-001'
const SESSION_ID = 'test-session-rules'

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()

  // Seed the session doc and participant records via admin (bypasses rules)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()

    await setDoc(doc(db, `sessions/${SESSION_ID}`), {
      id: SESSION_ID,
      eventType: 'soccer',
      joinCode: 'RULES1',
      status: 'lobby',
      createdBy: DIRECTOR_UID,
      sessionName: 'Rules Test Match',
      teams: [],
      directorState: { activeSource: null, scorebugVisible: true },
    })

    // Director participant
    await setDoc(doc(db, `sessions/${SESSION_ID}/participants/${DIRECTOR_UID}`), {
      uid: DIRECTOR_UID,
      role: 'director',
      name: 'Test Director',
      status: 'ready',
    })

    // Camera participant
    await setDoc(doc(db, `sessions/${SESSION_ID}/participants/${CAMERA_UID}`), {
      uid: CAMERA_UID,
      role: 'camera',
      name: 'Test Camera',
      status: 'ready',
    })

    // Score Keeper participant
    await setDoc(doc(db, `sessions/${SESSION_ID}/participants/${SK_UID}`), {
      uid: SK_UID,
      role: 'scorekeeper',
      name: 'Test SK',
      status: 'ready',
    })

    // User profile + credits
    await setDoc(doc(db, `users/${DIRECTOR_UID}`), {
      uid: DIRECTOR_UID,
      email: 'director@genstadium.dev',
    })
    await setDoc(doc(db, `users/${DIRECTOR_UID}/credits/balance`), {
      balance: 5,
    })
  })
})

// ---------------------------------------------------------------------------
// sessions/{sessionId} — reads
// ---------------------------------------------------------------------------
describe('session reads', () => {
  it('Director (participant) can read session', async () => {
    const ctx = testEnv.authenticatedContext(DIRECTOR_UID)
    await assertSucceeds(getDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}`)))
  })

  it('Camera (participant) can read session', async () => {
    const ctx = testEnv.authenticatedContext(CAMERA_UID)
    await assertSucceeds(getDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}`)))
  })

  it('Non-participant is rejected from reading session', async () => {
    const ctx = testEnv.authenticatedContext(OTHER_UID)
    await assertFails(getDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}`)))
  })

  it('Unauthenticated user is rejected', async () => {
    const ctx = testEnv.unauthenticatedContext()
    await assertFails(getDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}`)))
  })
})

// ---------------------------------------------------------------------------
// sessions/{sessionId} — writes
// ---------------------------------------------------------------------------
describe('session writes', () => {
  it('Session creator (Director) can update session', async () => {
    const ctx = testEnv.authenticatedContext(DIRECTOR_UID)
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}`), {
        'directorState.scorebugVisible': false,
      }),
    )
  })

  it('Non-creator participant cannot update session', async () => {
    const ctx = testEnv.authenticatedContext(CAMERA_UID)
    await assertFails(
      updateDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}`), {
        status: 'live',
      }),
    )
  })

  it('Nobody can delete a session', async () => {
    const ctx = testEnv.authenticatedContext(DIRECTOR_UID)
    await assertFails(deleteDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}`)))
  })
})

// ---------------------------------------------------------------------------
// sessions/{sessionId}/events — Score Keeper event write
// ---------------------------------------------------------------------------
describe('score events', () => {
  it('Score Keeper can write an event', async () => {
    const ctx = testEnv.authenticatedContext(SK_UID)
    await assertSucceeds(
      addDoc(collection(ctx.firestore(), `sessions/${SESSION_ID}/events`), {
        eventType: 'goal',
        team: 'team-a',
        playerId: null,
        scoreDelta: 1,
        metadata: {},
        triggers: ['prefetch', 'animation'],
        deleted: false,
      }),
    )
  })

  it('Camera participant cannot write events', async () => {
    const ctx = testEnv.authenticatedContext(CAMERA_UID)
    await assertFails(
      addDoc(collection(ctx.firestore(), `sessions/${SESSION_ID}/events`), {
        eventType: 'goal',
        team: 'team-a',
        playerId: null,
        scoreDelta: 1,
        metadata: {},
        triggers: [],
        deleted: false,
      }),
    )
  })

  it('Director cannot write events (not scorekeeper)', async () => {
    const ctx = testEnv.authenticatedContext(DIRECTOR_UID)
    await assertFails(
      addDoc(collection(ctx.firestore(), `sessions/${SESSION_ID}/events`), {
        eventType: 'goal',
      }),
    )
  })

  it('Score Keeper can read events', async () => {
    const ctx = testEnv.authenticatedContext(SK_UID)
    await assertSucceeds(getDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}/events/any-event`)))
  })
})

// ---------------------------------------------------------------------------
// sessions/{sessionId}/scoreState — read-only from client
// ---------------------------------------------------------------------------
describe('scoreState', () => {
  it('Participant can read scoreState', async () => {
    const ctx = testEnv.authenticatedContext(SK_UID)
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}/scoreState/current`)),
    )
  })

  it('Nobody can write scoreState from client', async () => {
    const ctx = testEnv.authenticatedContext(SK_UID)
    await assertFails(
      setDoc(doc(ctx.firestore(), `sessions/${SESSION_ID}/scoreState/current`), {
        homeScore: 99,
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// users/{uid} — owner only
// ---------------------------------------------------------------------------
describe('user profile', () => {
  it('Owner can read their own user doc', async () => {
    const ctx = testEnv.authenticatedContext(DIRECTOR_UID)
    await assertSucceeds(getDoc(doc(ctx.firestore(), `users/${DIRECTOR_UID}`)))
  })

  it('Another user cannot read someone else\'s profile', async () => {
    const ctx = testEnv.authenticatedContext(OTHER_UID)
    await assertFails(getDoc(doc(ctx.firestore(), `users/${DIRECTOR_UID}`)))
  })

  it('Owner can write their own user doc', async () => {
    const ctx = testEnv.authenticatedContext(DIRECTOR_UID)
    await assertSucceeds(
      updateDoc(doc(ctx.firestore(), `users/${DIRECTOR_UID}`), { displayName: 'Updated' }),
    )
  })
})

// ---------------------------------------------------------------------------
// users/{uid}/credits — read-only from client
// ---------------------------------------------------------------------------
describe('credits', () => {
  it('Owner can read their own credits', async () => {
    const ctx = testEnv.authenticatedContext(DIRECTOR_UID)
    await assertSucceeds(
      getDoc(doc(ctx.firestore(), `users/${DIRECTOR_UID}/credits/balance`)),
    )
  })

  it('Owner cannot write credits from client', async () => {
    const ctx = testEnv.authenticatedContext(DIRECTOR_UID)
    await assertFails(
      setDoc(doc(ctx.firestore(), `users/${DIRECTOR_UID}/credits/balance`), { balance: 999 }),
    )
  })

  it('Other user cannot read credits', async () => {
    const ctx = testEnv.authenticatedContext(OTHER_UID)
    await assertFails(
      getDoc(doc(ctx.firestore(), `users/${DIRECTOR_UID}/credits/balance`)),
    )
  })
})
