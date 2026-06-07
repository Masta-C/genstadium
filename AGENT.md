# AGENT.md — GenStadium Ralph Loop Agent

> This file is read at the start of every Ralph Loop iteration.
> One issue per iteration. Fresh context. No exceptions.

---

## Context Management — runs before every iteration

Check context window size at the **start** of each iteration (before Step 0) and **after** filing a PR (after Step 6.5).

### If context is at yellow (warning):
1. Invoke the `compact` slash command (`/compact`) to compress the conversation.
2. Continue the current iteration normally.

### If context is at orange/red, or if `/compact` fails to bring it back to green:
1. Invoke the `/handoff` skill to generate a structured handoff document.
   - The handoff MUST include: what was built this session, current git branch and stash state, which issue to pick next, all open PR URLs with CI status, and the rebase pattern note.
   - Save to `mktemp -t handoff-XXXXXX.md` and capture the path.
2. Output exactly:
   ```
   HANDOFF: context limit reached — handoff at {path}
   Starting fresh session automatically.
   ```
3. Print this exact block and stop — one human action (open new tab + paste) is required:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RALPH LOOP PAUSED — context window full
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Open a NEW Claude Code tab and run:

/loop Read {handoff_path} then read AGENT.md at /Users/chetanpatil/genstadium/AGENT.md and execute one full Ralph Loop iteration for the GenStadium repo at /Users/chetanpatil/genstadium
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

4. Do nothing else. This session is done.

**Why one human click is unavoidable:** There is no mechanism to auto-spawn a new *local* Claude Code session from within a running one:
- `ScheduleWakeup` — re-invokes the SAME session. Context still full.
- `Agent` — subagent within the SAME session. Context still held.
- `/schedule` — cloud session; cannot access local files or run local tools.

The handoff doc preserves all state. Opening a new tab takes 2 seconds.

**Never let a full context window cause lost work. The handoff captures everything — the human just opens a new tab.**

---

## Step 0 — Orient (tiered — load only what you need)

### Always load (every iteration)
1. Read `BRIEF.md` — 200-word project index. Stack, rules summary, where everything lives.
2. Read last 10 lines of `docs/session-log.md` — what was built recently, any gotchas.

### Load per task (after picking the issue)
3. Read the full issue body
4. Search `docs/knowledge-graph.json` — find any node whose `issues` array includes your issue number. Read those decision summaries. This tells you which ADRs and rules apply to this specific task without loading all 9 ADRs.

### Load on demand (only if unclear)
5. If a rule is ambiguous → read `CLAUDE.md` section relevant to the question
6. If a domain term is unclear → read `CONTEXT.md` and search for the term
7. If a decision needs full rationale → read the specific ADR from `docs/adr/`

Do NOT load CLAUDE.md, CONTEXT.md, or all ADRs upfront. BRIEF.md + knowledge-graph.json gives you 90% of what you need at 10% of the token cost.

---

## Step 1 — Pick the issue

```bash
# List all open AFK issues
gh issue list --repo Masta-C/genstadium --label "ready-for-agent" --state open --json number,title,body --limit 100
```

For each candidate issue:
1. Read the "Blocked by" section in the issue body
2. For each blocker: `gh issue view {N} --repo Masta-C/genstadium --json state | jq '.state'`
3. Skip the issue if any blocker is still `"OPEN"`

**Pick the lowest-numbered issue with all blockers closed.**

If no unblocked issues exist → output `BLOCKED: all remaining issues have open blockers` and stop.

---

## Step 2 — Read the issue

```bash
gh issue view {N} --repo Masta-C/genstadium
```

Read the full body. Understand every acceptance criteria checkbox before writing a line of code.

If anything is ambiguous → do not guess. Output `NEEDS_HUMAN: #{N} — {what is unclear}` and stop.

---

## Step 3 — Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/issue-{N}-{short-slug}
```

Slug = 2–4 words from the issue title, hyphenated, lowercase. Example: `feature/issue-17-eventconfig-registry`

---

## Step 4 — Implement

Follow every rule in `CLAUDE.md` DO/DON'T sections. Key ones:

- Use exact domain terms from `CONTEXT.md` in all variable names, function names, comments
- Never use `sportConfig` — always `eventConfig`
- Never import Firebase client SDK from server/API routes
- Never write to production Firestore — always verify emulator env vars
- Add Firestore indexes to `firestore.indexes.json` for every compound query
- Validate all inputs with Zod
- Write audit log entries for any action that creates, updates, or deletes a session or user

Tick off acceptance criteria checkboxes mentally as you complete each one.

---

## Step 5 — Verify

```bash
npm run typecheck
npm run lint
npm test
```

All three must pass. If any fail:
- Fix the issue
- Re-run
- Maximum 3 fix attempts

If still failing after 3 attempts → output `STUCK: #{N} — {exact error}` and stop. Do not create a PR with failing checks.

**Extra check — test files outside workspace `src/` directories:**
If you added any test files (e.g. `tests/*.test.ts` at repo root, or files outside a workspace's `include` paths), verify they are covered by a tsconfig that CI will actually run. The default workspace typecheck only covers `src/**/*.ts`. Pattern:

```bash
# If a jest config uses a custom tsconfig (e.g. tsconfig.rules.json), typecheck it explicitly:
npx tsc --noEmit -p cloud-run/tsconfig.rules.json
# Or run the workspace script if it exists:
npm run typecheck:rules --workspace=cloud-run
```

**Why this matters:** A test file that compiles fine in isolation may fail in CI if the jest config's tsconfig has `rootDir` set to a subdirectory, or if `@types/jest` is not in scope for that tsconfig. Always run the exact tsc config the jest runner will use — not just the workspace default.

---

## Step 6 — Commit and PR

```bash
# Stage only relevant files — never git add -A
git add {specific files changed}

git commit -m "$(cat <<'EOF'
feat(#{N}): {one-line summary of what was built}

{1-2 sentence explanation of the approach taken, referencing the ADR if relevant}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"

gh pr create \
  --repo Masta-C/genstadium \
  --base develop \
  --title "feat(#{N}): {issue title}" \
  --body "$(cat <<'EOF'
Closes #{N}

## What was built
{1-3 bullet points matching the acceptance criteria}

## ADRs respected
{list any ADRs that drove implementation decisions}

## Test plan
- [ ] npm run typecheck — passes
- [ ] npm run lint — passes
- [ ] npm test — passes

🤖 Ralph Loop iteration — [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Step 6.5 — Wait for CI

After `gh pr create`, wait for GitHub Actions CI to complete before proceeding.

```bash
# Poll until all checks are non-pending (pass or fail). Timeout after 5 minutes.
gh pr checks {PR_URL} --repo Masta-C/genstadium --watch --interval 15 --timeout 300
```

If CI **passes** → continue to Step 7.

If CI **fails**:
1. Fetch the failure log: `gh run view {run_id} --repo Masta-C/genstadium --log-failed | head -80`
2. Identify the failing step. Fix the issue on the current feature branch.
3. Push the fix: `git add {files} && git commit -m "fix(#{N}): ..." && git push`
4. Go back to the top of Step 6.5 and re-watch.
5. Maximum 3 fix attempts.

If CI still fails after 3 fix attempts → output `STUCK: #{N} — {exact CI error}` and stop.

**Never proceed to Step 7 with a red CI.**

---

## Step 7 — Comment on the issue

```bash
gh issue comment {N} --repo Masta-C/genstadium --body "Implemented in PR: {PR_URL}

All acceptance criteria completed. Awaiting review."
```

---

## Step 8 — Append to session log

```bash
echo "$(date +%Y-%m-%d) | #{N} {issue-title-slug} | PR {PR_URL} | NOTE: {one key decision or gotcha from this implementation}" >> /Users/chetanpatil/genstadium/docs/session-log.md
```

Keep the NOTE under 15 words. Focus on anything that will matter to the next agent: a surprising constraint, a pattern established, a field name that differs from the issue, a deferred decision.

---

## Step 9 — Signal completion

Output exactly:
```
DONE: #{N} — {issue title}
PR: {PR_URL}
NEXT: ready for next iteration
```

---

## Hard stops — output the signal and do not continue

| Signal | Condition |
|---|---|
| `BLOCKED: all remaining issues have open blockers` | No unblocked AFK issues found |
| `NEEDS_HUMAN: #{N} — {detail}` | Issue is ambiguous or marked HITL |
| `STUCK: #{N} — {error}` | typecheck/lint/test fails after 3 attempts |
| `DRIFT: #{N} — {detail}` | Implementation would require changing a locked ADR decision |

---

## What this agent never does

- Never pushes to `main` or `develop` directly — PRs only
- Never skips typecheck, lint, or tests
- Never uses `// @ts-ignore` without a comment explaining why
- Never modifies `firestore.rules` without also updating the relevant test
- Never picks a HITL issue — those require human action
- Never implements more than one issue per iteration
- Never assumes a blocker is resolved — always checks GitHub state

---

## Loop start command

To begin a new Ralph Loop iteration, run:

```
/loop Read AGENT.md at /Users/chetanpatil/genstadium/AGENT.md and execute one full Ralph Loop iteration for the GenStadium repo at /Users/chetanpatil/genstadium
```
