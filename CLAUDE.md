# CLAUDE.md — GenStadium

> This file is the single source of truth for any AI assistant working in this repo.
> Read it fully before touching any code. It replaces the need to re-explain the project each session.

---

## What is GenStadium?

A **broadcast-grade live sports production app** that turns smartphones into a multi-camera live stream. Operators scan QR codes to join a session as cameras. A Director switches between feeds. A Score Keeper logs events. The stream goes live to YouTube via LiveKit Egress. Designed as a **PWA-adjacent mobile app** (React Native + Expo) that works on the factory floor of sport — unreliable Wi-Fi, bright sunlight, no tech crew.

- **Phase**: Planning → Phase 1 (Tier 0 scorebug + Tier 1 full production)
- **Region**: `asia-south1` (all Firebase services)
- **Root**: `/Users/chetanpatil/genstadium`
- **PRD**: `docs/prd-v1.5-analysis.md`

---

## Current Phase

**Pre-development — prototype complete, architecture locked, repo scaffold not yet built.**

Prototype lives at `docs/prototype/index.html` (served on localhost:8899). All UX decisions locked from grill-me session + 2-session design sprint. Next step: Figma design → repo scaffold.

### Tier 0 (ship first — scorebug only, free)
- Score Keeper phone + browser overlay
- No cameras, no Director, no streaming
- Used as a **top-of-funnel lead magnet** for Tier 1

### Tier 1 (full production)
- 3 roles: Director (merged Host+Director), Camera, Score Keeper
- Multi-camera stream → YouTube via LiveKit Egress (Livestream)
- Instant replay via LiveKit Ingress + FFmpeg pre-fetch (Replays → GCS)
- Credits purchased on web, consumed in-app

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| App | React Native + Expo (SDK 52+) | iOS + Android, EAS Build for distribution |
| Language | TypeScript (strict) | Across app + Cloud Run |
| Database | Cloud Firestore | Real-time state bus for director commands, score events, session state |
| Auth | Firebase Auth | Email+Password for Host/Director, Anonymous for Camera/Score Keeper |
| SFU | LiveKit Cloud | WebRTC ingestion from phones. Room = Session. |
| Egress | LiveKit Egress | Egress A: Room Composite → YouTube RTMP. Egress B: Track Egress → GCS DVR |
| Ingress | LiveKit Ingress | URL input — injects MP4 clips as Room participants for replay + ads |
| Backend | Cloud Run (Node.js/TypeScript) | Session orchestration, replay engine, ad injection. Region: asia-south1 |
| Graphics | Remotion + Firebase Hosting | Layout page at graphics.genstadium.com — Firestore-subscribed React web page |
| Storage | Google Cloud Storage | DVR segments, pre-fetched replay clips, ad MP4s |
| Payments | Stripe (web) + StoreKit (iOS IAP) | See ADR-009. Web purchase at genstadium.com/buy |
| State (app) | Zustand | Auth store + session state |
| Styling | NativeWind (Tailwind for RN) | Design tokens via Tailwind config |
| Validation | Zod | All inputs, env vars, Firestore writes from Cloud Run |
| Testing | Jest + Testing Library | App + Cloud Run unit tests |
| PWA/Native | Expo EAS | EAS Build + EAS Submit + EAS Update (OTA for JS changes) |

---

## Roles & Permissions

> **Host role has been removed.** Host and Director are merged into a single Director role.

```
director     → create sessions, label cameras, set sport, set animations, connect YouTube,
               go live, switch camera sources, trigger replays, end session, view credits
camera       → publish video feed to LiveKit room (guest join — name only, no account)
scorekeeper  → log score events, manage game state (guest join — name only, no account)
```

Role is stored as a **Firestore field** on the session participant document, NOT as a JWT custom claim (anonymous users don't have stable UIDs for claims).

Server-side enforcement:
1. **Firestore rules** — `firestore.rules` (session participant role checked)
2. **Cloud Run** — verifies role from Firestore before processing session commands
3. **LiveKit token grants** — `canPublish`, `canSubscribe` set per role at token generation

---

## Data Model

| Collection | Key fields | Notes |
|---|---|---|
| `sessions/{sessionId}` | id, eventType, joinCode, status, createdBy, teams, players, participants, directorState, createdAt | See full schema in ADR-005 |
| `sessions/{sessionId}/scoreState` | homeScore, awayScore, period, lastEvent | Written by Cloud Function only |
| `sessions/{sessionId}/events/{eventId}` | eventType, team, playerId, scoreDelta, metadata, timestamp | Score Keeper writes directly |
| `sessions/{sessionId}/stageHistory/{stageId}` | subcollection, never array | Unbounded history safe |
| `users/{uid}` | uid, email, displayName, role, createdAt | Host/Director only (anonymous users not stored) |
| `users/{uid}/credits` | balance, transactions[] | Written by Stripe webhook Cloud Function only |

**Session status flow**: `lobby → live → ended`

**eventConfig pattern** (replaces sportConfig — see ADR-008):
```typescript
const eventConfig = {
  football: {
    dataLabel: "Teams",
    entryLabel: "Score Keeper",
    scoreUnit: "goals",
    events: [
      { id: "goal", label: "Goal", scoreDelta: { team: 1 }, metadata: [], triggers: ["prefetch", "animation"] },
      { id: "yellow_card", label: "Yellow Card", scoreDelta: null, metadata: [], triggers: [] },
    ],
    scorebugLayout: "football",
    periods: ["First Half", "Second Half", "Extra Time"]
  },
  custom: { scoreUnit: "points", events: [], scorebugLayout: "generic" }
}
```

---

## Auth Architecture

**Settled — do not redesign without explicit instruction.**

```
Host/Director login
  → signInWithEmailAndPassword (Firebase client SDK)
  → getIdToken() → POST /api/session/start { idToken }
  → Cloud Run verifies token, generates LiveKit token with role grants
  → Returns { liveKitToken, sessionId }

Camera/Score Keeper join
  → signInAnonymously (Firebase client SDK)
  → POST /api/session/join { joinCode, role }
  → Cloud Run looks up session by joinCode, verifies session is live
  → Generates LiveKit token with appropriate publish/subscribe grants
  → Returns { liveKitToken, sessionId }

Token expiry
  → LiveKit token: 6 hours (covers any match length)
  → Firebase ID token: 1 hour (auto-refreshed by Firebase SDK)
  → Anonymous sessions: do not persist between app restarts
```

**Known patterns — apply from day 1:**
1. `connectAuthEmulator` guard must use `window.__gsEmulatorsConnected` (not module-level variable — React Native Fast Refresh resets module scope)
2. Never call `getIdToken(true)` (force-refresh) inside `useEffect` on every mount — Firebase SDK handles refresh automatically
3. Anonymous auth → account linking order: `linkWithCredential` BEFORE any Firestore write under the new UID
4. Google Sign-In on React Native: SHA-1 fingerprint is different for debug / release / EAS build — register all three in Firebase Console
5. iOS: `REVERSED_CLIENT_ID` URL scheme must be in `app.json` → `expo.ios.infoPlist.CFBundleURLTypes` or Google OAuth redirect fails silently
6. `expo-auth-session` does NOT work in Expo Go for native Google Sign-In — dev build required

---

## Payment Architecture

**Settled — do not redesign without explicit instruction. See ADR-009.**

```
iOS:     Native StoreKit → Cloud Function webhook → credits write to Firestore
Android: Stripe web (genstadium.com/buy) → Stripe webhook → Cloud Function → credits write
Web:     Stripe web → Cloud Function → credits write

App UI (all platforms):
  Shows: credit balance only ("3 events remaining")
  NO pricing, NO purchase button, NO external links in-app
  Onboarding email contains: "Buy your first event → genstadium.com/buy"

Credit check before Go Live:
  → Cloud Run reads users/{uid}/credits.balance
  → balance === 0 → return PAYMENT_REQUIRED
  → balance > 0 → proceed, decrement after egress starts
```

**Why Stripe not RevenueCat**: RevenueCat removed entirely. One SDK removed, not added. Stripe was already in PRD for Pro Tier — promoted earlier. iOS IAP handled natively (one StoreKit call). App Store cannot reject the app for no in-app purchase UI if none exists.

---

## LiveKit Architecture

**Livestream (was Egress A)** — Room Composite → YouTube RTMP
- Headless Chrome renders `graphics.genstadium.com?layout={sessionId}`
- Layout page subscribes to Firestore for score state + director commands
- Output: RTMPS stream to YouTube
- Optional — Director can skip and record locally only

**Replays (was Egress B)** — Track Egress → GCS DVR
- Records **only the ISO Camera** track (not all cameras) — `session.replayCameraSlot`
- ISO Camera designated by Director during Camera Slots setup (default: `cam_1`)
- 4-second segments, 120-second rolling window enforced in code
- GCS lifecycle: 1 day (safety net only — code enforces the 120s window)
- Director taps "Replay Ready 🎬" badge to broadcast a clip
- If ISO Camera is offline: badge stops appearing, Director sees ⚠️ warning

**Replay flow** (speculative pre-fetch):
1. Score Keeper logs event with `triggers: ["prefetch"]`
2. Cloud Function fires immediately: fetches last N seconds from DVR GCS path
3. FFmpeg encodes clip → writes to `gs://prefetched/{sessionId}/{cameraId}/{eventTimestamp}.mp4`
4. Director requests replay → Cloud Run creates LiveKit Ingress with signed GCS URL
5. Ingress joins Room as participant → Director switches to it via Firestore command
6. Layout page shows clip, then switches back to live feed

**Ad injection** — same Ingress pattern with sponsor MP4 instead of replay clip.

**Director commands** — Firestore is the command bus:
```
sessions/{sessionId}.directorState.activeSource = "cam_1" | "replay-clip-1" | "ad-1"
sessions/{sessionId}.directorState.scorebugVisible = true | false
```
Layout page (Egress headless Chrome) subscribes via `onSnapshot`. Latency: ~100-230ms.

---

## Cloud Run Module Structure

```
cloud-run/src/
  session/      — startSession, endSession, Egress job management
  replay/       — FFmpeg encode, pre-fetch, Ingress job for clip injection
  ads/          — ad trigger, Ingress job for ad MP4, sponsor report
  graphics/     — layout URL construction, Egress config
  webhooks/     — LiveKit webhook handlers, Stripe webhook handlers
  auth/         — token verification, LiveKit token generation
```

**Go Live sequence (idempotent — handles retries safely):**
```typescript
async function startSession(sessionId, uid) {
  const credits = await db.doc(`users/${uid}/credits`).get()
  if ((credits.data()?.balance ?? 0) === 0) throw new Error('PAYMENT_REQUIRED')
  const session = await db.doc(`sessions/${sessionId}`).get()
  if (session.data().status === 'live') return { status: 'already_live' }
  const existingEgress = await egressClient.listEgress({ roomName: sessionId, active: true })
  if (existingEgress.length >= 2) { /* reuse */ }
  else {
    await livekitClient.createRoom({ name: sessionId })  // idempotent
    egressA = await egressClient.startRoomCompositeEgress(...)
    await waitForEgressStatus(egressA.egressId, 'ACTIVE', 8_000)
    egressB = await egressClient.startTrackEgress(...)
  }
  await db.doc(`sessions/${sessionId}`).update({ status: 'live', startedAt: FieldValue.serverTimestamp() })
}
```

---

## Graphics Layer

- **URL**: `https://graphics.genstadium.com` (Firebase Hosting)
- **Tech**: React web app, subscribes to Firestore `onSnapshot`
- **Remotion**: Used ONLY for finite pre-rendered clips (goal animations, transitions). NOT for live scorebug.
- **Live scorebug**: Plain React component re-rendering on Firestore updates
- **`renderMedia()`**: Only called on Cloud Run for goal animation clips, NOT in the browser
- **Layout page receives sessionId via**: `?layout={sessionId}` query param (Egress passes this)

---

## Infra Checklist

### ✅ Locked in architecture
- LiveKit Cloud SFU (not self-hosted) — see ADR-001
- Firebase as real-time state bus — see ADR-002
- Remotion for finite clips only — see ADR-003
- Stripe web + iOS IAP payments — see ADR-009
- No simulcast, no Director video previews — see ADR-005
- Speculative pre-fetch to GCS — see ADR-006
- Egress A + B architecture — see ADR-007
- eventConfig extensible model — see ADR-008
- Cloud Run CPU-during-requests + min-instances=1 — see ADR-006

### ❌ Not yet built
- Firebase project creation
- Firestore security rules
- LiveKit Cloud project + API keys
- Cloud Run service deployment
- EAS project configuration
- Google Sign-In OAuth client setup (with all 3 SHA-1 fingerprints)
- Stripe account + webhook setup
- GitHub repo + CI/CD
- `genstadium-dev-ready` skill (shell written, needs port/health-check details)

---

## Dev Environment

**Always use the `genstadium-dev-ready` skill before working on auth, Firestore, or LiveKit-dependent features.**

```bash
# Ports
Auth emulator:      localhost:9099
Firestore emulator: localhost:8080
Functions emulator: localhost:5001
Emulator UI:        localhost:4000
Cloud Run local:    localhost:8081
Expo Metro:         localhost:8082
```

**Test credentials**
| Role | Email | Password |
|---|---|---|
| host | host@genstadium.dev | Test1234! |
| director | director@genstadium.dev | Test1234! |

Camera and Score Keeper: anonymous auth via join code. Test join code: `TEST01`

---

## Current Phase

**Pre-development — architecture locked, AGENT.md written, monorepo scaffold not yet built.**

Next step: run `#2` (monorepo scaffold) then start Ralph Loop from `#17` (eventConfig).

Ralph Loop start command:
```
/loop Read AGENT.md at /Users/chetanpatil/genstadium/AGENT.md and execute one full Ralph Loop iteration for the GenStadium repo at /Users/chetanpatil/genstadium
```

---

## Score Keeper UX — Locked Decisions

### 3-Tier Button System
- **T1 — Primary scoring** (large, ~50% panel space): Goals, +3/+2, SIX/FOUR, TD. Bold numbers or sport icons. Green tint.
- **T2 — Discipline events** (medium): Cards, fouls, wickets. Triggers broadcast animation. Colour = caution/danger.
- **T3 — Admin / stats** (small, 3–4 per row): Corners, subs, extras. Text abbreviations OK.
- **Hold 300ms** on any T3 → tooltip shows full name + description. First-session onboarding teaches this.

### Attribution System (soft mandatory, 8s)
- Score registers on board + broadcast **instantly**
- Attribution sheet slides up for **8 seconds**
- Timer expires → auto-logs as **"Unknown"** (visible in scorecard with grey badge)
- Score is NEVER blocked by attribution
- Simple picker: Card / Foul. Rich sheet: Wicket (batsman+bowler+dismissal+fielder). Sub: player IN + OUT.

### Cricket On-Strike Toggle
- Both batsmen shown in team header; active highlighted in green
- Auto-rotates on 1 and 3 runs; manual override by tapping the other chip

### Undo: stack-based always visible + 10-event log for targeted removal

### Overlays: always on, lower third fires automatically, no Director toggle

### Scorecard (end of session)
- Match-level stats only, no career data
- Cricket: Batting (R/B/4s/6s/SR) + Bowling (O/M/R/W/ECO)
- Basketball: PTS + Fouls per player
- Soccer / Am. Football: chronological event log
- Pickleball / Badminton: game-by-game table + fault breakdown

---

## Director Flow (11 steps — locked)

Sign Up → Create Session (name+sport) → Camera Slots → Event Animations → Share Link → Lobby → Livestream Setup (optional YouTube) → Go Live → Live (camera switching + Replay banner) → End Session → Summary

## Score Keeper Flow (9 steps — locked)

Guest Landing → Guest Join → Team Setup (names+colours) → Roster Setup (flexible, skip ok) → Who Goes First (toss) → Ready (onboarding overlay fires) → Live Scoring (landscape split panel) → Event Log → Session Ended + Scorecard

## Camera Flow (5 steps — locked)

Guest Landing → Guest Join → Pick Slot (Director's labels + real-time availability) → Camera Live (viewfinder + LIVE badge + flip + signal) → Session Ended

---

## Claude's Rules — DO

- **Run `genstadium-dev-ready`** before any work involving auth, Firestore, or LiveKit-dependent features
- **Use `firebase-auth-preflight`** before implementing any new auth flow — checks for all known Firebase + React Native pitfalls upfront
- **Register all 3 SHA-1 fingerprints** in Firebase Console for Google Sign-In: debug keystore, release keystore, EAS Build keystore
- **Set `REVERSED_CLIENT_ID` in `app.json`** before testing Google Sign-In on iOS — silent failure if missing
- **Use a dev build (not Expo Go)** when testing any native Firebase module or Google Sign-In
- **Read `users/{uid}/credits.balance` in Cloud Run** before starting any Egress job — never trust client-side credit display
- **Write audit log entries** for session start, end, replay trigger, ad trigger, and any credit transaction
- **Use Zod** to validate all Cloud Run request bodies before touching Firestore
- **Add Firestore indexes** to `firestore.indexes.json` for every compound query added
- **Call `initAdminApp()`** at the top of every Cloud Run handler before using Admin SDK services
- **Set JWKS timeout** on `createRemoteJWKSet`: `timeoutDuration: 10_000` — hangs indefinitely on cold start without it
- **Use `atob()` for JWT decoding** in any Edge Runtime / browser context — never `Buffer.from(str, 'base64url')`
- **Run `npm run typecheck` and `npm run lint`** before marking any task done
- **Branch from `develop`** for all feature work: `feature/short-description`

## Claude's Rules — DON'T

- **Never write to production Firestore** — always verify emulator env vars set before any script Firestore write
- **Never `git push` to `main` or `develop` directly** — PRs only
- **Never call `connectAuthEmulator` more than once** — guard with `window.__gsEmulatorsConnected`
- **Never call `getIdToken(true)` (force-refresh) in a `useEffect` that runs on every mount** — Firebase SDK handles refresh
- **Never store role in JWT custom claims for anonymous users** — role is in Firestore session participant doc
- **Never add client-side-only role checks as the sole protection** — Firestore rules are the real gate
- **Never show pricing, purchase buttons, or external buy links inside the app** — App Store rejection risk
- **Never call `renderMedia()` in the browser** — Remotion rendering is Cloud Run only (CPU-intensive)
- **Never hold pre-fetched clips in Cloud Run memory** — write to GCS immediately after FFmpeg encode
- **Never start Egress without `waitForEgressStatus(..., 'ACTIVE', 8_000)`** — race condition with layout page rendering
- **Never self-host LiveKit in Phase 1** — LiveKit Cloud until traffic justifies it (see ADR-001)
- **Never add `// @ts-ignore` or `// @ts-expect-error`** without a comment explaining why
- **Never set `minInstances` in Firebase webframeworks config** — incompatible with pinned rewrites (causes deploy error)

---

## Architecture Decisions — Locked

See `docs/adr/` for full rationale. Summary:

| ADR | Decision |
|---|---|
| 001 | LiveKit Cloud SFU — not self-hosted |
| 002 | Firebase Firestore as real-time state bus — not custom WebSocket |
| 003 | Remotion for finite clips only — live scorebug is plain React |
| 004 | Cloud Run for session orchestration — not Firebase Functions for long-running ops |
| 005 | No simulcast, no Director video previews — camera name labels + connection status |
| 006 | Speculative pre-fetch to GCS — not in-memory, not on-demand |
| 007 | Egress A (Room Composite → YouTube) + Egress B (Track → DVR GCS) |
| 008 | eventConfig extensible model — 3 Phase 1 changes for Phase 4 non-sports generalization |
| 009 | Platform split payments — iOS StoreKit, Android+Web Stripe, no RevenueCat |

---

## Open Architecture Questions (ask before building)

1. **Google Sign-In vs email-only for Host/Director**: Google Sign-In is better UX but requires native module + SHA-1 setup. Worth it for Phase 1 or start with email-only?
2. **Shift/session time limits**: Should sessions auto-end after X hours? LiveKit Egress jobs have costs that accrue if forgotten.
3. **Multi-camera limit**: PRD says 5 cameras max for Tier 1. Enforced at token generation (LiveKit room max participants) or Firestore rule?
4. **FCM push notifications**: Supervisors/hosts notified of rework/QA failures? Not in scope yet but needs FCM setup in Phase 3.
5. **Director role on-device**: Director uses phone or laptop? Affects UI decisions significantly.

---

## File Map (planned — not yet scaffolded)

```
app/
  (auth)/
    login/              Host/Director email login
    join/               Camera/Score Keeper join via code
  (session)/
    lobby/              Pre-stream session setup
    live/               Director control surface
    score/              Score Keeper event logging
    camera/             Camera participant view
  components/
    scorebug/           Scorebug overlay component
    director/           Source selector, replay trigger
  hooks/
    useSession.ts       Firestore session subscription
    useAuth.ts          Firebase auth state → Zustand
    useLiveKit.ts       LiveKit room connection
  store/
    authStore.ts        Zustand: user, role, loading
    sessionStore.ts     Zustand: session state
  lib/
    firebase/
      client.ts         Firebase client SDK + emulator guard
      admin.ts          Admin SDK (Cloud Run only)
    livekit/
      tokens.ts         Token generation (Cloud Run)
      room.ts           Room connection helpers
    eventConfig.ts      Sport/event configuration registry

cloud-run/
  src/
    session/
    replay/
    ads/
    graphics/
    webhooks/
    auth/

graphics/               Firebase Hosting — layout page
  src/
    App.tsx             Firestore-subscribed scorebug layout
    components/
      Scorebug.tsx
      LowerThird.tsx

scripts/
  seed-auth.ts          Creates test host/director users
  seed.ts               Seeds Firestore: test session, eventConfig

docs/
  adr/                  Architecture Decision Records
  prd-v1.5-analysis.md  PRD analysis + architecture fixes from design session
```
