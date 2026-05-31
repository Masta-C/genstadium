# ADR-005: No Simulcast, No Director Video Previews

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

Remove simulcast entirely from the architecture. The Director does not receive live video previews of camera feeds in their app. Camera source selection is by name/label and connection status indicator only.

## Context

Original PRD proposed simulcast (multiple quality layers per camera track) to enable Director thumbnail previews without full-quality bandwidth. This was evaluated and rejected.

## Reasoning

1. **Director is physically at the venue** — they can see the action with their own eyes. Live video previews in the Director app add no information.
2. **Simulcast complexity is significant** — each camera phone publishes 2-3 layers; Director app subscribes to low-quality layer; adds bandwidth, battery drain, implementation complexity.
3. **Battery drain on camera phones** — publishing multiple simulcast layers drains battery ~40% faster on phones that need to last a full match.
4. **What the Director actually needs**: Know which camera is connected, know the signal quality. Name labels + status indicators fulfill this completely.

## What the Director Sees Instead

```
Camera sources panel:
  [CAM 1 - Left Wing]  🟢 Connected
  [CAM 2 - Right Wing] 🟢 Connected  
  [CAM 3 - Goal Cam]   🟡 Weak Signal
  [CAM 4 - Drone]      ⚫ Disconnected
  [REPLAY - Goal 23']  ← injected clip
  [AD - Sponsor]       ← injected clip

  LIVE (currently broadcasting: CAM 1)
```

Status indicators driven by LiveKit `ParticipantEvent` and track quality metrics — not video rendering.

## Consequences

**Positive:**
- Significant reduction in implementation complexity
- Camera phone battery life preserved
- Bandwidth per session reduced by ~40-60%
- Director app is much simpler to build and test

**Negative:**
- Director cannot see a feed before switching to it
- Mitigated by: physical presence at venue + camera operator communicates via voice/radio

## Review Trigger

Re-evaluate if Director use case expands to remote production (Director not physically present). In that case, simulcast with thumbnail previews becomes justified.
