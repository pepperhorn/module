# Handoff: 0001-t1 — Sampler opt-ins: format fallback, exactOnly, oneShot (lead → impl)

- **Date:** 2026-11-27
- **Type:** dispatch
- **Ledger:** 0001 · **Spec:** docs/specs/0001-keyboard.md · **Plan:** docs/plans/0001-keyboard.md (task T1)
- **Branch:** orch/0001-t1-sampler-optins · **Worktree:** created by T3
- **PR:** —
- **Base commit:** ea10cef
- **Port (if running a server):** —
- **Status:** open

## Goal
Implement plan task **T1 — Sampler opt-ins: format fallback, exactOnly, oneShot** exactly as written in docs/plans/0001-keyboard.md (section "### T1"). Done means its steps are checked off, its tests pass, the Verify command passes, and a draft PR is open.

## Context you need
- Spec: docs/specs/0001-keyboard.md (approved by Shaun 2026-11-27). Read it all, especially Constraints.
- Plan: docs/plans/0001-keyboard.md: **Global constraints**, **Review focus**, and your task section. Your task's **Interfaces** block is a contract other parallel tasks build against: keep the exact names, signatures and fields.
- T1, T2 and T3 run in parallel in separate worktrees. Don't wait for, or import code from, the other two.


## Scope
- **In:** everything in plan task T1.
- **Out:** every other plan task; any change to the existing app's behaviour or to @pepperhorn/sound-module.
- **Files you own:** `src/audio/customSampler.ts`, `src/audio/customSampler.test.ts` (new), `src/patches/types.ts` (sampler variant only), plus your own handoff files for key 0001-t1.
- **Do not touch:** everything else. If you need a file you don't own, stop and say so in your return handoff.

## Acceptance criteria
- [ ] Spec "Sampler changes" constraint met; patches without the new fields behave exactly as today (regression test)
- [ ] Every test named in plan task T1 exists and passes
- [ ] Existing tests are still green (`npm test`)

## Verify with
```bash
npm run typecheck && npm test && npm run build
```

## Known gotchas / decisions already made
- GBrain: `projects/module` (facts 2026-11-27: spec approval, root-led chord spelling); `projects/drumlet` (acoustic1 kit, variant B squash, pending drumlet 0001-t1).
- No spec decision is open. If the plan is wrong or ambiguous, escalate (AGENTS.md §7). Don't improvise.
- Setup: `npm ci`. No secrets are needed.

## Open questions
- None.

---
## Receiver ack

---
## Return
(write it in docs/handoffs/2026-11-27-0001-t1-sampler-optins--<you>-to-lead.md)
