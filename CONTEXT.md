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
The LiveKit Egress job that records the ISO Camera track to GCS as HLS segments. Creates the DVR buffer. One Egress B per Session. Records only the ISO Camera — not all camera tracks. Started simultaneously with Egress A.

### ISO Camera
The single camera slot designated by the Director as the dedicated replay source. Set during Camera Slots setup. Egress B records only this camera's track. Typically the wide-angle, static camera — chosen by the Director at session setup time, not dynamically at replay time. Stored as `session.replayCameraSlot` (e.g. `"cam_1"`). Defaults to `cam_1` if Director does not designate one.

### DVR Buffer
The rolling window of ISO Camera footage stored in GCS as 4-second HLS segments. Code enforces a 120-second window — only segments from the last 120 seconds are used for replay. GCS lifecycle is 1 day (safety net). Lives at `gs://{bucket}/dvr/{sessionId}/{isoSlot}/`.

### Speculative Pre-fetch
The pattern where a Score Keeper event with `triggers: ["prefetch"]` (e.g. goal, wicket, six) silently triggers Cloud Run to encode the last 20 seconds of the ISO Camera DVR buffer and write it to GCS — before the Director has requested it. The Score Keeper is unaware. The Director sees a "Replay Ready 🎬" indicator when the clip is ready. The clip is simply the 20 seconds of ISO Camera footage ending at the moment the event was logged — the system does not interpret what happened in the footage.

### Replay Clip
A 20-second MP4 video segment encoded from the ISO Camera's DVR buffer immediately after a significant event. Created by Cloud Run FFmpeg. Injected into the LiveKit Room via Ingress as a participant named `replay-clip-{n}`.

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
The Director action that starts the broadcast. Requires: ISO Camera present in Room (hard gate — Lobby blocks until confirmed). Triggers: credit check → idempotent Egress A + B start → session status → `live`. Idempotent — safe to retry.

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
Joins a Session via Join Code. Picks an available camera slot from a list (taken slots are greyed out in real-time). Publishes their phone camera as a LiveKit track using the slot name as their participant identity. No app UI complexity — point and stream. Uses anonymous auth. Director and Camera operators agree on slot assignments verbally before setup.

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
LiveKit Egress type that records a specific participant track to GCS. Used for Egress B (DVR). Targets the ISO Camera by `participantIdentity` — which equals the slot name, so no mapping layer is needed.

### RTMPS
The encrypted RTMP protocol used for YouTube live streaming. `rtmps://a.rtmp.youtube.com/live2/{streamKey}`.

### Egress Status
LiveKit Egress lifecycle: `STARTING → ACTIVE → ENDING → ENDED`. Cloud Run must wait for `ACTIVE` before writing `session.status = 'live'`. Timeout: 8 seconds.

### JWKS
JSON Web Key Set — Google's public keys used to verify Firebase ID tokens in Cloud Run. Fetched from `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`. Always set `timeoutDuration: 10_000` on `createRemoteJWKSet` to avoid cold start hangs.

---

## Score Keeper Terms

### Attribution Sheet
The bottom sheet that slides up for 8 seconds after a scoring event. Prompts the Score Keeper to identify the player responsible. Score is already registered on the board — the sheet is soft mandatory only. Auto-closes after 8 seconds and logs the event as "Unknown".

### T1 Button
Primary scoring button in the Score Keeper live screen. Large touch target (~56px). Triggers score change and score flash animation. Examples: Goal, +3, +2, SIX, FOUR, TD.

### T2 Button
Discipline event button. Medium size. Triggers a broadcast animation (lower third). Does not change score. Examples: Yellow Card, Red Card, Wicket, Foul.

### T3 Button
Admin and stats button. Small, 3–4 per row. Triggers no animation. Hold 300ms to see full name tooltip. Examples: Corner, Sub, Wide, No Ball, End Innings.

### On-Strike Toggle
Cricket-only UI element in the team header showing both batsmen. The active (on-strike) batsman is highlighted green. Auto-rotates on 1 or 3 runs. Score Keeper can tap to manually override.

### Innings Flip
The manual action in cricket where the Score Keeper ends the current innings and begins the next. Triggered via the T3 "END INN" button. Resets over counter and on-strike state for the new innings.

### Over Complete
The modal that appears in cricket after 6 legal balls have been bowled. Prompts the Score Keeper to select the next bowler before play continues. Ball counter and over number reset after selection.

### Guest Landing Screen
The shared screen shown to anyone joining via join code before they select their role. Shows session name, sport, and team names. Role picker: Camera Operator or Score Keeper. Step 1 of both the Camera and Score Keeper journeys.

### Soft Mandatory Attribution
The attribution pattern where a score event registers on the board and broadcast instantly, but the Attribution Sheet prompts for player identity for 8 seconds. Expires to "Unknown" — never blocks the score. Ensures match data quality without disrupting play flow.

### Replay Ready
The single 🎬 indicator on the Director's live screen signalling that a pre-fetched 20-second clip is available for broadcast. Appears after a Score Event with `triggers: ["prefetch"]` is processed. Only one badge at a time — most recent clip overwrites the previous. Disappears after Director broadcasts the clip or ISO Camera goes offline.

### Scorebug Style
The Director's one-time choice of overlay format made during session setup. Either **Scorebug** (persistent score display in corner of stream) or **Event Lower Third** (animated lower-third bar that fires on significant events). Cannot be changed after Go Live.

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
| "record all camera tracks" | Record only the ISO Camera track (Egress B = one Track Egress job) |
| "active camera for replay" | ISO Camera — designated at setup, not determined by Director state at event time |
