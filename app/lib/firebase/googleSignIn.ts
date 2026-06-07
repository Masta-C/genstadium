/**
 * googleSignIn.ts — Google Sign-In flow for React Native (dev builds only).
 *
 * IMPORTANT: This does NOT work in Expo Go. A dev build is required.
 * Attempting to call signInWithGoogle() in Expo Go will throw an error.
 *
 * Setup requirements (per CLAUDE.md / issue #13):
 * - iOS:  REVERSED_CLIENT_ID must be in app.json infoPlist.CFBundleURLTypes
 * - Android: SHA-1 fingerprints for debug + release + EAS build registered in Firebase Console
 * - webClientId: from Firebase Console → Project Settings → Web SDK config
 */

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import {
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  fetchSignInMethodsForEmail,
} from 'firebase/auth'
import { auth } from './client'

// webClientId must match the OAuth 2.0 client ID in Firebase Console (Web client type)
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''

let configured = false

export function configureGoogleSignIn() {
  if (configured) return
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID })
  configured = true
}

export async function signInWithGoogle(): Promise<void> {
  configureGoogleSignIn()

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  const { data } = await GoogleSignin.signIn()

  if (!data?.idToken) {
    throw new Error('Google Sign-In did not return an ID token.')
  }

  const googleCredential = GoogleAuthProvider.credential(data.idToken)

  try {
    await signInWithCredential(auth, googleCredential)
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? ''

    // Email already used with email/password — link the accounts
    if (code === 'auth/account-exists-with-different-credential') {
      const email = (err as { customData?: { email?: string } }).customData?.email
      if (!email) throw err

      const methods = await fetchSignInMethodsForEmail(auth, email)
      if (methods.includes('password')) {
        // Caller must prompt for password then call linkWithCredential
        throw Object.assign(new Error('LINK_REQUIRED'), {
          code: 'LINK_REQUIRED',
          email,
          pendingCredential: googleCredential,
        })
      }
    }
    throw err
  }
}

export async function linkGoogleCredential(
  pendingCredential: ReturnType<typeof GoogleAuthProvider.credential>,
): Promise<void> {
  const currentUser = auth.currentUser
  if (!currentUser) throw new Error('No user signed in to link.')
  // linkWithCredential order: always BEFORE any Firestore write under the new UID
  await linkWithCredential(currentUser, pendingCredential)
}

export { statusCodes }
