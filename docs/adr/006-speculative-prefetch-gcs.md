# ADR-006: Speculative Pre-fetch Clips to GCS (Not In-Memory, Not On-Demand)

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

When a Score Keeper logs a significant event (goal, wicket, six, TD — any event with `triggers: ["prefetch"]` in `eventConfig`), immediately trigger Cloud Run to pre-encode the **last 20 seconds** of the ISO Camera DVR buffer and write the result to GCS. Do not hold encoded clips in Cloud Run memory. Do not wait for Director to request the replay.

The Score Keeper is unaware of this — they are just logging the match. The pre-fetch is a silent side-effect. The Director sees a single "Replay Ready 🎬" indicator when the clip is ready and taps it to broadcast. The system does not know what happened in the footage — it is simply the 20 seconds of ISO Camera feed ending at the moment the event was logged.

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
      → Fetch last 20s of DVR segments from gs://dvr/{sessionId}/{cameraId}/
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
- Clip duration: **20 seconds** fixed — all events, all sports (no per-event config)
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

## Badge Behaviour

- Director sees a **single "Replay Ready 🎬" indicator** — not one badge per event
- If a new pre-fetch completes while a previous clip is waiting, the new clip **overwrites** the old one
- Director taps the badge once → most recent clip injects as a LiveKit Ingress participant → plays, then switches back to live feed
- No queue, no expiry timer needed — single button, zero decision fatigue on the live control surface

## Consequences

**Positive:**
- Director gets near-instant replay injection (~2s GCS read vs ~30s encode-on-demand)
- No data loss if Cloud Run instance recycled
- Stateless Cloud Run — any instance can serve any request
- Single badge = zero live-screen clutter regardless of how many events fire

**Negative:**
- Pre-fetch may encode clips the Director never uses (event logged but replay not triggered)
- Back-to-back significant events (e.g. wicket + six in same over) → earlier clip silently replaced
- GCS write cost per pre-fetch: ~$0.0001 (negligible)
- Cloud Run must have FFmpeg available in the container image
