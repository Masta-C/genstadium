# GenStadium — 3-Device Android Demo QA Plan

> **Goal**: Run a full Director → Camera → Score Keeper session on 3 Android devices against real production infrastructure.
> **Estimated time**: 45 minutes (first run), 20 minutes (repeat runs).

---

## Device Assignments

| Device | Role | Auth | Account |
|---|---|---|---|
| **Device 1** | Director | Email login | director@genstadium.dev / Test1234! |
| **Device 2** | Camera Operator | Anonymous (join code) | — |
| **Device 3** | Score Keeper | Anonymous (join code) | — |

All 3 devices must have the **EAS preview APK** installed. See HITL issue #194 for build instructions.

---

## Pre-Flight Checklist

Run these before starting the demo. Each must pass before proceeding.

### 1. Cloud Run alive
```bash
curl https://genstadium-cloud-run-46093505832.asia-south1.run.app/health
```
Expected: `{"status":"ok","firebase":"ok","livekit":"ok",...}`

If `status: "degraded"` → check which service shows `"error: ..."` → fix env vars in GCP Console (HITL #193).

### 2. Director credits set
The Director needs `credits.balance ≥ 1` to Go Live. Set via seed script:
```bash
npm run seed:demo -- --email director@genstadium.dev --confirm
```
Or manually in [Firebase Console](https://console.firebase.google.com) → `genstadium-2321` → Firestore → `users/{director-uid}/credits` → set `balance: 5`.

To find the Director UID: log in on Device 1 first, then check Firebase Console → Authentication → Users.

### 3. Firebase Hosting (graphics) live
```bash
curl -s https://genstadium-graphics.web.app | grep -o "<title>[^<]*"
```
Expected: `<title>GenStadium` (or similar). If 404 → production deploy has not run yet (HITL #196).

### 4. APK installed on all 3 devices
- Open the app on each device → should reach login / guest landing screen.
- Confirm no "bundle error" or "Metro not connected" message.

### 5. All on same Wi-Fi (optional but recommended)
LiveKit uses WebRTC which works over any internet. Same Wi-Fi avoids mobile data issues but is not required.

---

## Flow A — Director Setup (Device 1)

1. Open app → Login screen
2. Enter `director@genstadium.dev` / `Test1234!` → tap **Sign In**
   - ✅ Should land on Director Home screen
3. Tap **New Session**
4. Enter session name: `Demo Match`
5. Select sport: **Football**
6. Tap **Next** → Camera Slots screen
7. Confirm `cam_1` (Wide Angle) and `cam_2` (Close Up) are pre-populated
8. Mark `cam_1` as **🎥 Replay Source** (ISO Camera)
9. Tap **Next** → Animations screen
10. Confirm Goal Flash animation is toggled on → tap **Next**
11. Share screen appears with join code (e.g. `DEMO01`)
    - **Note the join code** — Camera and Score Keeper need it
12. Tap **Continue** → Lobby screen

**Expected lobby state**: Empty participant list. Go Live button greyed out (waiting for ISO Camera).

---

## Flow B — Camera Join (Device 2)

1. Open app → Guest Landing screen
2. Enter join code from Step A-11 → tap **Join**
3. Confirm session name and sport are shown
4. Tap **Camera Operator**
5. Pick slot **cam_1 — Wide Angle**
   - ✅ Should enter camera viewfinder
6. Confirm **LIVE** badge appears (or will appear after Go Live)
7. Point camera at anything well-lit

**Back on Device 1 (Lobby)**: `cam_1 — Wide Angle` should appear in the participant list with a green dot. **Go Live button activates**.

---

## Flow C — Score Keeper Join (Device 3)

1. Open app → Guest Landing screen
2. Enter the same join code → tap **Join**
3. Tap **Score Keeper**
4. Team Setup: set Home = **India** 🟢, Away = **Australia** 🔴 → **Next**
5. Roster Setup: tap **Skip** (optional)
6. Toss: tap **India Kicks Off** → **Next**
7. Onboarding overlay fires — tap to dismiss
8. Live scoring screen appears in **landscape**
   - ✅ T1 buttons (Goal) visible large
   - ✅ T2 buttons (Yellow Card) visible medium
   - ✅ T3 buttons (Corner, Sub) visible small

---

## Flow D — Go Live (Device 1)

1. In Lobby, confirm `cam_1` shows in participant list with status ● (green)
2. Optionally: observe pre-flight status bar (Firebase ✅, Cloud Run ✅, LiveKit ✅)
3. Tap **Go Live** → confirm dialog appears
4. Tap **Confirm**
5. Wait 8–15 seconds (Egress A + B starting)
   - ✅ Director should transition to **Live screen**
   - ✅ Session status in Firestore → `live`

**If Go Live returns 402**: Credits = 0. Run `npm run seed:demo` or set manually (see Pre-Flight step 2).

**If Go Live hangs > 20s**: Check Cloud Run logs in GCP Console → likely a LiveKit env var missing (HITL #193).

---

## Flow E — Score Events (Device 3)

1. Tap **Goal** (T1 button) for India
   - ✅ Score board updates instantly (e.g. 1–0)
   - ✅ Attribution Sheet slides up — wait 8s or pick a player
2. Log 2 more Goals for India (total 3–0)
3. On Device 1 (Director): confirm **🎬 Replay Ready** badge appears within ~10 seconds
   - This confirms: Cloud Function fired → Cloud Run pre-fetch → FFmpeg → GCS → all working

**If 🎬 badge never appears**: Cloud Functions not deployed. Run HITL #196 (production deploy) first.

---

## Flow F — Replay Broadcast (Device 1)

1. Tap the **🎬** badge
2. Confirm source switches to replay clip
3. Wait ~5 seconds for clip to play
4. Confirm auto-return to live camera feed (cam_1)

**If replay clip is black or errors**: GCS path issue. Skip for first demo — log it and continue.

---

## Flow G — End Session (Device 1)

1. Tap **⏹ End Session**
2. Confirm dialog → tap **End**
3. Wait for all 3 devices to transition:
   - Device 1: Summary screen (score + duration + Share Recap button)
   - Device 2: Camera Ended screen
   - Device 3: Scorecard screen (match stats)

---

## Known Gotchas

| Area | Issue | Workaround |
|---|---|---|
| Credits = 0 | Go Live returns 402 | `npm run seed:demo --email director@genstadium.dev --confirm` |
| Google Sign-In | Fails silently on EAS builds until SHA-1 registered (HITL #195) | Use email login instead |
| Replay badge never appears | Cloud Functions not deployed | Complete HITL #196 first |
| Camera black screen | Camera permission not granted | Allow camera access in Android Settings |
| Score Keeper in portrait | Landscape lock via expo-screen-orientation | Rotate device manually if auto-rotate fails |
| `graphics.genstadium.com` | Custom domain needs Firebase Console DNS setup | Use `genstadium-graphics.web.app` fallback URL |
| Go Live hangs > 20s | Cloud Run missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET | Check HITL #193 env vars |

---

## Quick Smoke Test (run before demo, ~30 seconds)

```bash
# From repo root — requires EXPO_PUBLIC_FIREBASE_API_KEY env var set
npm run smoke-test
```

Expected output:
```
✅ GET /health → 200 (firebase: ok, livekit: ok)
✅ POST /session/join (missing code) → 404
✅ POST /session/join (missing body) → 400
✅ POST /auth/token (no auth) → 401
✅ POST /webhooks/livekit (no sig) → 401
✅ E2E chain: auth → session/start → liveKitToken (valid JWT)
All checks passed.
```

Any ❌ before the demo = stop and investigate.

---

## Post-Demo Checklist

- [ ] Take screenshots of all 3 screens at the Summary/Scorecard/Ended state
- [ ] Note any flows that broke or felt slow
- [ ] If replay flow failed: note the exact error from Cloud Run logs
- [ ] Create GitHub issues for any bugs found (label: `bug`)
