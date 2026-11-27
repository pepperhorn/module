# Handoff: 0001-t3 — Music theory: chords, spelling, colours, voice tracking (lead → impl)

- **Date:** 2026-11-27
- **Type:** dispatch
- **Ledger:** 0001 · **Spec:** docs/specs/0001-keyboard.md · **Plan:** docs/plans/0001-keyboard.md (task T3)
- **Branch:** orch/0001-t3-chord-theory · **Worktree:** created by T3
- **PR:** —
- **Base commit:** ea10cef
- **Port (if running a server):** —
- **Status:** open

## Goal
Implement plan task **T3 — Music theory: chords, spelling, colours, voice tracking** exactly as written in docs/plans/0001-keyboard.md (section "### T3"). Done means its steps are checked off, its tests pass, the Verify command passes, and a draft PR is open.

## Context you need
- Spec: docs/specs/0001-keyboard.md (approved by Shaun 2026-11-27). Read it all, especially Constraints.
- Plan: docs/plans/0001-keyboard.md: **Global constraints**, **Review focus**, and your task section. Your task's **Interfaces** block is a contract other parallel tasks build against: keep the exact names, signatures and fields.
- T1, T2 and T3 run in parallel in separate worktrees. Don't wait for, or import code from, the other two.
- **Shared config change (identical in T2 and T3, so the merges are clean):** change these two lines exactly as follows, with nothing else in those files:
  - `vitest.config.ts`: `include: ['src/**/*.test.{ts,tsx}'],` becomes `include: ['src/**/*.test.{ts,tsx}', 'packages/keyboard/src/**/*.test.{ts,tsx}'],`
  - `tsconfig.json`: `"include": ["src"],` becomes `"include": ["src", "packages/keyboard/src"],`

## Scope
- **In:** everything in plan task T3.
- **Out:** every other plan task; any change to the existing app's behaviour or to @pepperhorn/sound-module.
- **Files you own:** `packages/keyboard/src/theory/**`, the include line in `vitest.config.ts` and in `tsconfig.json` (see Context), plus your own handoff files for key 0001-t3.
- **Do not touch:** everything else. If you need a file you don't own, stop and say so in your return handoff.

## Acceptance criteria
- [ ] Logic for AC4/AC5/AC6: all six chord types × 12 roots; root-led spelling (C♯ chords use sharps, D♭ chords use flats, no double accidentals); CRF colours; VoiceTracker reference counting
- [ ] Every test named in plan task T3 exists and passes
- [ ] Existing tests are still green (`npm test`)

## Verify with
```bash
npx vitest run packages/keyboard/src/theory && npm run typecheck
```

## Known gotchas / decisions already made
- GBrain: `projects/module` (facts 2026-11-27: spec approval, root-led chord spelling); `projects/drumlet` (acoustic1 kit, variant B squash, pending drumlet 0001-t1).
- No spec decision is open. If the plan is wrong or ambiguous, escalate (AGENTS.md §7). Don't improvise.
- Setup: `npm ci`. No secrets are needed.

## Open questions
- None.

---
## Receiver ack
Implementer: Claude Sonnet 5.5, 2026-11-27. I'm doing plan task T3 only: pure theory modules in `packages/keyboard/src/theory/` (`chords.ts`, `spelling.ts`, `colors.ts`, `voices.ts`, `index.ts`) with tests, test-first. Beyond that folder I make only the two include-line edits to `vitest.config.ts` and `tsconfig.json`. The exported names and signatures match the plan's Interfaces block. Spelling follows the plan's letter-by-degree algorithm, with `pitchName` as the double-accidental fallback. I don't touch T1/T2/T4 files or existing app behaviour. Verify: `npx vitest run packages/keyboard/src/theory && npm run typecheck`, then also `npm test`.

---
## Return
(write it in docs/handoffs/2026-11-27-0001-t3-chord-theory--<you>-to-lead.md)
