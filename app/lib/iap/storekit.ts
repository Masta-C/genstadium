/**
 * storekit.ts — iOS StoreKit purchase flow via expo-iap.
 *
 * Initiates an IAP purchase for the credits product, posts the resulting
 * JWS token to Cloud Run for server-side verification, then finishes the
 * transaction so Apple marks it as consumed.
 *
 * ADR-009: iOS IAP handled natively (StoreKit). No purchase UI is rendered
 * by this module — the Apple payment sheet is presented by expo-iap itself.
 * The app NEVER shows pricing, purchase buttons, or buy links.
 *
 * Product ID comes from EXPO_PUBLIC_IAP_PRODUCT_ID env var (runtime config;
 * does not require App Store Connect to be set up in advance — scaffold safe).
 */

import {
  initConnection,
  endConnection,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
} from 'expo-iap'
import { Platform } from 'react-native'

const CLOUD_RUN_URL =
  (process.env.EXPO_PUBLIC_CLOUD_RUN_URL ?? 'http://localhost:8081').replace(/\/$/, '')

const IAP_PRODUCT_ID = process.env.EXPO_PUBLIC_IAP_PRODUCT_ID ?? ''

export class IAPError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'IAPError'
  }
}

/**
 * Initialises the expo-iap connection. Call once on app start (or before triggering purchase).
 * Safe to call multiple times — expo-iap guards internally.
 */
export async function initIAP(): Promise<void> {
  if (Platform.OS !== 'ios') return
  await initConnection()
}

/**
 * Tears down the expo-iap connection. Call when the app goes to background
 * or on unmount of the component that initialised the connection.
 */
export async function teardownIAP(): Promise<void> {
  if (Platform.OS !== 'ios') return
  await endConnection()
}

/**
 * Initiates the StoreKit purchase flow for the credits product.
 *
 * @param idToken - Firebase ID token for the authenticated user
 * @returns resolves on successful purchase + server verification
 * @throws IAPError on user cancellation, payment failure, or server error
 *
 * Caller is responsible for wrapping in try/catch and showing appropriate UI.
 * Do NOT show a price or "buy" button — Apple payment sheet handles that.
 */
export async function purchaseCredits(idToken: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new IAPError('StoreKit is iOS only. Use Stripe for Android/Web.')
  }

  if (!IAP_PRODUCT_ID) {
    throw new IAPError('EXPO_PUBLIC_IAP_PRODUCT_ID is not configured.')
  }

  return new Promise<void>((resolve, reject) => {
    const purchaseSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      if (purchase.productId !== IAP_PRODUCT_ID) return

      purchaseSub.remove()
      errorSub.remove()

      try {
        await verifyWithServer(purchase, idToken)
        await finishTransaction({ purchase, isConsumable: true })
        resolve()
      } catch (err) {
        // Finish the transaction even on server error — avoids stuck pending transactions
        await finishTransaction({ purchase, isConsumable: true }).catch(() => {})
        reject(err instanceof Error ? err : new IAPError('Server verification failed'))
      }
    })

    const errorSub = purchaseErrorListener((error) => {
      purchaseSub.remove()
      errorSub.remove()
      reject(new IAPError(error.message, error.code))
    })

    requestPurchase({
      request: { apple: { sku: IAP_PRODUCT_ID } },
      type: 'in-app',
    }).catch((err: unknown) => {
      purchaseSub.remove()
      errorSub.remove()
      reject(err instanceof Error ? err : new IAPError('Purchase request failed'))
    })
  })
}

// ── Private ────────────────────────────────────────────────────────────────

async function verifyWithServer(purchase: Purchase, idToken: string): Promise<void> {
  const res = await fetch(`${CLOUD_RUN_URL}/iap/verify-receipt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      productId: purchase.productId,
      transactionId: purchase.transactionId ?? purchase.id,
      purchaseToken: purchase.purchaseToken,
    }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    throw new IAPError(data.message ?? `Server returned ${res.status}`)
  }
}
