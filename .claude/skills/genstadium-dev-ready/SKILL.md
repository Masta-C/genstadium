---
name: genstadium-dev-ready
description: Start, seed, and validate the GenStadium local development environment — Firebase emulators (Auth, Firestore, Functions) + Cloud Run local server + Expo Metro bundler. Use whenever working on GenStadium and you need to check if the dev environment is running, start it from scratch, re-seed test data, or verify all services are healthy. Trigger on phrases like "start the dev environment", "spin up emulators", "dev ready", "start genstadium locally", or any time about to test auth, Firestore, LiveKit tokens, or Cloud Run endpoints.
---

# GenStadium Dev Ready

Start, validate, and seed the full local GenStadium dev stack in the right order.

## Stack

| Service | Port | Start command |
|---|---|---|
| Firebase Auth emulator | 9099 | `firebase emulators:start` |
| Firestore emulator | 8080 | (same process) |
| Functions emulator | 5001 | (same process) |
| Emulator UI | 4000 | (same process) |
| Cloud Run local | 8081 | `npm run dev` in `cloud-run/` |
| Expo Metro | 8082 | `npx expo start` in `app/` |

---

## Step 1 — Check What's Already Running

Run these checks individually (never chain with `&&` — zsh `status=$(...)` is unreliable):

```bash
curl -s http://localhost:9099 -o /dev/null -w "%{http_code}"
curl -s http://localhost:8080 -o /dev/null -w "%{http_code}"
curl -s http://localhost:5001 -o /dev/null -w "%{http_code}"
curl -s http://localhost:4000 -o /dev/null -w "%{http_code}"
curl -s http://localhost:8081/health -o /dev/null -w "%{http_code}"
```

**Interpret**:
- `200` or `404` = service is up (404 just means no route at `/`, that's fine)
- `000` = service is NOT running

---

## Step 2 — Start What's Missing

**Firebase Emulators** (if ports 9099, 8080, 5001 are down):
```bash
# From repo root — imports snapshot so emulators boot pre-loaded
firebase emulators:start --import=./emulator-data --export-on-exit
```
Wait for: `All emulators ready!` in terminal output.

**Cloud Run local** (if port 8081 is down):
```bash
# From cloud-run/ directory
FIRESTORE_EMULATOR_HOST=localhost:8080 \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
LIVEKIT_API_KEY=devkey \
LIVEKIT_API_SECRET=devsecret \
LIVEKIT_URL=wss://dev.livekit.cloud \
npm run dev
```
Wait for: `Cloud Run local server listening on :8081`

**Expo Metro** (if port 8082 is down — only needed for app work):
```bash
# From app/ directory
EXPO_PUBLIC_USE_EMULATOR=true \
EXPO_PUBLIC_CLOUD_RUN_URL=http://localhost:8081 \
npx expo start
```

---

## Step 3 — Seed Data (if Firestore is empty)

Check if seed needed:
```bash
curl -s "http://localhost:8080/v1/projects/genstadium-dev/databases/(default)/documents/users" | python3 -c "import sys,json; d=json.load(sys.stdin); print('has_users:', len(d.get('documents', [])) > 0)"
```

If `has_users: False`, run seed:
```bash
# Auth users
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
FIRESTORE_EMULATOR_HOST=localhost:8080 \
npx ts-node --esm scripts/seed-auth.ts

# Firestore data
EXPO_PUBLIC_USE_EMULATOR=true \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
FIRESTORE_EMULATOR_HOST=localhost:8080 \
npx ts-node --esm scripts/seed.ts
```

---

## Step 4 — Health Check

Verify Cloud Run is running and connected to emulators:
```bash
curl -s http://localhost:8081/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d)"
```
Expected: `{ "status": "ok", "firestore": "emulator", "auth": "emulator" }`

---

## Step 5 — Report Status

Output a summary table:

```
✅ Firebase Auth emulator    localhost:9099
✅ Firestore emulator        localhost:8080
✅ Functions emulator        localhost:5001
✅ Emulator UI               localhost:4000
✅ Cloud Run local           localhost:8081
⚫ Expo Metro                localhost:8082  (start manually if needed)

Test credentials:
  host@genstadium.dev     / Test1234!
  director@genstadium.dev / Test1234!
  Camera/Score Keeper: anonymous auth via join code TEST01

⚠️  Always test auth in an incognito window — stale cookies cause redirect loops
```

---

## Known Issues

- **Emulator boot order matters**: Firebase emulators must be running before Cloud Run local starts (Cloud Run connects to Firestore on startup)
- **`window.__gsEmulatorsConnected` guard**: If Firebase SDK connects twice (Fast Refresh), auth emulator breaks silently — check `window.__gsEmulatorsConnected` in browser console
- **Expo Go**: Do NOT test Google Sign-In in Expo Go — requires a dev build. Anonymous auth works in Expo Go.
- **LiveKit**: Local dev uses LiveKit Cloud (not emulated). LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be real LiveKit Cloud keys for any streaming tests. Score/director flow works without LiveKit.

---

## Before Running `firebase-auth-preflight`

If you're about to implement a new auth flow, run `firebase-auth-preflight` first. It will check your stack config against known pitfalls before you write a line of code.
