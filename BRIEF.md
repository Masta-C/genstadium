# GenStadium — Agent Brief

> Read this first. It's everything you need to orient. Load full docs only if unclear on something specific.

## What is this
Broadcast-grade live sports production app. Smartphones → multi-camera stream → YouTube.
Three roles: Director (runs stream), Score Keeper (logs events), Camera (publishes feed).

## Stack (one line each)
- App: React Native + Expo SDK 52, TypeScript strict, NativeWind
- Database: Cloud Firestore (real-time state bus)
- Auth: Firebase Auth (email+Google for Director, anonymous for Camera/SK)
- Stream: LiveKit Cloud SFU → YouTube via Egress A (Room Composite)
- Replay: Egress B → GCS DVR → FFmpeg → Ingress inject
- Backend: Cloud Run Node.js (session orchestration, replay engine)
- Graphics: Vite + React at graphics.genstadium.com (scorebug overlay)
- Payments: iOS StoreKit + Android/Web Stripe (no RevenueCat)

## Repo
- Root: `/Users/chetanpatil/genstadium`
- GitHub: `Masta-C/genstadium`
- Default branch: `develop` — all PRs target develop, never push direct

## Current phase
Building Tier 0 + Tier 1. 94 GitHub issues. Ralph Loop handles AFK issues autonomously.

## Where things live
| What | Where |
|---|---|
| Full rules + DO/DON'T | `CLAUDE.md` |
| Domain vocabulary | `CONTEXT.md` |
| Locked architecture decisions | `docs/adr/` (9 ADRs) |
| Key decisions index | `docs/knowledge-graph.json` |
| AFK task progress log | `docs/session-log.md` |
| HITL task progress | `docs/hitl-progress.json` |
| Design tokens | `docs/design-tokens.json` |
| Sport configs reference | `docs/score-keeper-sport-configs.json` |
| Loop agent instructions | `AGENT.md` |

## Non-negotiables (never break these)
- `eventConfig` not `sportConfig`
- Camera participant identity = slot name (`cam_1`, `cam_2`)
- Egress B records ISO Camera only (`session.replayCameraSlot`)
- Replay clip = 20 seconds fixed, single badge on Director screen
- No purchase UI / pricing inside the app
- No `renderMedia()` in browser — Cloud Run only
- No pre-fetched clips in Cloud Run memory — write to GCS immediately
- Lobby blocks Go Live until ISO Camera is in Room

## If something is unclear
1. Check `docs/knowledge-graph.json` — search for the decision
2. Check the relevant ADR in `docs/adr/`
3. Check `CLAUDE.md` for rules
4. Check `CONTEXT.md` for domain terms
