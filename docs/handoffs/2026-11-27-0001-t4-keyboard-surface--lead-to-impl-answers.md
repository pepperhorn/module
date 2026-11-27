# Handoff: 0001-t4 — Answers to the storage/MIDI blocker (lead → impl)

- **Date:** 2026-11-27
- **Type:** dispatch (answers)
- **Ledger:** 0001 · **Plan:** docs/plans/0001-keyboard.md (task T4)
- **Branch:** orch/0001-t4-keyboard-surface (continue at d6a5a84)
- **Status:** open

## Decision: a keyboard-local adapter (your recommendation, accepted)

Don't use `useSoundEngine`, `useComputerKeyboard` or `useWebMidi` in the keyboard. Don't change them or `useStore.ts`. Build keyboard-local equivalents inside the package instead.

- **`packages/keyboard/src/engine/useKeyboardEngine.ts`.** It wraps `getEngine()` and loads patches the way `src/audio/loadPatch.ts` does, registering the bundled manifests from `bundledPatches()` plus the builtin catalog. It also handles the unlock / power-on gesture, the selected patch, volume, and the effects, all held in keyboard state backed by `useKeyboardPrefs`. It exposes `noteOn(midi, vel)`, `noteOff(midi)`, `panic()`, `selectPatch(id)`, `loading`, `needsGesture` and `ensureAudio()`, plus effect setters for T5, which you name and document in your return handoff.
- **`packages/keyboard/src/engine/useKeyboardMidi.ts`.** It calls `navigator.requestMIDIAccess` directly and handles note-on and note-off only (note-on with velocity 0 counts as note-off). It feeds events to `useChordPlayer.press`/`release` and exposes `devices`, `deviceId` and `setDeviceId`, persisted through `useKeyboardPrefs.midiDeviceId`. With no Web MIDI or a permission denial it degrades silently, and there's no MIDI learn.
- **`packages/keyboard/src/engine/useKeyboardKeys.ts`.** It handles computer-keyboard playing, routed through `useChordPlayer`. It may import the **constants and pure helpers** `KEY_TO_SEMITONE`, `keyLabelForSemitone` and `isModalOpen` from `src/input/useComputerKeyboard.ts`, but not the hook. It keeps octave shift in keyboard state, and it scopes key handling so typing in inputs and modals doesn't play.
- **Read-only imports from `src/` are fine:** `AudioEngine`, `getEngine`, `loadPatch`, `effects`, patch types, the builtin catalog and presentational components. `AudioEngine.ts` only *reads* `useStore` (`debugMode`), which is acceptable.
- **A new acceptance test, `Keyboard.storage.test.tsx`.** Mount `<Keyboard />`, change the patch, play a chord, toggle names, then shift the octave with the keys. Assert that `localStorage` has **no key starting with `module:`**, and that every key written starts with `pepperhorn-keyboard:`. This is what proves the isolation the spec requires.
- **Ownership grows** to include `packages/keyboard/src/engine/**` and its tests. Everything else in the original handoff stays the same.
- T5 will build its Settings MIDI picker and its Effects drawer on these hooks, not on `MidiPanel` or the store. I'll update T5's handoff to match.

Continue the original handoff (docs/handoffs/2026-11-27-0001-t4-keyboard-surface--lead-to-impl.md) from your branch.
