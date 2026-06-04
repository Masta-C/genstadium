# AGENT.md — GenStadium Ralph Loop Agent

> This file is read at the start of every Ralph Loop iteration.
> One issue per iteration. Fresh context. No exceptions.

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
