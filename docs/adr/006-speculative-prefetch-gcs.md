# ADR-006: Speculative Pre-fetch Clips to GCS (Not In-Memory, Not On-Demand)

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

When a Score Keeper logs a significant event (e.g. goal), immediately trigger Cloud Run to pre-encode the replay clip from the DVR buffer and write the result to GCS. Do not hold encoded clips in Cloud Run memory. Do not wait for Director to request the replay.

## Context

Three approaches to replay clip availability were evaluated:

| Approach | Latency | Risk |
|---|---|---|
| On-demand (encode when Director requests) | 15-45s encode delay | Director waits, live stream awkward pause |
| In-memory pre-fetch (encode immediately, hold in RAM) | ~0s on Director request | Cloud Run instance recycled → clip lost |
| GCS pre-fetch (encode immediately, write to GCS) | ~2s to read from GCS on request | No data loss, fast delivery |

## Architecture

```
Score Keeper logs goal event
  → Firestore write: sessions/{sessionId}/events/{eventId}
  → Cloud Function trigger (onWrite)
  → Cloud Run POST /replay/prefetch { sessionId, cameraId, eventTimestamp }
      → Fetch last 30s of DVR segments from gs://dvr/{sessionId}/{cameraId}/
      → FFmpeg: concat + encode → MP4
      → Write to gs://prefetched/{sessionId}/{cameraId}/{eventTimestamp}.mp4
      → Firestore write: sessions/{sessionId}/prefetchedClips/{clipId} = { gcsPath, ready: true }

Director requests replay
  → Cloud Run POST /replay/inject { sessionId, clipId }
      → Read gcsPath from Firestore
      → Create LiveKit Ingress with signed GCS URL
      → Ingress joins Room as "replay-clip-{n}"
      → Write director command: activeSource = "replay-clip-{n}"
```

## DVR Buffer

- GCS path: `gs://{bucket}/dvr/{sessionId}/{cameraId}/{segment}.ts`
- Segment duration: 4 seconds
- Code enforces 120-second window — replay engine only fetches segments with timestamps within last 120s
- GCS object lifecycle: 1 day (safety net only, not relied upon for the 120s window)
- Storage cost per match: ~$0.0017 (negligible)

**Note:** PRD v1.5 incorrectly stated GCS lifecycle policy auto-deletes after 120 seconds. GCS lifecycle minimum is ~1 day. The 120-second window is enforced entirely in code.

## Cloud Run CPU Mode

Using "CPU during requests only" + `min-instances=1`:
- Instance stays alive (no cold start) but CPU is throttled between requests
- FFmpeg encode happens during a request — CPU is fully allocated
- Pre-fetched clips in GCS eliminate need for continuous background CPU
- Do NOT use "always-on CPU" — not needed and costs ~3x more

## Consequences

**Positive:**
- Director gets near-instant replay injection (~2s GCS read vs ~30s encode-on-demand)
- No data loss if Cloud Run instance recycled
- Stateless Cloud Run — any instance can serve any request

**Negative:**
- Pre-fetch may encode clips the Director never uses (event logged but replay not triggered)
- GCS write cost per pre-fetch: ~$0.0001 (negligible)
- Cloud Run must have FFmpeg available in the container image
