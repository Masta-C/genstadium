# ADR-001: Use LiveKit Cloud SFU (not self-hosted)

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

Use LiveKit Cloud as the managed SFU for WebRTC ingestion and egress. Do not self-host LiveKit in Phase 1.

## Context

GenStadium requires a Selective Forwarding Unit (SFU) to receive WebRTC streams from phone cameras and route them to egress. Options evaluated:
1. **LiveKit Cloud** — managed SFU with built-in Egress and Ingress APIs
2. **Self-hosted LiveKit** — run the LiveKit server on GCE/GKE ourselves
3. **Agora / Daily / Twilio** — alternative managed SFU vendors

## Decision Drivers

- Phase 1 volume is low (single-factory, max ~10 concurrent sessions)
- Egress A (Room Composite → YouTube) and Egress B (Track → GCS) are built into LiveKit Cloud — not available in competing managed services
- LiveKit Ingress (URL input for MP4 injection) is central to the replay architecture — also built-in
- Self-hosted LiveKit requires ~$50-100/month GCE instance + ops overhead + no managed Egress
- LiveKit Cloud cost at Phase 1 volume: ~$30-60/month

## Consequences

**Positive:**
- Zero infra to manage for the SFU layer
- Egress A/B and Ingress APIs available out of the box
- LiveKit Cloud has a free tier for development

**Negative:**
- Vendor lock-in to LiveKit Cloud APIs
- If volume grows (Phase 3+), cost may justify self-hosting
- Outage in LiveKit Cloud = no streaming (mitigated: SLA 99.9%)

## Migration Path

If self-hosting becomes necessary: LiveKit Cloud and self-hosted LiveKit share the same API surface. Migration is Cloud Run config change (LIVEKIT_URL + API keys) + Egress/Ingress service deployment. Estimated 2-3 days. PRD §15 contains the self-hosted setup guide.

## Review Trigger

Re-evaluate if monthly LiveKit Cloud cost exceeds $500 or if concurrent sessions consistently exceed 20.
