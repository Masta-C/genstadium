---
name: genstadium-grill-me
description: Stress-test a plan or design for GenStadium. Challenges decisions against CONTEXT.md domain language and docs/adr/ locked decisions. Updates documentation inline as new decisions crystallise. Use when designing a new feature, planning a phase, or before starting implementation on anything non-trivial.
---

# GenStadium Grill Me

Invoke `grill-with-docs` with GenStadium context.

Before starting, read:
1. `CONTEXT.md` — domain language. Challenge any usage of wrong terms (sportConfig, simulcast, RevenueCat, etc.)
2. `docs/adr/` — all locked decisions. Any plan that contradicts a locked ADR must surface that conflict explicitly before proceeding.
3. `CLAUDE.md` — architecture constants and open questions.

Then run the grill-with-docs skill:
- Interview relentlessly, one question at a time
- Provide your recommended answer with each question
- When a decision locks, offer to write or update the relevant ADR
- Flag any terminology that doesn't match CONTEXT.md
- Flag any plan that conflicts with a locked ADR before asking the next question

Focus areas to probe for GenStadium plans:
- Is this adding complexity to the Go Live sequence? (idempotency must be preserved)
- Does this require storing state in Cloud Run memory? (must go to GCS or Firestore instead)
- Is this adding a live video path for the Director? (no simulcast — re-examine the need)
- Is this using `sportConfig` or `scoreDelta` in a non-eventConfig pattern? (catch naming drift)
- Is this a payment flow that touches the app UI? (no pricing/purchase in-app)
- Is this a new auth method? (run firebase-auth-preflight first)
