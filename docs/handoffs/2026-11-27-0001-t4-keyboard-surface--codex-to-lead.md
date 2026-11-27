# Handoff: 0001-t4 — Keyboard playing surface (Codex → lead)

- **Date:** 2026-11-27
- **Type:** return
- **Ledger:** 0001 · **Spec:** [Keyboard](../specs/0001-keyboard.md) · **Plan:** [T4](../plans/0001-keyboard.md#t4--package-keyboard-shell-and-playing-surface-play-chord-and-note-names)
- **Dispatch:** [Original](2026-11-27-0001-t4-keyboard-surface--lead-to-impl.md) · [Scope answers](2026-11-27-0001-t4-keyboard-surface--lead-to-impl-answers.md)
- **Branch:** `orch/0001-t4-keyboard-surface` · **Worktree:** `/home/shaun/.t3/worktrees/module/t3-c0a11e85-ef745eb146b95598`
- **PR:** [Draft PR #18](https://github.com/pepperhorn/module/pull/18)
- **Base:** started at `981ec00` with `f5e6d85` as an ancestor. Merged `main` at `7fd0262` to verify with the landed T6 kit.
- **Port:** 5214 for the local smoke harness.
- **Status:** implementation complete

## Goal and scope

Ship the standalone Keyboard package and its Play, Chord, note-name and drums surface. The PR changes the package, two root build scripts and these handoffs. It leaves the existing app, sound-module, shared state and input hooks, and T6's files unchanged relative to `main`.

## Acceptance

- [x] AC1: the package exports `Keyboard` and `styles.css`. The React 19 Chromium harness loads the built package with a clean console.
- [x] AC3 (T4): Drums shows MIDI 35–59, dims and ignores unmapped keys, shows short pad names, and disables Chord.
- [x] AC4: all inputs share the player. Held chords release their original tones after a chord change, shared tones stay on until released, and patch changes clear held voices and highlights.
- [x] AC5–AC6 (T4): visible chord tones use CRF colors and root-led Poppins SVG labels. Pitch labels follow the accidental preference and omit octave numbers.
- [x] Preferences use only `pepperhorn-keyboard:`. Patch, mode, chord type and octave shift are transient. The mounted test exercises patch changes, chord playing, note names and octave shift without any `module:` writes.
- [x] `verify-dist` checks runtime exports, every mapped sampler file and fallback, scoped CSS, and the bundle module inventory.
- [x] AC10: the standalone app and sound-module build and verify.

## T5 interfaces

- `useKeyboardEngine` takes `{ defaultPatch, assetBaseUrl, prefs, setPrefs }`. It exposes `catalog`, `patch`, `selectPatch(id)`, `loading`, `loadFailed`, `needsGesture`, `ensureAudio()`, `noteOn(midi, velocity)`, `noteOff(midi)`, and `panic()`.
- Effects and volume use `setEffectEnabled(id, on)`, `setEffectAmount(id, amount)`, and `setVolume(volume)`. Amount and volume are 0–1. The amount drives wet mix for reverb, delay, chorus, and distortion. Read the values from `prefs.effects` and `prefs.volume`.
- `useKeyboardMidi` exposes `devices` (`{ id, name }[]`), `deviceId`, `setDeviceId(id)`, and `requestMidi()`. A null device ID routes all inputs. Disconnect and device changes release held notes. The power-on gesture requests MIDI access, and Settings can call `requestMidi()` again if needed.
- `KeyboardProps`, `useKeyboardPrefs`, and `useChordPlayer` retain the plan interfaces. `TopBar` exposes `onOpenDrawer` and the empty `kb-drawer-slot`. The gear selects the Effects entry for the future Effects/Settings drawer. Octave shift is a local `Keyboard` state value.

## Verification

Node 22.23.5. Ran the Verify command before and after `orch-deslop`, then repeated it with the T6 kit on the PR branch. The cleanup pass simplified black-key positioning and removed an empty reset.

```bash
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build && npm run build:lib && npm run verify:lib && npm run build:keyboard && npm run verify:keyboard
node packages/keyboard/e2e/smoke.mjs
```

```text
Test Files  38 passed (38)
     Tests  271 passed (271)
sound-module dist OK
keyboard dist OK (1 export, 56 sampler files, 40 scoped selectors)
Chromium smoke OK (React 19, 16 piano files, 12 drum files, clean console)
```

## Decisions and follow-ups

- Used a keyboard-local surface and adapters, per the lead's scope answers. The shared engine still supplies patch loading and audio. The player lets tones outside the visible range sound, but the surface only draws labels for keys in range.
- The library's sampler URLs are relative to its JS by default. The README documents Astro 7's client-only import, Vite's exclusion setting, and `assetBaseUrl` for hosts that relocate the bundle.
- T5 owns the drawers and width checks. Physical MIDI, WebKit playback and becreative integration were not verified by T4. No publish or deploy.
- GBrain `projects/crf-transcribe` #9 and #10 confirm the flats default and pitch-class labels without octave numbers. GBrain did not return the `projects/module` page named by the dispatch. The approved spec governs chord spelling.

## Return

- **Outcome:** done. Code commit `540fa82`, followed by the merge from `main` and this handoff.
- **For GBrain:** `trackOffline: false` skips offline bookkeeping, not sound-module preference writes. The separate adapters reuse the audio engine without using the shared state setters.

## Round 2

Addressed the five blockers from the [review of `437de50`](https://github.com/pepperhorn/module/pull/18#pullrequestreview-6084571572) under the [fix-round handoff](https://github.com/pepperhorn/module/blob/b55eeb5b3d8370de86e02b276b56deed0c674466/docs/handoffs/2026-11-27-0001-t4-keyboard-surface--lead-to-impl-r2.md).

- Generated one literal URL per sample from the piano note index and drum kit manifest. The packed library leaves those literals for Vite to rewrite. The sampler gets the selected codec's resolved URL without an extension substitution, and keeps separate cache keys for piano and drums. `assetBaseUrl` still overrides the bundled assets. No shared sampler code changed.
- The audio overlay is positioned in scoped CSS. Chromium compares its box against the keyboard before unlocking and then plays both instruments.
- Both storage suites use a Map-backed stub on Node 22 and 26. The setter writes only changed values and ignores no-ops, so an untouched prop value does not become a site-wide preference.
- Keyboard and T5 share `useChordPlayer({ ..., accidentals })`, which also returns `releaseAll` and `badges`. Tests cover C♯ major and D♭ major spellings.
- T5 can stop Escape propagation when a drawer owns it to avoid also panicking the player.

Ran the fix-round Verify command before and after `orch-deslop`. The cleanup removed redundant overlay positioning and tightened the production check to match literal `new URL` arguments against the emitted files.

```text
Node 22.23.5: 38 test files, 277 tests passed
Node 26.12.0: 38 test files, 277 tests passed
sound-module dist OK
keyboard dist OK (1 export, 60 sampler files, 41 scoped selectors)
Vite production host OK (60 packed piano and drum files, both codecs, all JS URLs resolved)
Chromium smoke OK (React 19, 16 piano files, 12 drum files, clean console)
```
