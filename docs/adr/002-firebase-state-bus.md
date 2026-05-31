# ADR-002: Firebase Firestore as Real-Time State Bus

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

Use Cloud Firestore `onSnapshot` listeners as the real-time message bus for director commands and score state. Do not build a custom WebSocket server.

## Context

The Director needs to switch camera sources and the Layout Page (Egress headless Chrome) needs to respond in near-real-time (~100-300ms acceptable). Options evaluated:
1. **Firestore `onSnapshot`** — client subscribes to document, receives updates on write
2. **Custom WebSocket server** — Cloud Run with persistent connections
3. **Firebase Realtime Database** — older Firebase product, simpler but less structured
4. **LiveKit data messages** — LiveKit has a data channel for arbitrary messages

## Decision Drivers

- Firestore is already in the stack for session state
- `onSnapshot` gives ~100-230ms latency Director → Layout Page (acceptable for live production)
- Layout page (Egress headless Chrome) can subscribe to Firestore directly — no additional infrastructure
- Custom WebSocket server = another Cloud Run service to operate + maintain connections
- LiveKit data messages are not observable from outside the Room (can't use in Layout Page without joining Room)

## Measured Latency

```
Director writes directorState → Firestore (~20ms)
Firestore → Layout Page onSnapshot (~80-200ms)
Layout Page re-renders scorebug (~10ms)
Total: ~110-230ms
```

Acceptable for live sport. Camera cut latency on broadcast TV is ~200-500ms.

## Consequences

**Positive:**
- No additional infrastructure
- Layout page subscribes directly, Cloud Run not in the hot path for director commands
- Firestore offline persistence available (though layout page is always-on headless Chrome)

**Negative:**
- Firestore charges per read — high-frequency director commands could accumulate reads
- `onSnapshot` can miss events if listener drops and reconnects — use `serverTimestamp` ordering

## Implementation Note

Director command path:
```
Director app writes → sessions/{sessionId}.directorState
Layout Page onSnapshot fires → re-renders
```
Cloud Run is NOT in this path. Cloud Run only writes session status + egress IDs at start/end.
