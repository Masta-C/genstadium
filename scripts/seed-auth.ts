/**
 * seed-auth.ts — Creates test Director user in the Firebase Auth emulator.
 *
 * Run with:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   npx ts-node --esm scripts/seed-auth.ts
 *
 * Idempotent: silently skips if the user already exists.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'genstadium-2321'

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('ERROR: FIREBASE_AUTH_EMULATOR_HOST is not set. Refusing to run against production.')
  process.exit(1)
}

if (getApps().length === 0) {
  initializeApp({
    projectId: PROJECT_ID,
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: `firebase-adminsdk@${PROJECT_ID}.iam.gserviceaccount.com`,
      // Emulator ignores private key — any non-empty string works
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----\n',
    }),
  })
}

const auth = getAuth()

const TEST_USERS = [
  {
    uid: 'director-test-uid',
    email: 'director@genstadium.dev',
    password: 'Test1234!',
    displayName: 'Test Director',
  },
]

async function seedAuth() {
  console.log('Seeding Auth emulator…')
  for (const user of TEST_USERS) {
    try {
      await auth.getUser(user.uid)
      console.log(`  ✓ ${user.email} already exists — skipping`)
    } catch {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        password: user.password,
        displayName: user.displayName,
        emailVerified: true,
      })
      console.log(`  ✓ Created ${user.email}`)
    }
  }
  console.log('Auth seed complete.')
}

seedAuth().catch((err) => {
  console.error('Auth seed failed:', err)
  process.exit(1)
})
