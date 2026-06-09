import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator,
} from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
} from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Firebase config — values injected from Expo public env vars at build time
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'genstadium-2321',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
}

// ---------------------------------------------------------------------------
// App initialisation — idempotent, safe under Fast Refresh
// ---------------------------------------------------------------------------
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const db = getFirestore(app)

// ---------------------------------------------------------------------------
// Emulator guard
//
// IMPORTANT: Must use a property on `globalThis` (not a module-level boolean)
// because React Native Fast Refresh resets module scope between saves.
// Using `window.__gsEmulatorsConnected` prevents calling connectXxxEmulator
// more than once, which throws an error on subsequent calls.
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __gsEmulatorsConnected?: boolean
  }
}

// Use EXPO_PUBLIC_USE_EMULATOR (set by eas.json dev profile) rather than __DEV__
// so preview/production builds never accidentally hit the emulator even if __DEV__ is true.
const USE_EMULATOR = process.env.EXPO_PUBLIC_USE_EMULATOR === 'true'

if (USE_EMULATOR && !globalThis.window?.__gsEmulatorsConnected) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)

  if (globalThis.window) {
    globalThis.window.__gsEmulatorsConnected = true
  }
}

// ---------------------------------------------------------------------------
// Offline persistence — enables PWA-adjacent behaviour on spotty Wi-Fi
// enableIndexedDbPersistence is ignored on React Native (RN uses its own
// persistence layer), so this is safe to call unconditionally.
// ---------------------------------------------------------------------------
enableIndexedDbPersistence(db).catch((err: { code: string }) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence can only be enabled in one tab at a time
    console.warn('[firebase] Offline persistence unavailable: multiple tabs open')
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support IndexedDB
    console.warn('[firebase] Offline persistence unavailable: IndexedDB not supported')
  }
})

export { app, auth, db }
