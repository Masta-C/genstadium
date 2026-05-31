# CONTEXT.md — GenStadium Domain Language

> Single source of truth for domain terminology. Use these exact terms in code, issues, PRs, and conversations.
> Any AI assistant working in this repo must read this before writing any code or issues.

---

## Core Concepts

### Session
A single live production event. One session = one match, one game, one broadcast. Has a lifecycle: `lobby → live → ended`. Identified by a `sessionId` (Firestore document ID) and a human-readable `joinCode` (e.g. `REDS01`).

### Join Code
A short alphanumeric code (6 chars) that Camera and Score Keeper participants use to enter a Session. Displayed prominently by the Host. The Session lookup always goes through joinCode → sessionId.

### Scorebug
The live score overlay rendered by the layout page and visible in the YouTube stream. Shows home/away scores, period/time, team names/colours. Updates in real-time via Firestore. NOT rendered by Remotion. Lives at `graphics.genstadium.com`.

### Layout Page
The web page rendered inside LiveKit Egress headless Chrome. URL: `https://graphics.genstadium.com?layout={sessionId}`. Subscribes to Firestore for score state and director commands. Renders the Scorebug. Outputs frames to Egress A (Room Composite).

### Egress A
The LiveKit Egress job that composites the active camera feed + Scorebug overlay and streams to YouTube via RTMPS. One Egress A per Session. Started by Cloud Run on Go Live.

### Egress B
The LiveKit Egress job that records individual camera tracks to GCS as HLS segments. Creates the DVR buffer. One Egress B per Session. Started simultaneously with Egress A.

### DVR Buffer
The rolling window of recorded camera footage stored in GCS as 4-second HLS segments. Code enforces a 120-second window — only segments from the last 120 seconds are used for replay. GCS lifecycle is 1 day (safety net). Lives at `gs://{bucket}/dvr/{sessionId}/{cameraId}/`.

### Speculative Pre-fetch
The pattern where a Score Keeper event (e.g. a goal) immediately triggers Cloud Run to start encoding a replay clip from the DVR buffer — before the Director has requested it. The encoded clip is written to GCS at `gs://{bucket}/prefetched/{sessionId}/{cameraId}/{eventTimestamp}.mp4`. Eliminates replay latency from the Director's perspective.

### Replay Clip
A short MP4 video segment (typically 10-30 seconds) encoded from the DVR buffer after a significant event. Created by Cloud Run FFmpeg. Injected into the LiveKit Room via Ingress as a participant named `replay-clip-{n}`.

### LiveKit Ingress
A LiveKit feature that injects an external media source (MP4 via signed GCS URL) into a Room as a participant. Used for both Replay Clips and Ad Clips. The Director switches to the Ingress participant the same way they switch between cameras.

### Director Command
A Firestore write that changes the active camera source or scorebug visibility. Stored at `sessions/{sessionId}.directorState`. The Layout Page subscribes to this and updates immediately. Director commands are the ONLY mechanism for switching sources — never LiveKit SDK calls directly.

### Director State
The Firestore subdocument `{ activeSource: "cam_1", scorebugVisible: true }` that drives the Layout Page. `activeSource` can be a camera participant identity, `"replay-clip-{n}"`, or `"ad-{n}"`.

### eventConfig
The data-driven configuration object that defines what events are loggable for a given sport or event type. Contains `events[]`, `scoreDelta`, `metadata[]`, `scorebugLayout`, `periods[]`, `dataLabel`, `entryLabel`. Replaces the old `sportConfig` term — do not use `sportConfig` anywhere.

### Score Event
An entry written by the Score Keeper to `sessions/{sessionId}/events/{eventId}`. Contains `eventType`, `team`, `playerId`, `scoreDelta`, `metadata`, `timestamp`. A Cloud Function reads these and writes the aggregated score to `scoreState`.

### Score State
The aggregated score document at `sessions/{sessionId}/scoreState`. Written ONLY by Cloud Function (never by client). Contains `homeScore`, `awayScore`, `period`, `lastEvent`.

### Go Live
The Host action that starts the broadcast. Triggers: credit check → idempotent Egress A + B start → session status → `live`. Idempotent — safe to retry.

### Credit Balance
The number of events (sessions) a Host account is entitled to broadcast. Stored at `users/{uid}/credits.balance`. Written ONLY by Stripe/StoreKit webhook Cloud Function. Read by Cloud Run before every Go Live.

### Tier 0
The free, standalone scorebug product. Score Keeper + browser overlay. No cameras, no Director, no streaming. The top-of-funnel entry point for Tier 1.

### Tier 1
The full production product. All 4 roles, multi-camera stream to YouTube, instant replay, credit-based pricing.

---

## Roles

### Host
Creates and manages Sessions. Initiates Go Live. Purchases credits. Manages stream settings (YouTube key, teams, players). Uses email auth. The buyer persona.

### Director
Controls the live broadcast. Switches between camera sources. Triggers replays and ads. Controls Scorebug visibility. Physically present at the venue. No video preview of cameras (they can see the real action). Uses email auth.

### Camera
Joins a Session via Join Code. Publishes their phone camera as a LiveKit track. No app UI complexity — point and stream. Uses anonymous auth.

### Score Keeper
Joins a Session via Join Code. Logs Score Events using the eventConfig-defined event list. Does not see the stream. Uses anonymous auth.

---

## Infrastructure Terms

### Cloud Run
The Node.js/TypeScript backend service. Handles session orchestration, LiveKit token generation, replay pre-fetch, ad injection. Region: `asia-south1`. CPU-during-requests only + min-instances=1.

### Room
A LiveKit concept. One Room = one Session. Room name = sessionId. Participants: camera phones, Director (audio only), Ingress clips.

### Room Composite
LiveKit Egress type that mixes all Room participants + a custom layout URL into a single video stream. Used for Egress A.

### Track Egress
LiveKit Egress type that records individual participant tracks separately. Used for Egress B (DVR).

### RTMPS
The encrypted RTMP protocol used for YouTube live streaming. `rtmps://a.rtmp.youtube.com/live2/{streamKey}`.

### Egress Status
LiveKit Egress lifecycle: `STARTING → ACTIVE → ENDING → ENDED`. Cloud Run must wait for `ACTIVE` before writing `session.status = 'live'`. Timeout: 8 seconds.

### JWKS
JSON Web Key Set — Google's public keys used to verify Firebase ID tokens in Cloud Run. Fetched from `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`. Always set `timeoutDuration: 10_000` on `createRemoteJWKSet` to avoid cold start hangs.

---

## Anti-patterns (wrong terms — don't use)

| Wrong | Right |
|---|---|
| `sportConfig` | `eventConfig` |
| `superadmin` / `super_admin` | Does not exist in GenStadium |
| "simulcast" | Removed entirely — no Director previews |
| "RevenueCat" | Removed — use Stripe (Android/Web) + StoreKit (iOS) |
| "in-app purchase for credits" | Web purchase only on Android — StoreKit only on iOS |
| "Remotion for live scorebug" | Layout page is plain React + Firestore. Remotion = finite clips only |
| "hold clip in Cloud Run memory" | Always write to GCS immediately after FFmpeg encode |
| "renderMedia() in browser" | renderMedia() is Cloud Run only |
| "sportConfig.scoreDelta" | `eventConfig[sport].events[n].scoreDelta` |
