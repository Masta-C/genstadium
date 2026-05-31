# ADR-003: Remotion for Finite Clips Only — Live Scorebug is Plain React

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

Use Remotion's `renderMedia()` only for finite, pre-rendered clips (goal animations, transitions). The live scorebug in the Layout Page is a plain React component that re-renders on Firestore `onSnapshot` updates. `renderMedia()` is never called in the browser.

## Context

PRD v1.5 ambiguously described Remotion as powering the live scorebug. This led to confusion about whether Remotion Player was required for live rendering.

## Clarification

| Use case | Technology | Reason |
|---|---|---|
| Live scorebug (always-on overlay in stream) | Plain React + Firestore onSnapshot | Remotion renderMedia() is CPU-intensive, designed for finite clips, not live re-rendering |
| Goal animation clip (3-5 second pre-rendered animation) | Remotion renderMedia() on Cloud Run | Finite, deterministic, no live data required at render time |
| Replay clip injection | FFmpeg (not Remotion) | Speed is critical — FFmpeg is faster than Remotion for raw video segment extraction |

## Architecture

```
Layout Page (graphics.genstadium.com)
  → Plain React app
  → onSnapshot(sessions/{sessionId}/scoreState) → setState → Scorebug re-renders
  → Remotion Player component (optional) for playing goal animation clips inline

Cloud Run replay/ module
  → FFmpeg: extracts DVR segment → encodes MP4 → writes to GCS
  → Does NOT use Remotion for replay

Cloud Run graphics/ module (future)
  → Remotion renderMedia() for goal animation finite clips
  → Writes rendered MP4 to GCS
  → Ingress injects into Room
```

## Consequences

**Positive:**
- Layout page has no dependency on Remotion for live operation — simpler, faster
- `renderMedia()` isolated to Cloud Run — no browser CPU concerns

**Negative:**
- Two rendering systems (React live + Remotion pre-render) — must keep scorebug component logic consistent between them

## Review Trigger

Re-evaluate if goal animation clips need live data (e.g. player names, scores) that can't be pre-computed at render time.
