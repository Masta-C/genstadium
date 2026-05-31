# ADR-009: Platform Split Payments — iOS StoreKit, Android+Web Stripe, No RevenueCat

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

Use a platform split for credit purchases:
- **iOS**: Native StoreKit (Apple IAP) — required by App Store rules
- **Android**: Stripe web purchase at `genstadium.com/buy` — bypasses Play Store 15-30% commission
- **Web**: Stripe — same flow as Android
- **RevenueCat**: Removed entirely from the stack

## Context

Original PRD included RevenueCat as the IAP abstraction layer. Evaluated against direct alternatives.

## Why Not RevenueCat

RevenueCat adds:
- A third-party SDK in the app bundle
- Monthly cost ($0-199/month depending on revenue)
- An additional vendor to trust with transaction data
- Abstraction over StoreKit and Play Billing that isn't needed if we're going web-first

RevenueCat removes:
- Nothing that can't be done with StoreKit directly (iOS) and Stripe directly (Android/Web)

Decision: Remove RevenueCat. It was solving a problem (cross-platform IAP) we're not having (we don't use Play Billing).

## Why Stripe Web for Android (not Play Billing)

Google Play's alternative billing policy (2024) allows apps to offer non-Google payment systems in most markets. India is included.

Commission comparison:
| Platform | Commission |
|---|---|
| Apple IAP | 15% (small business) |
| Google Play Billing | 15% (small business) |
| Stripe | ~2% processing |
| Stripe web (Android) | ~2% |

At ₹1,499 per event pack:
- With App Store cut (iOS): ~₹1,274 net (~15% lost)
- With Stripe (Android/Web): ~₹1,469 net (~2% lost)
- Blended at 70% Android / 30% iOS: effective commission ~5.5%

## App Store Compliance

Apple's rule: digital goods consumed in-app must use IAP. GenStadium complies:
- iOS uses StoreKit natively — no IAP evasion
- App UI shows credit balance ONLY — no pricing, no purchase button, no external links
- Users discover `genstadium.com/buy` via onboarding email, not from inside the app
- App Store reviewer sees: free app, credit balance display, StoreKit purchase flow on iOS

Android app contains NO purchase UI. Only shows balance. Users directed to web via email.

## Implementation

```
iOS purchase flow:
  StoreKit present paywall → user purchases product → StoreKit receipt
  → POST /api/webhooks/storekit { receiptData }
  → Cloud Function validates receipt with Apple
  → Write users/{uid}/credits.balance += N

Android/Web purchase flow:
  User visits genstadium.com/buy → Stripe Checkout (hosted page)
  → Stripe webhook → Cloud Function
  → Write users/{uid}/credits.balance += N

App UI (all platforms):
  Read users/{uid}/credits.balance from Firestore
  Display: "3 events remaining"
  Go Live disabled if balance === 0
```

## Credit data model

```
users/{uid}/credits: {
  balance: number,      // current credits available
  transactions: [{      // append-only log
    type: 'purchase' | 'consume',
    amount: number,
    sessionId?: string, // for consume transactions
    timestamp: Timestamp,
    source: 'stripe' | 'storekit'
  }]
}
```

Written ONLY by Cloud Functions (Stripe webhook handler, StoreKit webhook handler). Never by client.

## Consequences

**Positive:**
- Saves 13-28% commission on Android/Web sales (typically 70% of India market)
- No RevenueCat SDK — simpler app bundle, one fewer vendor
- Pricing changes never require app store review (web page only)
- B2B framing (club buys package on laptop) fits Stripe web naturally

**Negative:**
- Two payment integrations to maintain (StoreKit + Stripe)
- iOS users can only purchase inside the app — no web fallback
- Users must know to go to the website — discovered via email, not in-app

## Review Trigger

Re-evaluate RevenueCat if: iOS revenue exceeds $1M/year (Apple commission drops to 0% above threshold under small business program) or if Android users complain about web-only purchase flow.
