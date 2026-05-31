# ADR-004: Cloud Run for Session Orchestration

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

Use Cloud Run (Node.js/TypeScript) for session orchestration, LiveKit token generation, replay pre-fetch, and ad injection. Do not use Firebase Functions for operations that require long-running processes or sequential async steps.

## Context

Session orchestration involves:
- Multi-step Go Live sequence (credit check → room create → egress start → wait for ACTIVE status → Firestore write)
- FFmpeg execution for replay clip encoding
- LiveKit Ingress job management (create, wait for active, destroy)
- Stripe webhook processing

Firebase Functions have a 9-minute timeout limit and are stateless. The Go Live sequence + FFmpeg encode can exceed this in worst case. Cloud Run has a configurable timeout (up to 60 minutes).

## Architecture

```
Cloud Run service: genstadium-api
  Region: asia-south1
  CPU: always-allocated for FFmpeg (during requests)
  Min instances: 1 (warm start, no cold start delay on Go Live)
  Memory: 2Gi (FFmpeg clip encoding)
  Timeout: 300s (covers longest encode + egress wait)
```

**Important**: "CPU during requests only" mode (default) is used, NOT always-on CPU. Min-instances=1 keeps the instance alive (no cold start) but CPU is not allocated between requests. Pre-fetched clips must be written to GCS immediately — Cloud Run instance cannot hold state between requests.

## Module Split

```
cloud-run/src/
  session/    — startSession, endSession (LiveKit + Firestore)
  replay/     — prefetchClip (FFmpeg + GCS), injectReplay (Ingress)
  ads/        — injectAd (Ingress), reportSponsor
  graphics/   — layoutUrl, egressConfig
  webhooks/   — LiveKit webhooks, Stripe webhooks
  auth/       — verifyToken, generateLiveKitToken
```

**Single service, not microservices** — each module is a router, not a separate deployment. Re-evaluate if scaling needs diverge significantly between modules (e.g. FFmpeg-heavy replay vs lightweight session API).

## Single Point of Failure Mitigation

Single Cloud Run service = single deployment target. Risk mitigated by:
- Cloud Run auto-scales to multiple instances under load
- Min-instances=1 ensures at least one instance is always warm
- Stateless design — any instance can handle any request
- Migration to separate services is low-rework: each `src/` module becomes its own service. Estimated 2-3 days refactor, no API contract changes needed.

## Consequences

**Positive:**
- Single deployment unit — simpler CI/CD in Phase 1
- FFmpeg available in Cloud Run container (standard Node image includes it)
- No timeout constraints vs Firebase Functions

**Negative:**
- Single service = monolith risk if modules need different scaling profiles
- FFmpeg encode is CPU-bound — can block other requests if not handled async
