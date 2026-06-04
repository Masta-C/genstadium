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
