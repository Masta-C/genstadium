# ADR-007: Two Egress Jobs Per Session — Room Composite (A) + Track Egress (B)

**Status**: Accepted (revised 2026-06-04)
**Date**: 2026-05-31

## Decision

Start two LiveKit Egress jobs per Session on Go Live:
- **Egress A** (Livestream): Room Composite → YouTube RTMPS (the broadcast stream)
- **Egress B** (Replays): Track Egress → GCS HLS segments — records **only the ISO Camera**

## Revision (2026-06-04): ISO Camera replaces "record all tracks"

The original design recorded all camera tracks independently. This was revised because:

1. **Cost**: Recording N cameras costs N× Track Egress minutes. For 4 cameras at 90 min, that's 4× the Egress B cost with no V1 benefit.
2. **Multi-angle picker is not viable in V1**: ADR-005 prohibits video previews. Without thumbnails, a "pick your angle" UI is meaningless to a Director mid-broadcast.
3. **Active-camera recording has a race condition**: Pre-fetching from `directorState.activeSource` at event time means replay quality varies based on Director's camera choice at that moment. A close-up active camera produces a poor replay.

**Solution**: The Director designates one camera slot as the **ISO Camera** during session setup (Camera Slots screen). Egress B records only that slot's track. The ISO Camera is typically the static wide-angle camera — the best replay source regardless of where the Director's attention is.

## Architecture

### Egress A — Room Composite (Livestream)
```typescript
egressA = await egressClient.startRoomCompositeEgress(sessionId, {
  customBaseUrl: 'https://graphics.genstadium.com',
  layout: sessionId,   // passed as ?layout= query param
  stream: {
    urls: [`rtmps://a.rtmp.youtube.com/live2/${streamKey}`]
  }
})
```

- LiveKit spins up a headless Chrome instance
- Chrome renders `https://graphics.genstadium.com?layout={sessionId}`
- Layout page subscribes to Firestore for directorState + scoreState
- Headless Chrome output composited with active camera track
- Result streamed to YouTube via RTMPS

### Egress B — Track Egress (Replays / DVR)
```typescript
const isoSlot = session.replayCameraSlot ?? 'cam_1'  // default: first slot
// Camera participant identity === slot name ("cam_1", "cam_2", etc.)
// Set at token generation time by Cloud Run — identity: slotName
// No mapping layer needed: slot = LiveKit participant identity = DVR GCS path segment

egressB = await egressClient.startTrackEgress(sessionId, {
  filepath: `dvr/${sessionId}/${isoSlot}/{segmentTimestamp}.ts`,
  participantIdentity: isoSlot,  // resolves directly — identity === slot name
  segmentDuration: 4,
})
```

- Records **only the ISO Camera track** to GCS
- Camera participant identity in LiveKit = slot name (`"cam_1"`, `"cam_2"`) — set by Cloud Run at token generation. No mapping needed.
- 4-second HLS segments, 120-second rolling window enforced in code
- ISO Camera = `session.replayCameraSlot` (set by Director during Camera Slots setup)
- Default: `cam_1` if Director did not designate one
- Pre-fetch always uses `session.replayCameraSlot` as `cameraId` — slot = identity = GCS path segment, all the same string

## Go Live Sequence

```
1. Check credit balance (PAYMENT_REQUIRED if 0)
2. Check session status (return already_live if status === 'live') — idempotent
3. Check existing active Egress jobs (reuse if already 2 active) — idempotent
4. createRoom({ name: sessionId })  — idempotent LiveKit call
5. Generate LiveKit tokens for all participants → write to Firestore
6. Resolve ISO Camera: read session.replayCameraSlot → look up participant trackSid in Room
7. startRoomCompositeEgress → Egress A
8. waitForEgressStatus(egressA.egressId, 'ACTIVE', 8_000)  ← CRITICAL
9. startTrackEgress(isoCamera.trackSid) → Egress B
10. Update session: { status: 'live', startedAt, egressIds }
11. Decrement credit balance
```

**ISO Camera is a hard Go Live prerequisite**: The Lobby screen keeps the Go Live button disabled until the ISO Camera slot participant has joined the Room. Cloud Run verifies ISO Camera presence before starting either Egress job. This mirrors broadcast production — you don't roll until all ISO feeds are confirmed. Soft warning path (allow Go Live with partial DVR) is explicitly rejected.

**Step 7 is critical**: Layout page must be fully loaded and rendering before we declare the session live. Without waiting for ACTIVE status, the YouTube stream may start before the scorebug is visible.

## Idempotency

The entire Go Live sequence is safe to retry:
- `createRoom` is idempotent in LiveKit
- `listEgress({ roomName, active: true })` check prevents duplicate jobs
- Firestore `status === 'live'` check short-circuits the whole sequence

## ISO Camera UX (Director Setup)

The Director designates the ISO Camera during **Camera Slots** (step 3 of Director flow):

```
Camera Slots screen:
┌─────────────────────────────┐
│  Camera 1 — Wide Angle  📹  │  ← "Replay Source" toggle ON (radio — only one allowed)
│  Camera 2 — Goal End        │
│  Camera 3 — Sideline        │
└─────────────────────────────┘
```

- Only one slot can be designated Replay Source (radio, not multi-select)
- Default: `cam_1` if Director doesn't pick
- Tip shown: *"This camera records the full match for instant replays. Choose your best wide-angle view."*
- Can be reassigned from the Live screen (V2 — creates a brief DVR gap, shows warning)

**Slot assignment (Camera join flow):** All cameras use the single session Join Code. On joining, Camera sees a slot picker showing all configured slots with the Director's labels (e.g. "Wide Angle", "Goal End") plus the slot code. Taken slots are greyed out in real-time (Firestore `onSnapshot`). First to pick a slot locks it. Director and cameras agree on who gets which slot verbally before setup — no per-slot QR codes needed.

## Data Model Change

```typescript
// sessions/{sessionId}
{
  replayCameraSlot: "cam_1"  // which slot is the ISO Camera — set during Camera Slots setup
}
```

## ISO Camera Disconnect Mid-Session

- Track Egress auto-stops when participant leaves Room (LiveKit `participant_left` webhook)
- Cloud Run writes `session.replayCameraOnline = false` → Director sees banner: *"⚠️ Replay camera offline — replays paused"*
- On reconnect (`participant_joined` webhook): Cloud Run restarts Egress B, writes `replayCameraOnline = true`, DVR resumes
- **Pre-fetch abort on gap**: Cloud Run checks whether the most recent DVR segment timestamp is within 10 seconds of `eventTimestamp`. If the gap is larger (ISO Camera was offline), pre-fetch is aborted — no clip written, no badge shown. A stale partial clip is worse than no badge.

## Consequences

**Positive:**
- Clean separation: Egress A for audience, Egress B for production use (replay)
- ISO Camera records continuously — no DVR gaps from Director camera switching
- Pre-fetch `cameraId` is always deterministic: `session.replayCameraSlot`
- 75% reduction in Track Egress cost vs recording all camera tracks (4-camera session)
- Always the best replay angle — Director chose the wide-angle at setup time, not by accident

**Negative:**
- Two Egress jobs = 2× Egress cost vs a recording-only session
- Both jobs must be stopped on session end — always call endSession to stop both
- ISO Camera disconnect = replay gap (no fallback in V1)
- If Director forgets to designate ISO Camera: defaults to `cam_1` which may not be the best angle

**V2 upgrade path — multi-angle replay:**
Record all camera tracks (revert to original design). Add "Request angle" button on the Replay Ready badge that triggers on-demand encode for a secondary camera track (~20-30s wait, shown as progress). Acceptable for a "director's cut" replay, not blocking the live broadcast.
