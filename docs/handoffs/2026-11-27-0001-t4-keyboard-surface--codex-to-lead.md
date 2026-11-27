# Handoff: 0001-t4 — Keyboard playing surface (Codex → lead)

- **Date:** 2026-11-27
- **Type:** return
- **Ledger:** 0001 · **Spec:** [Keyboard](../specs/0001-keyboard.md) · **Plan:** [T4](../plans/0001-keyboard.md#t4--package-keyboard-shell-and-playing-surface-play-chord-and-note-names)
- **Dispatch:** [T4 handoff and acknowledgement](2026-11-27-0001-t4-keyboard-surface--lead-to-impl.md)
- **Branch:** `orch/0001-t4-keyboard-surface` · **Worktree:** `/home/shaun/.t3/worktrees/module/t3-c0a11e85-ef745eb146b95598`
- **PR:** None
- **Base commit:** `981ec00538810112454038060a86958b8652abb1`, with the pinned `f5e6d85` as an ancestor
- **Port:** 5214 (unused)
- **Status:** blocked

## Goal

Ship the standalone Keyboard package with Play, Chord, note names, drums, and isolated preferences. Preserve the T5 interfaces in the dispatch.

## Scope

T4 owns the package build, playing surface, smoke test, two root scripts, optional TouchKeyboard props, and its handoffs. The app, sound-module, shared state and input hooks, T5 drawers, T6 assets, publishing, and becreative integration are out of scope.

## Blocker

- [useSoundEngine](../../src/state/useSoundEngine.ts#L137) calls `setCurrentPatchId` after a successful patch load. [Both persistence scopes](../../src/state/useStore.ts#L278) write `module:state:v1`, which sound-module also uses. `trackOffline: false` only skips the offline cache marker. The hook has no injected store or no-persist option, and its unlock path applies sound-module's saved effects.
- [useComputerKeyboard](../../src/input/useComputerKeyboard.ts#L90) calls persisted octave and velocity setters for Z/X/C/V. Focus scoping does not change which store it writes.
- [useSoundEngine's Web MIDI path](../../src/state/useSoundEngine.ts#L314) calls the engine note handlers directly. The hook does not expose a way for Keyboard to route those events through `useChordPlayer`. A second MIDI listener would not suppress the direct notes.

## Acceptance and verification

AC1, T4's portions of AC3–AC6, preference isolation, and AC10 were not exercised. No implementation files changed. Verified the pinned base is an ancestor and checked the hook and store call paths above. The full command remains pending because the package scripts do not exist yet.

```bash
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build && npm run build:lib && npm run verify:lib && npm run build:keyboard && npm run verify:keyboard
```

## Context

GBrain `projects/crf-transcribe` #9 and #10 confirm the flats default and pitch-class labels without octave numbers. The GBrain project lookup did not return the `projects/module` page named by the dispatch. The approved spec remains the source for chord spelling.

## Open question

Can T4 use a keyboard-local adapter around `getEngine` with isolated input state, or should the plan allow additive changes to the shared hooks? I recommend the adapter if keeping the existing app and embed code untouched is the priority. If reusing the hooks is required, authorize seams for isolated state and routed input without changing existing consumers' defaults.

## Return

- **Outcome:** blocked at the dispatch's storage-isolation checkpoint.
- **Commits:** `af201f4` acknowledgement, followed by this return handoff.
- **What changed:** handoff documentation only. No push, PR, or watch.
- **Decisions made:** stopped before package edits. The current hook options cannot satisfy the storage and MIDI contracts together.
- **For GBrain:** `trackOffline: false` does not isolate preferences, and `setPersistScope('embed')` narrows the saved fields without changing the storage key.
