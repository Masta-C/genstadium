## Summary

<!-- 1-3 sentences. What changed and why. -->

## Issue
Closes #

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Infra / config
- [ ] Docs

## Checklist

### Code quality
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

### Domain integrity
- [ ] Uses `eventConfig` (not `sportConfig`)
- [ ] No pricing / purchase UI added to the app
- [ ] No simulcast / Director video preview added
- [ ] CONTEXT.md updated if new domain terms introduced
- [ ] ADR created or updated if architecture decision made

### Auth (if auth-related)
- [ ] `firebase-auth-preflight` skill run before implementation
- [ ] `connectAuthEmulator` uses `window.__gsEmulatorsConnected` guard
- [ ] No `getIdToken(true)` force-refresh in `useEffect`
- [ ] Camera/SK token identity = slot name (e.g. `cam_1`)
- [ ] For Google Sign-In: all 3 SHA-1 fingerprints registered

### Firestore
- [ ] New compound queries have indexes in `firestore.indexes.json`
- [ ] Firestore rules updated and tested if new collections/roles added
- [ ] `initAdminApp()` called at top of any new Cloud Run handler

### Replay / DVR (if replay-related)
- [ ] Egress B targets ISO Camera only (`participantIdentity: session.replayCameraSlot`)
- [ ] Pre-fetched clips written to GCS (never held in Cloud Run memory)
- [ ] Pre-fetch abort check: gap > 10s → silent no-badge, no partial clip
- [ ] Replay badge: single badge only, most recent overwrites previous

### Payments (if payment-related)
- [ ] Credit balance written only by Cloud Function (never client)
- [ ] No in-app purchase UI, pricing, or external buy links in app bundle

### Infrastructure
- [ ] JWKS `timeoutDuration: 10_000` set on `createRemoteJWKSet`
- [ ] No `minInstances` set in Firebase webframeworks config
- [ ] Pre-fetched clips written to GCS (not held in Cloud Run memory)

## Testing

<!-- How was this tested? Emulator? Real device? Which roles? -->

## Screenshots / recordings (if UI change)

<!-- Attach or paste here -->
