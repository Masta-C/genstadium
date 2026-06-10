# GenStadium Session Log

> Append-only. One line per completed Ralph Loop iteration.
> Format: `YYYY-MM-DD | #N issue-title | PR #N | NOTE: key decision or gotcha`
> Read the last 10 lines at the start of every session to know current state.

---

2026-06-04 | #92 CONTEXT.md update | direct commit | Added 10 domain terms: Attribution Sheet, T1/T2/T3 Button, On-Strike Toggle, Innings Flip, Over Complete, Guest Landing Screen, Soft Mandatory Attribution, Replay Ready, Scorebug Style, ISO Camera
2026-06-04 | #93 CLAUDE.md update | direct commit | SK flow = 9 steps, Camera flow = 5 steps, Ralph Loop start command added
2026-06-04 | #1 GitHub setup | direct commit | develop + main branch protection, CODEOWNERS, PR template, repo made public
2026-06-04 | #11 GitHub production env | GitHub UI | production environment created (no self-review gate on personal repo)
2026-06-04 | ADR-007 revised | direct commit | ISO Camera replaces "record all cameras" — Egress B records replayCameraSlot only
2026-06-04 | ADR-006 revised | direct commit | Clip duration = 20s fixed, single badge (most recent overwrites), abort if gap > 10s
2026-06-04 | AGENT.md created | direct commit | Ralph Loop agent with tiered memory — reads BRIEF.md not full CLAUDE.md
2026-06-04 | knowledge-graph.json created | direct commit | Seeded with 8 key decisions from today's grill sessions
2026-06-06 | #2 monorepo-scaffold | PR https://github.com/Masta-C/genstadium/pull/96 | NOTE: .npmrc legacy-peer-deps required for RN peer dep resolution; graphics .eslintrc must be .cjs in ESM package
2026-06-06 | #7 ci-workflow | PR https://github.com/Masta-C/genstadium/pull/97 | NOTE: vitest for graphics (ESM-native), jest-expo for app, passWithNoTests avoids empty-suite failure
2026-06-06 | #17 eventconfig-registry | branch feature/issue-17-eventconfig-registry | NOTE: packages/event-config shared workspace; app/lib/eventConfig.ts re-exports; moduleResolution bundler requires module ESNext
2026-06-06 | #19 share-session-screen | PR https://github.com/Masta-C/genstadium/pull/99 | NOTE: chips criteria truncated in issue; used Camera+SK chips per CLAUDE.md; real-time occupancy deferred to #20
2026-06-06 | #19 share-session-screen | PR https://github.com/Masta-C/genstadium/pull/99 | NOTE: chips criteria truncated in issue; used Camera+SK chips per CLAUDE.md; real-time occupancy deferred to #20
2026-06-07 | #21 guest-landing | PR https://github.com/Masta-C/genstadium/pull/100 | NOTE: Firestore lookup stubbed — real impl in #4; status badge uses design token colors
2026-06-07 | #4 firebase-emulator-config | PR https://github.com/Masta-C/genstadium/pull/101 | NOTE: window.__gsEmulatorsConnected guard; enableIndexedDbPersistence safe on RN (no-op)
2026-06-07 | #5 seed-scripts | PR https://github.com/Masta-C/genstadium/pull/102 | NOTE: fixed UIDs for idempotency; credits at users/{uid}/credits/balance (subcollection doc not field)
2026-06-07 | #6 dev-ready-skill | PR https://github.com/Masta-C/genstadium/pull/103 | NOTE: Hosting port 5002 added; npm run seed shortcut; removed host@ cred (Host merged into Director)
2026-06-07 | #8 firestore-rules | PR https://github.com/Masta-C/genstadium/pull/104 | NOTE: credits at users/{uid}/credits/{doc} subcollection; private subcollection for YouTube keys; Admin SDK bypasses all rules
2026-06-07 | #14 director-auth-screens | PR https://github.com/Masta-C/genstadium/pull/105 | NOTE: (auth)/_layout.tsx is pass-through (no redirect) to prevent bounce-back-to-login bug; role read from Firestore users/{uid}.role
2026-06-07 | #15 google-signin | PR https://github.com/Masta-C/genstadium/pull/106 | NOTE: REVERSED_CLIENT_ID in infoPlist; LINK_REQUIRED error for account merging; dev build only
2026-06-07 | #16 auth-guard-root-layout | PR https://github.com/Masta-C/genstadium/pull/108 | NOTE: index.tsx redirects to director/home — root guard ensures it only renders when user!=null
2026-06-09 | #78 replay-ready-banner | PR https://github.com/Masta-C/genstadium/pull/157 | NOTE: prefetch.ts writes latestReplayClip to session doc; bannerElapsed timer deps on readyAt.seconds
2026-06-09 | #79 broadcast-replay | PR https://github.com/Masta-C/genstadium/pull/158 | NOTE: webhook registered before express.json() for raw body; previousSource saved for auto-return
2026-06-09 | #80 end-session | PR https://github.com/Masta-C/genstadium/pull/159 | NOTE: supports both egressAId and egressIds.a field layouts; stop failures are warnings not errors
2026-06-09 | #90 remotion-compositions | PR https://github.com/Masta-C/genstadium/pull/160 | NOTE: renderMedia mocked in tests; runtime needs CHROMIUM_PATH env + chromium binary in container
2026-06-09 | BLOCKED | All remaining ready-for-agent issues blocked via #85 (ready-for-human: App Store Connect IAP setup)
2026-06-09 | #81 director-summary | PR https://github.com/Masta-C/genstadium/pull/161 | NOTE: replayClipCount from replayClips subcollection size; youtubeEnabled from youtubeStreamKey presence; getDocs not onSnapshot (session ended)
2026-06-09 | #82 sk-session-ended | no PR needed | NOTE: already implemented in PR #128 (feat #39); onSnapshot nav at sk-live.tsx:120-122
2026-06-09 | #83 cam-session-ended | no PR needed | NOTE: already implemented in cam-live.tsx:39-56; setCameraEnabled+disconnect with .catch guards
2026-06-09 | #86 stripe-webhook | PR https://github.com/Masta-C/genstadium/pull/162 | NOTE: env var read inside handler (not module level) to allow test mocking; idempotency via subcollection doc
2026-06-09 | #87 storekit-iap | PR https://github.com/Masta-C/genstadium/pull/163 | NOTE: requestPurchase needs {request:{apple:{sku}},type:'in-app'}; Apple JWS verify stubbed pending #85
2026-06-09 | #89 credit-check-go-live | PR https://github.com/Masta-C/genstadium/pull/164 | NOTE: Egress B uses startRoomCompositeEgress (not Track Egress — track ID not available at start time); TODO in code for #77
2026-06-09 | #69 go-live-sequence | PR https://github.com/Masta-C/genstadium/pull/165 | NOTE: listParticipants gets ISO Camera track SID; falls back to room composite if SID unavailable
2026-06-09 | #73 egress-b-track-egress | PR https://github.com/Masta-C/genstadium/pull/166 | NOTE: egressIds.b field path (not egressBId); participant_left checks identity===replayCameraSlot; stopEgress failure is non-fatal
2026-06-09 | #88 credit-balance-display | PR https://github.com/Masta-C/genstadium/pull/167 | NOTE: balance at users/{uid}/credits/balance doc; null while loading prevents flash of 0
2026-06-09 | #91 animation-trigger | PR https://github.com/Masta-C/genstadium/pull/168 | NOTE: replay-clip- prefix used for anim Ingress identity so existing webhook handles auto-return; unmapped eventTypes silently skipped
2026-06-09 | #77 replay-broadcast-ingress | PR https://github.com/Masta-C/genstadium/pull/169 | NOTE: reads gcsPath from replayClips/{clipId} doc; object name stripped from gs:// prefix; ingressId written back to clip doc
2026-06-09 | #94 iso-camera-reconnect | PR https://github.com/Masta-C/genstadium/pull/170 | NOTE: listEgress idempotency check by egressId match; Egress B restart failure non-fatal; lobby joins ignored
2026-06-09 | #9 eas-config | PR https://github.com/Masta-C/genstadium/pull/171 | NOTE: owner=masta-c (verify); USE_EMULATOR env var replaces __DEV__ guard in firebase client
2026-06-09 | #68 youtube-oauth | PR https://github.com/Masta-C/genstadium/pull/172 | NOTE: expo-auth-session OAuth; stream key from liveStreams.list cdn.ingestionInfo.streamName; lobby nav updated live-setup→youtube
2026-06-09 | #10 production-deploy | PR https://github.com/Masta-C/genstadium/pull/173 | NOTE: deploy job uses environment:production gate; gcloud run deploy --source for Cloud Run; EXPO_TOKEN secret required for EAS
2026-06-09 | #52 graphics-firebase-hosting | PR https://github.com/Masta-C/genstadium/pull/174 | NOTE: multi-site target 'graphics'→site 'genstadium-graphics'; custom domain needs manual Firebase Console setup
2026-06-09 | #175 hardened-ci | PR https://github.com/Masta-C/genstadium/pull/181 | NOTE: real coverage baseline 52.8%/46.1% (not 95%); collectCoverageFrom reveals uncovered files; thresholds at baseline-3
2026-06-09 | #176 app-baseline-tests | PR https://github.com/Masta-C/genstadium/pull/182 | NOTE: nativewind/babel returns preset-object not plugin — NODE_ENV=test guard needed; jest-expo caller.name=metro not babel-jest
2026-06-09 | #177 graphics-baseline-tests | PR https://github.com/Masta-C/genstadium/pull/183 | NOTE: vitest globals:true needed; vitest/globals in tsconfig types; vi.stubGlobal for window.location; remotion needs full mock
2026-06-09 | #178 cloud-run-integration-tests | PR https://github.com/Masta-C/genstadium/pull/184 | NOTE: emulator needs Java 21; local validation requires npm run emulators; not added to CI per spec
2026-06-09 | #179 npm-audit-triage | PR https://github.com/Masta-C/genstadium/pull/185 | NOTE: all 17 HIGH/CRIT are build-time or dev-tool; continue-on-error stays until human reviews audit-accepted.md
2026-06-09 | audit-gate-enabled | PR https://github.com/Masta-C/genstadium/pull/186 | NOTE: gate is --audit-level=critical --omit=dev (not high); HIGH gate needs expo@56+firebase@12 to unblock
2026-06-10 | #187 eas-preview-env-vars | PR https://github.com/Masta-C/genstadium/pull/201 | NOTE: EXPO_PUBLIC_FIREBASE_API_KEY must be set via eas env:create separately; storage bucket is firebasestorage.app not appspot.com
2026-06-10 | #188 functions-deploy | PR https://github.com/Masta-C/genstadium/pull/202 | NOTE: build step required (dist/index.js entry); ordered after Firestore indexes before Cloud Run
