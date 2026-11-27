# Handoff 0001-t1 — Sampler opt-ins (Codex → lead)

- **Date:** 2026-11-27
- **Type:** return
- **Ledger:** 0001
- **Branch:** `orch/0001-t1-sampler-optins`
- **Worktree:** `/home/shaun/.t3/worktrees/module/t3-badf2e5a-dfd9d4a2bd028698`
- **Base commit:** `ea10cef` (dispatch at `12ffd32`)
- **Status:** ready for review
- **PR:** [Draft PR #16](https://github.com/pepperhorn/module/pull/16)

## Goal

Let bundled keyboard patches opt into format selection, exact-note playback and one-shot playback without changing patches that omit these fields.

## Context

[Spec](../specs/0001-keyboard.md#constraints) · [Plan T1](../plans/0001-keyboard.md#t1--sampler-opt-ins-format-fallback-exactonly-oneshot) · [Dispatch handoff](2026-11-27-0001-t1-sampler-optins--lead-to-impl.md)

GBrain `projects/module` fact 1116 records the approved keyboard spec and its bundled piano and drum kit. The repository spec and plan define this task's contract.

## Scope

- In scope: `src/audio/customSampler.ts`, `src/audio/customSampler.test.ts`, the sampler variant in `src/patches/types.ts` and the two T1 handoff files.
- Out of scope: assets, Keyboard UI and all other tasks. `loadPatch.ts` already passes the sampler source through unchanged.

## Acceptance

- [x] Choose the first playable extension once per load. Cover Ogg and M4A selection for single samples, round robins and velocity layers.
- [x] Leave unmapped notes silent with `exactOnly`.
- [x] Let `oneShot` voices play through note-off. Keep the all-voices stop for panic and disconnect.
- [x] Preserve nearest-note repitching, the returned 40 ms stop and the targeted 50 ms stop when the opt-ins are absent.

## Verification

```sh
npm run typecheck && npm test && npm run build
npm run build:lib && npm run verify:lib
```

Both passed after orch-deslop on Node v22.23.5. CPU affinity limited the final run to two cores, with the default test timeout and no test flags. Earlier runs hit timeouts in existing tests. The sampler's five cases passed on every run after implementation. Orch-deslop removed a duplicate region lookup and the allocation of an array of velocity matches.

```text
Test Files  27 passed (27)
     Tests  225 passed (225)
✓ built in 1.98s
PWA v1.3.0
files generated
  dist/sw.js
  dist/workbox-948e45c5.js
sound-module dist OK
```

## Return

- **Outcome:** done. Implementation commits `5d043db` and `ce75be3`.
- **Decisions made:** `AudioEngine.noteOff()` calls `stop(note)`, so one-shot patches ignore both that call and the callback returned by `start()`. `stop()` without a note still kills active voices. When the browser reports no playable listed format, the loader keeps the original paths. The format tests stub `Audio.canPlayType` without adding a constructor parameter.
- **Follow-ups:** T2 and T4 own assets and playback integration. This task used audio stubs and did not test real browser audio.
- **Open questions:** none.
