# Handoff: 0001-t2 — Bundled assets: piano build script, drum kit, manifests, GM drum map (lead → impl)

- **Date:** 2026-11-27
- **Type:** dispatch
- **Ledger:** 0001 · **Spec:** docs/specs/0001-keyboard.md · **Plan:** docs/plans/0001-keyboard.md (task T2)
- **Branch:** orch/0001-t2-bundled-assets · **Worktree:** created by T3
- **PR:** —
- **Base commit:** ea10cef
- **Port (if running a server):** —
- **Status:** open

## Goal
Implement plan task **T2 — Bundled assets: piano build script, drum kit, manifests, GM drum map** exactly as written in docs/plans/0001-keyboard.md (section "### T2"). Done means its steps are checked off, its tests pass, the Verify command passes, and a draft PR is open.

## Context you need
- Spec: docs/specs/0001-keyboard.md (approved by Shaun 2026-11-27). Read it all, especially Constraints.
- Plan: docs/plans/0001-keyboard.md: **Global constraints**, **Review focus**, and your task section. Your task's **Interfaces** block is a contract other parallel tasks build against: keep the exact names, signatures and fields.
- T1, T2 and T3 run in parallel in separate worktrees. Don't wait for, or import code from, the other two.
- The source drum kit is `/home/shaun/drumlet/public/samples/acoustic1/` (14 .ogg files plus kit.json, .ogg only for now). The piano source is `https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3.js` (MIT). ffmpeg must be on PATH; if it is not, stop and report.
- **Shared config change (identical in T2 and T3, so the merges are clean):** change these two lines exactly as follows, with nothing else in those files:
  - `vitest.config.ts`: `include: ['src/**/*.test.{ts,tsx}'],` becomes `include: ['src/**/*.test.{ts,tsx}', 'packages/keyboard/src/**/*.test.{ts,tsx}'],`
  - `tsconfig.json`: `"include": ["src"],` becomes `"include": ["src", "packages/keyboard/src"],`

## Scope
- **In:** everything in plan task T2.
- **Out:** every other plan task; any change to the existing app's behaviour or to @pepperhorn/sound-module.
- **Files you own:** `packages/keyboard/assets/**`, `packages/keyboard/scripts/build-piano.mjs`, `packages/keyboard/scripts/copy-kit.mjs`, `packages/keyboard/src/patches/**`, the include line in `vitest.config.ts` and in `tsconfig.json` (see Context), plus your own handoff files for key 0001-t2.
- **Do not touch:** everything else. If you need a file you don't own, stop and say so in your return handoff.

## Acceptance criteria
- [ ] AC2 (piano ≤ 500 KB per loaded format, reproducible via script); the drum map matches the spec table; NOTICE written
- [ ] Every test named in plan task T2 exists and passes
- [ ] Existing tests are still green (`npm test`)

## Verify with
```bash
node packages/keyboard/scripts/build-piano.mjs --check && npm test
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
(write it in docs/handoffs/2026-11-27-0001-t2-bundled-assets--<you>-to-lead.md)
