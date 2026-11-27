# Handoff: 0001-t4 — Package, `<Keyboard />` shell and playing surface (lead → impl)

- **Date:** 2026-11-27
- **Type:** dispatch
- **Ledger:** 0001 · **Spec:** docs/specs/0001-keyboard.md · **Plan:** docs/plans/0001-keyboard.md (task T4)
- **Branch:** orch/0001-t4-keyboard-surface · **Worktree:** created by T3
- **PR:** —
- **Base commit:** f5e6d85 (T1 #16, T2 #15 and T3 #14 merged)
- **Port (if running a server):** 5214 (always `--host 0.0.0.0`)
- **Status:** open

## Goal
Implement plan task **T4** exactly as written in docs/plans/0001-keyboard.md (section "### T4"): the `@pepperhorn/keyboard` library package and its `<Keyboard />` component, covering Play mode, Chord mode, note names, the drums behaviour, the saved-preferences rules, the lib build, and `verify-dist`. Done means its steps are checked off, its tests pass, the Verify command passes, and a draft PR is open.

## Context you need
- Spec: docs/specs/0001-keyboard.md (approved). Read all of it. The parts that bind T4 are "User-visible behaviour" (Layout, Play, Chord, Note-name, Drums, Props), "What is remembered", and Constraints.
- Plan: **Global constraints**, **Review focus** (items 1, 3 and 5 are T4's), and the T4 section with its Interfaces block. T5 builds against the Interfaces you produce (`KeyboardProps`, `useKeyboardPrefs`, `useChordPlayer`, `TopBar` `onOpenDrawer` and `kb-drawer-slot`), so keep those exact names and signatures.
- Already on main, for you to consume:
  - T1, `src/audio/customSampler.ts` and `src/patches/types.ts`: the sampler fields `formats`, `exactOnly` and `oneShot`.
  - T2, `packages/keyboard/src/patches/{bundled,drumMap}.ts` and `packages/keyboard/assets/**`: `PIANO_ID`, `DRUMS_ID`, `bundledPatches(assetBase)`, `DRUM_MAP`, `drumPadFor` and `DRUM_RANGE`.
  - T3, `packages/keyboard/src/theory/index.ts`: `chordNotes`, `spellChord`, `pitchName`, `noteColor`, `VoiceTracker`, `CHORD_TYPES` and the related types.
- Model the package on `packages/sound-module`: its `vite.config.ts`, `scripts/build-css.mjs`, `scripts/verify-dist.mjs`, and the root `build:lib` and `verify:lib` scripts. Model the audio wiring on `src/embed/SoundModule.tsx`: `useSoundEngine`, the power-on gesture, `useComputerKeyboard`, and `LiveTouchKeyboard`/`TouchKeyboard`.
- The host is **becreative** (Astro 7 with `@astrojs/react` 7, React 19, Tailwind 4), which mounts it with `client:only="react"`. becreative **already embeds `@pepperhorn/sound-module`**, so their saved preferences must not collide (see Gotchas).
- **T6 runs in parallel.** It owns `packages/keyboard/src/patches/bundled.ts`, `packages/keyboard/assets/drums/**`, the NOTICE, and the `FORMAT_TYPES` strings in `customSampler.ts`. It keeps `bundled.ts`'s exported names and signatures, swaps the drum files to `.ogg` + `.m4a`, and removes its internal `BundledSamplerSource` type. Don't edit those files, and don't import that internal type.

## Scope
- **In:** everything in plan task T4.
- **Out:** the drawers' contents (Sounds, Effects and Settings) and the width checks at 360, 390 and 1280 px, which belong to T5. T4 only renders the bar buttons and an empty `kb-drawer-slot`. Also out: publishing, and integration into becreative.
- **Files you own:**
  - `packages/keyboard/{package.json,README.md,LICENSE,vite.config.ts,tsconfig.build.json}`
  - `packages/keyboard/scripts/{build-css.mjs,verify-dist.mjs}`
  - `packages/keyboard/src/{index.ts,Keyboard.tsx,KeyboardSurface.tsx,TopBar.tsx,useKeyboardPrefs.ts,useChordPlayer.ts}` and their tests
  - `packages/keyboard/src/styles/**`
  - `packages/keyboard/e2e/smoke.*` (the Playwright smoke test and its harness page)
  - in the root `package.json`, only the new scripts `build:keyboard` and `verify:keyboard`
  - `src/components/TouchKeyboard.tsx` and its test, only to add optional props whose absence changes nothing
  - your own handoff files for 0001-t4
- **Do not touch:** everything else, especially `src/state/useStore.ts`, `src/embed/**` and T6's files. If you need one of them, stop and say so in your return handoff.

## Acceptance criteria
- [ ] AC1: the lib build exports only `Keyboard` plus `styles.css`, and the harness page renders it with a clean console (Playwright smoke test)
- [ ] AC3, behaviour half: the drums play only mapped keys, unmapped keys are dimmed (`kb-key-dim`), the range moves to 35–59, chord mode is disabled while drums are selected, and with names on the keys show drum short names
- [ ] AC4: chords sound and release correctly, including overlapping chords, a chord-type change mid-hold, and patch changes
- [ ] AC5, UI half: chord tones show their CRF colour and correctly spelled badges in the house note-text style
- [ ] AC6: note-name mode labels every key with no octave numbers, following the sharp or flat setting
- [ ] Persistence follows the spec exactly. Prefs are saved under `pepperhorn-keyboard:`. Patch, mode and chord are never restored. The component mounts when `localStorage` throws or holds corrupt JSON.
- [ ] `verify-dist` checks everything listed in plan T4 step 1
- [ ] AC10: the existing app and the `@pepperhorn/sound-module` build (`npm run build:lib && npm run verify:lib`) are unchanged and green

## Verify with
```bash
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build && npm run build:lib && npm run verify:lib && npm run build:keyboard && npm run verify:keyboard
```

## Known gotchas / decisions already made
- **Storage collision (plan Risks).** `src/state/useStore.ts` persists sound-module state (around line 259). If using `useSoundEngine` inside the keyboard would write sound-module's keys on becreative, prevent it without editing `useStore.ts` (for example, through an option the engine hook already exposes). If that can't be done, **stop and report** it in the return handoff rather than editing `useStore.ts`.
- The bundled samples are found via `new URL('./assets/…', import.meta.url)`, with `assetBaseUrl` overriding it. The README must document `optimizeDeps.exclude: ['@pepperhorn/keyboard']` for Astro and Vite dev. Note that this is Astro 7, not 6.
- Under host load, existing UI tests time out at 5 s, so use the timeout flags in Verify.
- Leaving `src/audio/customSampler.ts`'s unguarded `new Audio()` as it is is fine, because the package is client-only (ledger suggestion S2).
- GBrain: `projects/module` (spec approval, root-led chord spelling), `projects/crf-transcribe` #9 and #10 (flats default, "Name all keys" convention).

## Open questions
- None. If the plan is wrong or ambiguous, escalate (AGENTS.md §7) rather than improvising.

---
## Receiver ack

---
## Return
(write it in docs/handoffs/2026-11-27-0001-t4-keyboard-surface--<you>-to-lead.md)
