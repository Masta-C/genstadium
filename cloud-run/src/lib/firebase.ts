/**
 * firebase.ts — Firebase Admin SDK initialisation.
 *
 * Call initAdminApp() at the top of every Cloud Run handler before using
 * any Admin SDK service (CLAUDE.md rule). Idempotent — safe to call multiple
 * times (getApps() guard prevents duplicate initialisation).
 */

import * as admin from 'firebase-admin'

export function initAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app()
  }
  return admin.initializeApp()
}

export function getDb(): admin.firestore.Firestore {
  return admin.firestore()
}
