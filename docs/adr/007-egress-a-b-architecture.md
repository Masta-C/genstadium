# ADR-007: Two Egress Jobs Per Session — Room Composite (A) + Track Egress (B)

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

Start two LiveKit Egress jobs per Session on Go Live:
- **Egress A**: Room Composite → YouTube RTMPS (the broadcast stream)
- **Egress B**: Track Egress → GCS HLS segments (the DVR buffer for replay)

## Architecture

### Egress A — Room Composite
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

### Egress B — Track Egress
```typescript
egressB = await egressClient.startTrackEgress(sessionId, {
  filepath: `dvr/{sessionId}/{trackId}/{segmentTimestamp}.ts`,
  segmentDuration: 4,
})
```

- Records each camera track independently to GCS
- 4-second HLS segments
- All tracks recorded regardless of which is "active" — Director can replay any camera

## Go Live Sequence

```
1. Check credit balance (PAYMENT_REQUIRED if 0)
2. Check session status (return already_live if status === 'live') — idempotent
3. Check existing active Egress jobs (reuse if already 2 active) — idempotent
4. createRoom({ name: sessionId })  — idempotent LiveKit call
5. Generate LiveKit tokens for all participants → write to Firestore
6. startRoomCompositeEgress → Egress A
7. waitForEgressStatus(egressA.egressId, 'ACTIVE', 8_000)  ← CRITICAL
8. startTrackEgress → Egress B
9. Update session: { status: 'live', startedAt, egressIds }
10. Decrement credit balance
```

**Step 7 is critical**: Layout page must be fully loaded and rendering before we declare the session live. Without waiting for ACTIVE status, the YouTube stream may start before the scorebug is visible.

## Idempotency

The entire Go Live sequence is safe to retry:
- `createRoom` is idempotent in LiveKit
- `listEgress({ roomName, active: true })` check prevents duplicate jobs
- Firestore `status === 'live'` check short-circuits the whole sequence

## Consequences

**Positive:**
- Clean separation: Egress A for audience, Egress B for production use (replay)
- DVR buffer available for all camera angles simultaneously
- Egress B runs even when a camera is not "active" — historical footage of every angle

**Negative:**
- Two Egress jobs = 2x Egress cost per session
- Both jobs must be stopped on session end — always call endSession to stop both
