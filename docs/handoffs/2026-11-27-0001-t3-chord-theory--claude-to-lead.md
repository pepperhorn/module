# Handoff: 0001-t3 — Chord theory, root-led spelling, CRF colours, voice tracker (claude → lead)

- **Date:** 2026-11-27
- **Type:** return
- **Ledger:** 0001 · **Spec:** docs/specs/0001-keyboard.md · **Plan:** docs/plans/0001-keyboard.md (task T3)
- **Branch:** orch/0001-t3-chord-theory · **Worktree:** /home/shaun/.t3/worktrees/module/t3-3d1ba71c-5cbef75b0f590833
- **PR:** see the PR for this branch
- **Dispatch handoff:** docs/handoffs/2026-11-27-0001-t3-chord-theory--lead-to-impl.md
- **Status:** closed

## Return
- **Outcome:** done
- **Commits:** d55d8ed (code and tests), plus this handoff
- **What changed:**
  - `packages/keyboard/src/theory/{chords,spelling,colors,voices,index}.ts` with the exact interfaces from the plan. `Accidentals` is defined in `chords.ts`.
  - 25 tests across four files. They cover every type × 12 roots, all the spelling examples in the plan, a no-double-accidental sweep over type × root × both settings, a check that each spelled name matches its pitch class, all 12 colours, and the `VoiceTracker` shared-tone cases.
  - The include line in `vitest.config.ts` and in `tsconfig.json`, as written in the dispatch handoff.
- **Verification output:**
  - `npx vitest run packages/keyboard/src/theory`: 4 files, 25 tests passed.
  - `npm run typecheck`: clean.
  - `npm run build`: passed.
  - `npm test`: 245 of 245 pass with `--testTimeout=60000 --maxWorkers=2`. With default settings, 1 to 5 existing tests (`containedOverlays`, `AudioEngine`, `SoundModule`, `embed/index`) fail on the 5s timeout and a different set fails on each run. The host load average was 62 on 12 cores. Each of those tests passes alone.
- **Decisions made:**
  - `spellChord` drops tones above 127, so its output stays aligned with `chordNotes`.
  - `VoiceTracker.roots()` returns the held keys, meaning the pressed roots. Pressing a key already held returns `[]`. A release uses the tones recorded at press time, which is what keeps notes from sticking after a chord-type change.
  - `noteColor` and `pitchName` use `((n % 12) + 12) % 12`, so negative input doesn't break.
- **Out-of-scope issues found:** the existing suite's 5s timeouts flake under heavy host load. T4's reviewer may see the same.
- **Follow-ups:** none.
- **For GBrain (lead to promote):** none beyond the spelling rule already recorded in `projects/module`. GBrain: not queried; the dispatch handoff gave the facts.
