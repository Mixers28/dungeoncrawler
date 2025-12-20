# NOW - Working Memory (WM)

> This file captures the **current focus / sprint**.  
> It should always describe what we're doing *right now*.

<!-- SUMMARY_START -->
**Current Focus (auto-maintained by Agent):**
- Finalize stability hardening (equip/AC consistency, image fetch timeouts, lint hygiene).
- Validate Railway deploy from `dcv01` with the latest game-engine refactor.
- Confirm progression/economy features behave correctly in runtime.
<!-- SUMMARY_END -->

---

## Current Objective

Ship the latest `dcv01` build with the refactored game engine and stability fixes, and verify runtime health.

---

## Active Branch

- `dcv01`

---

## What We Are Working On Right Now

- [ ] Confirm Railway deploy succeeds from `dcv01` and app boots with the refactored engine.
- [ ] Verify equipped-gear AC calculations and trader purchases in production.
- [ ] Review Edge runtime warnings from Supabase middleware and decide on mitigation.

---

## Next Small Deliverables

- Railway deploy report (build logs + runtime notes).
- Confirmation that equip/AC logic and trader flows behave in prod.
- Follow-up fixes for Edge warnings if required.

---

## Notes / Scratchpad

- Track whether Railway needs environment variables or build overrides.
