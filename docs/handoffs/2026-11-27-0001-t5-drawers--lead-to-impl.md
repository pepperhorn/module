# Handoff: 0001-t5 — Drawers (Sounds, Effects, Settings), MIDI and responsive layout (lead → impl)

- **Date:** 2026-11-27
- **Type:** dispatch
- **Ledger:** 0001 · **Spec:** docs/specs/0001-keyboard.md · **Plan:** docs/plans/0001-keyboard.md (task T5)
- **Branch:** orch/0001-t5-drawers · **Worktree:** created by T3
- **PR:** —
- **Base commit:** f79eda6 (T1–T4 and T6 all merged)
- **Port (if running a server):** 5215 (always `--host 0.0.0.0`)
- **Status:** open

## Goal
Implement plan task **T5** as written in docs/plans/0001-keyboard.md: the three drawers behind the top bar, MIDI device selection, and the phone-width layout checks. This is the last task before release. Done means its steps are checked off, its tests pass, the Verify command passes, and a draft PR is open with screenshots.

## Context you need
- Spec sections "Layout", "Sounds drawer", "Effects drawer" and "Settings drawer", plus AC7, AC8 and AC9.
- Plan task T5 (already updated for the keyboard-local hooks), plus its Global constraints.
- **Build on T4's keyboard-local hooks**, which are on main. The decision behind them is in docs/handoffs/2026-11-27-0001-t4-keyboard-surface--lead-to-impl-answers.md: the shared hooks write sound-module's `module:state:v1`, which collides with sound-module on becreative.
  - `packages/keyboard/src/engine/useKeyboardEngine.ts` provides `selectPatch(id)`, `setEffectEnabled(id, on)`, `setEffectAmount(id, amount)`, `loading`, and the patch list.
  - `packages/keyboard/src/engine/useKeyboardMidi.ts` provides `devices`, `deviceId` and `setDeviceId`.
  - `packages/keyboard/src/useKeyboardPrefs.ts` holds the prefs: volume, accidentals, names, effects and midiDeviceId. They are written only on a user change.
  - `packages/keyboard/src/TopBar.tsx` provides `onOpenDrawer('sounds' | 'effects' | 'settings')` and `kb-drawer-slot`.
  - The T4 return handoff (docs/handoffs/2026-11-27-0001-t4-keyboard-surface--codex-to-lead.md) documents the exact signatures. Read it first.
- **Never** use `useStore`, `MidiPanel`, `useSoundEngine`, `useComputerKeyboard` or `useWebMidi` in the keyboard. Presentational `EffectPedal`/`Knob` and the `PatchPicker` grouping logic may be reused only if they don't touch the store; check their imports. T4's storage-isolation test (`Keyboard.storage.test.tsx`) must stay green; extend it to cover drawer actions.
- The octave shift (−2 to +2) lives in keyboard state (T4's `useKeyboardKeys`). The Settings drawer controls that same value.

## Scope
- **In:** plan task T5.
- **Out:** publishing, becreative integration, CI changes (`.github/**`), and anything under `src/`.
- **Files you own:**
  - `packages/keyboard/src/drawers/**` and their tests
  - `packages/keyboard/src/TopBar.tsx` and `packages/keyboard/src/Keyboard.tsx`, for drawer wiring only (passing engine, MIDI and prefs callbacks into the drawers)
  - `packages/keyboard/src/styles/**`, for drawer and responsive styles
  - `packages/keyboard/e2e/**`: add `widths.mjs`, and keep `smoke.*` and `host-build.mjs` passing
  - `packages/keyboard/README.md`, for the drawer and MIDI notes
  - your own handoff files for 0001-t5
- **Do not touch:** everything else. If you need another file, stop and report.

## Acceptance criteria
- [ ] AC7: one drawer open at a time; closes on Escape, an outside click, or the same button. Sounds lists Piano and Drums first, then the builtin catalog grouped as `PatchPicker` groups it, with a loading state for streaming patches; selecting a patch closes the drawer. Effects has reverb, delay, chorus and distortion, each with on/off and one amount control, with no doublers and no reordering. Settings has volume, octave shift (clamped to −2…+2), sharps/flats, and the MIDI device. Each change is audible or visible.
- [ ] AC8: MIDI and computer keys play, including in chord mode, and the MIDI device choice persists under `pepperhorn-keyboard:`.
- [ ] AC9: `e2e/widths.mjs` runs at 360, 390 and 1280 px and finds no horizontal scroll, with every bar control and every drawer reachable. Attach the screenshots to the PR.
- [ ] Storage isolation still holds: drawer actions write no `module:` keys.
- [ ] AC10: the app and `@pepperhorn/sound-module` stay green.

## Verify with
```bash
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build && npm run build:lib && npm run verify:lib && npm run build:keyboard && npm run verify:keyboard && node packages/keyboard/e2e/host-build.mjs && node packages/keyboard/e2e/widths.mjs
```
Also run the T4 Chromium smoke test (`packages/keyboard/e2e/smoke.*`). Use the locally cached Playwright and Chromium.

## Known gotchas / decisions already made
- Don't rely on Tailwind classes the scoped CSS build doesn't generate. T4 round 1 hit this with `inset-0`. Check `styles.css`, or use scoped plain CSS.
- Tests that stub `localStorage` must use the in-memory stub pattern (see `src/state/useTheme.test.ts`). Run vitest under Node 22 and Node 26.
- Under host load, existing UI tests time out at 5 s, so use the timeout flags.
- GBrain: `projects/module`, and `projects/crf-transcribe` #11–#12 for the convention of small floating controls with muted colours at rest.

## Open questions
- None. If the plan is wrong or ambiguous, escalate (AGENTS.md §7) rather than improvising.

---
## Receiver ack

I’ll wire Sounds, Effects and Settings to T4’s keyboard-local adapters, verify their controls and input routing, and capture the three requested viewport widths. I’ll add the drawer storage cases under `src/drawers/` and leave the existing storage test in place. I’ll open a draft against main without watching, merging, publishing or deploying. No blocking questions.

---
## Return
(write it in docs/handoffs/2026-11-27-0001-t5-drawers--<you>-to-lead.md)
