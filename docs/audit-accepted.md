# npm Audit — Accepted Advisories

> Last updated: 2026-06-09  
> Triage run: `npm audit fix` (non-breaking) applied, 17 HIGH/CRITICAL remain.  
> `continue-on-error: true` remains on the CI audit step until this doc is reviewed
> and signed off by a human. See issue #179.

## How to review

Run `npm audit` locally to see the full advisory list. For each entry below,
verify the "Runtime risk" assessment still holds before removing
`continue-on-error: true` from `.github/workflows/ci.yml`.

---

## HIGH/CRITICAL advisories — accepted as build-time / non-exploitable

| Package | Severity | Advisory | Runtime scope | Decision |
|---|---|---|---|---|
| `@xmldom/xmldom` | HIGH | [GHSA-wh4c-j3r5-mjhp](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp) XML injection via CDATA serialization | Build-time only — used by `@expo/plist` to parse iOS plist files during EAS Build. No user-controlled XML in the CI pipeline. | **Accepted** |
| `@xmldom/xmldom` | HIGH | [GHSA-2v35-w6hq-6mfw](https://github.com/advisories/GHSA-2v35-w6hq-6mfw) Uncontrolled recursion / DoS in serialization | Same: build-time only, no untrusted XML input | **Accepted** |
| `@xmldom/xmldom` | HIGH | [GHSA-f6ww-3ggp-fr8h](https://github.com/advisories/GHSA-f6ww-3ggp-fr8h) XML injection via DocumentType serialization | Same: build-time only | **Accepted** |
| `@xmldom/xmldom` | HIGH | [GHSA-x6wf-f3px-wcqx](https://github.com/advisories/GHSA-x6wf-f3px-wcqx) XML node injection via processing instruction | Same: build-time only | **Accepted** |
| `@xmldom/xmldom` | HIGH | [GHSA-j759-j44w-7fr8](https://github.com/advisories/GHSA-j759-j44w-7fr8) XML node injection via comment serialization | Same: build-time only | **Accepted** |
| `tar` | HIGH | [GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v) Arbitrary file creation via hardlink path traversal | Used by `cacache` (npm's internal package cache). Only exploitable during `npm install` if a malicious tarball is unpacked. Not in app bundle or Cloud Run runtime. | **Accepted** |
| `tar` | HIGH | [GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97) Arbitrary file overwrite via symlink poisoning | Same: npm install toolchain only | **Accepted** |
| `tar` | HIGH | [GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx) Arbitrary file read/write via hardlink target escape | Same: npm install toolchain only | **Accepted** |
| `tar` | HIGH | [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96) Hardlink path traversal via drive-relative linkpath | Same: npm install toolchain only | **Accepted** |
| `tar` | HIGH | [GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256) Symlink path traversal via drive-relative linkpath | Same: npm install toolchain only | **Accepted** |
| `tar` | HIGH | [GHSA-r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w) Race condition via Unicode ligature collisions | Same: npm install toolchain only | **Accepted** |
| `cacache` | HIGH | Depends on vulnerable `tar` | Same transitivity analysis as `tar` above | **Accepted** |
| `@expo/plist` | HIGH | Depends on vulnerable `@xmldom/xmldom` | Same transitivity — build tool only | **Accepted** |
| `@expo/config-plugins` | HIGH | Depends on `@expo/plist` + `xcode` | Build tool only | **Accepted** |
| `@expo/config` | HIGH | Depends on `@expo/config-plugins` | Build tool only | **Accepted** |
| `@expo/metro-config` | HIGH | Depends on `@expo/config` + `postcss` | Build tool only | **Accepted** |
| `@expo/cli` | HIGH | Depends on `@expo/config*` | Build tool only | **Accepted** |
| `@expo/prebuild-config` | HIGH | Depends on `@expo/config*` | Build tool only | **Accepted** |
| `expo` | HIGH | Depends on `@expo/cli*` | The `expo` package itself is a build tool and dev-server coordinator. Its runtime bundle does not include vulnerable xmldom/tar paths. | **Accepted** |
| `expo-constants` | HIGH | Depends on `@expo/config` | Build-time config injection only | **Accepted** |
| `expo-asset` | HIGH | Depends on `expo-constants` | Same | **Accepted** |
| `expo-auth-session` | HIGH | Depends on `expo-constants` + `expo-linking` | Same | **Accepted** |
| `expo-linking` | HIGH | Depends on `expo-constants` | Same | **Accepted** |
| `jest-expo` | HIGH | Depends on `@expo/config` | Dev/test tool only — not in production bundle | **Accepted** |

---

## HIGH — requires monitoring

| Package | Severity | Advisory | Runtime scope | Decision |
|---|---|---|---|---|
| `undici` | HIGH | [GHSA-c76h-2ccp-4975](https://github.com/advisories/GHSA-c76h-2ccp-4975) Insufficient randomness | `undici` is Node.js's built-in HTTP client (ships with Node 18+). Cloud Run code does not call `fetch()` directly — it uses `firebase-admin` SDK and `livekit-server-sdk` which use their own HTTP clients. However, any third-party dep using Node's `fetch()` would be affected. | **Accepted for now — monitor for Node.js update** |
| `undici` | HIGH | [GHSA-g9mf-h72j-4rw9](https://github.com/advisories/GHSA-g9mf-h72j-4rw9) Unbounded decompression chain | Same scope as above | **Accepted for now** |
| `undici` | HIGH | [GHSA-cxrh-j4jr-qwg3](https://github.com/advisories/GHSA-cxrh-j4jr-qwg3) DoS via bad certificate | Same scope — only exploitable if connecting to a malicious server | **Accepted for now** |
| `undici` | HIGH | [GHSA-f269-vfmq-vjvj](https://github.com/advisories/GHSA-f269-vfmq-vjvj) WebSocket 64-bit length overflow | GenStadium does not use raw WebSocket from Cloud Run. | **Accepted** |
| `undici` | HIGH | [GHSA-2mjp-6q6p-2qxm](https://github.com/advisories/GHSA-2mjp-6q6p-2qxm) HTTP request/response smuggling | Requires MITM or connecting to a malicious proxy. Low likelihood in Cloud Run. | **Accepted for now** |
| `undici` | HIGH | [GHSA-vrm6-8vpv-qv8q](https://github.com/advisories/GHSA-vrm6-8vpv-qv8q) Unbounded memory in WebSocket permessage-deflate | GenStadium does not use WebSocket from Cloud Run service. | **Accepted** |
| `undici` | HIGH | [GHSA-v9p9-hfj2-hcw8](https://github.com/advisories/GHSA-v9p9-hfj2-hcw8) Unhandled exception in WebSocket client | Same — Cloud Run does not use raw WebSocket | **Accepted** |
| `undici` | HIGH | [GHSA-4992-7rv2-5pvq](https://github.com/advisories/GHSA-4992-7rv2-5pvq) CRLF injection via `upgrade` option | Only exploitable if using the `upgrade` option in undici — not used in this project | **Accepted** |

**Action**: When Node.js 22 LTS is adopted (planned alongside any Cloud Run Node version bump), verify `undici` advisories are resolved.

---

## CRITICAL — accepted as dev-tool-only

| Package | Severity | Advisory | Runtime scope | Decision |
|---|---|---|---|---|
| `vitest` | CRITICAL | [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp) Arbitrary file read/execute when Vitest UI server is listening | Only exploitable when running `vitest --ui` (the browser-based test explorer). CI runs `vitest run` (no UI server). Production has no vitest installed (devDependency). **Not exploitable in CI or production.** | **Accepted — dev tool only** |

---

## To remove `continue-on-error: true`

Once a human has reviewed this document and agrees with the risk assessments above:

1. Open `.github/workflows/ci.yml`
2. Remove the `continue-on-error: true` line from the "Dependency audit" step
3. Commit with message: `chore: enable blocking npm audit gate — advisories triaged`
