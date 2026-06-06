# ADR-008: eventConfig Extensible Model — 3 Phase 1 Changes for Phase 4 Generalization

**Status**: Accepted  
**Date**: 2026-05-31

## Decision

Implement three small changes in Phase 1 that make non-sports event types (elections, product launches, concerts) a Phase 4 data migration rather than a Phase 4 rewrite.

## The Three Phase 1 Changes

### 1. Use `eventConfig` naming (not `sportConfig`)
```typescript
// ✅ CORRECT
const eventConfig = { football: {...}, cricket: {...}, custom: {...} }
type EventType = keyof typeof eventConfig

// ❌ WRONG — do not use
const sportConfig = { ... }
```

### 2. `metadata: []` — empty array field on all events
Every event definition carries a `metadata` field even if unused in Phase 1:
```typescript
events: [
  { id: "goal", label: "Goal", scoreDelta: { team: 1 }, metadata: [], triggers: ["prefetch"] },
  // metadata: [] means "no extra fields required for this event"
  // Phase 4: metadata: [{ key: "candidate", label: "Candidate", type: "select", options: [...] }]
]
```

### 3. Data-driven labels via `dataLabel` and `entryLabel`
```typescript
// Sports event
{ dataLabel: "Teams", entryLabel: "Score Keeper" }

// Election event (Phase 4)
{ dataLabel: "Candidates", entryLabel: "Results Reporter" }

// Product launch (Phase 4)  
{ dataLabel: "Metrics", entryLabel: "Data Operator" }
```

## What This Unlocks in Phase 4

Phase 4 can add non-sports events by:
1. Adding new keys to `eventConfig` (no schema change)
2. Populating `metadata[]` with field definitions (UI renders dynamically)
3. Setting `dataLabel`/`entryLabel` to non-sports language
4. Setting `scorebugLayout: "generic"` for non-score overlays

Estimated Phase 4 generalization cost with these 3 changes: **3-5 days**.
Without these changes: **2-3 weeks of migration** (rename, data migration, UI rebuild).

## Tier 0 Non-Sports Business Case

Tier 0 (scorebug-only, free) can be marketed as:
- Election results tracker (candidates = "teams", vote counts = "scores")
- Product launch counter (units shipped, sign-ups)
- Concert setlist tracker
- Any event with live "score-like" data to display

This is a **separate addressable market** from sports — unlocked for free by the naming convention choice made in Phase 1.

## eventConfig Schema

```typescript
type EventConfig = {
  [eventType: string]: {
    dataLabel: string           // "Teams" | "Candidates" | "Metrics"
    entryLabel: string          // "Score Keeper" | "Results Reporter"
    scoreUnit: string           // "goals" | "points" | "votes"
    events: EventDefinition[]
    scorebugLayout: string      // "football" | "cricket" | "generic"
    periods?: string[]          // ["First Half", "Second Half"] — optional
  }
}

type EventDefinition = {
  id: string
  label: string
  scoreDelta: { team: number } | null   // null = no score change
  metadata: MetadataField[]              // [] in Phase 1
  triggers: ('prefetch' | 'animation')[] // which Cloud Run actions to trigger
}
```

## Animation Template System

Event animations are sport-agnostic. Templates are motion design shells with dynamic data slots. Users pick a template per event type during session setup — no design skill required.

**6 templates (Phase 1):**

| Template | Slot data used | Use cases |
|---|---|---|
| Score Flash | eventLabel, teamColour, score | Goal, Six, Basket, Point |
| Player Card | eventLabel, playerName, teamColour | Wicket, Assist, Top scorer |
| Alert Banner | eventLabel, teamName, teamColour | Red card, Foul, Penalty, Timeout |
| Milestone Burst | eventLabel, playerName, milestone text | Century, Hat-trick, Record |
| Replay Intro | cameraLabel | Overlays every replay clip, sport-agnostic |
| Stat Card | two-column key/value pairs | Half-time stats, bowling figures, election update |

**EventDefinition updated schema:**
```typescript
type EventDefinition = {
  id: string
  label: string
  scoreDelta: { team: number } | null
  metadata: MetadataField[]
  triggers: ('prefetch' | 'animation')[]
  animationTemplate?: 'score-flash' | 'player-card' | 'alert-banner' | 'milestone-burst' | 'replay-intro' | 'stat-card'
}
```

`animationTemplate` is optional — events without it skip the animation step. User selects template per event during Create Session. Template picker shows live preview with placeholder data before match starts.

**Phase 3:** Custom Lottie upload — user uploads `.json` Lottie file → GCS → appears as "Custom" in template picker.
**Phase 4:** Community template marketplace — same slot interface, no hardcoded sport logic.

## Consequences

**Positive:**
- Naming convention change costs 0 extra days in Phase 1
- Phase 4 generalization becomes incremental rather than a rewrite
- Tier 0 immediately marketable to non-sports events

**Negative:**
- `metadata: []` is dead weight in Phase 1 (never populated)
- Slightly more complex TypeScript type than needed for sports-only Phase 1
