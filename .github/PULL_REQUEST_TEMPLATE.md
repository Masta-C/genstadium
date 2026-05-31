## What does this PR do?

<!-- 1-3 sentences. What changed and why. -->

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
- [ ] Tests added or updated for new behaviour

### Domain integrity
- [ ] Uses `eventConfig` (not `sportConfig`)
- [ ] No pricing / purchase UI added to the app
- [ ] No simulcast / Director video preview added
- [ ] CONTEXT.md updated if new domain terms introduced
- [ ] ADR created or updated if architecture decision made

### Auth (if auth-related)
- [ ] `firebase-auth-preflight` skill run before implementation
- [ ] Cookie named `__session` (not anything else)
- [ ] No JSON stored in cookie — plain string only
- [ ] All middleware responses wrapped with `Cache-Control: no-store, private`
- [ ] `connectAuthEmulator` uses `window.__gsEmulatorsConnected` guard
- [ ] No `getIdToken(true)` force-refresh in `useEffect`
- [ ] For Google Sign-In: all 3 SHA-1 fingerprints registered

### Firestore
- [ ] New compound queries have indexes in `firestore.indexes.json`
- [ ] Firestore rules updated and tested if new collections/roles added
- [ ] `initAdminApp()` called at top of any new Cloud Run handler

### Payments (if payment-related)
- [ ] Credit balance written only by Cloud Function (never client)
- [ ] No in-app purchase UI, pricing, or external links in app bundle

### Infrastructure
- [ ] No `minInstances` set in Firebase webframeworks config
- [ ] Pre-fetched clips written to GCS (not held in Cloud Run memory)
- [ ] JWKS `timeoutDuration: 10_000` set on `createRemoteJWKSet`

## Testing

<!-- How was this tested? Emulator? Real device? Which roles? -->

## Screenshots / recordings (if UI change)

<!-- Attach or paste here -->
