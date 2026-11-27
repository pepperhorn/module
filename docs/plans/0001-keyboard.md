# Plan 0001 — Keyboard: a standalone play-along keyboard component

> **For agentic workers:** each task below goes to one implementer in its own worktree (AGENTS.md §4). Work test-first inside your task. Your handoff doc is your brief; this plan and the spec are its references.

- **Spec:** [../specs/0001-keyboard.md](../specs/0001-keyboard.md) (approved 2026-11-27)
- **Base:** main @ 8181404
- **Verification (whole item):** `npm run typecheck && npm test && npm run build && npm run build:keyboard && npm run verify:keyboard` (the last two scripts exist once T4 lands)

**Goal:** ship `@pepperhorn/keyboard`, a `<Keyboard />` React component for becreative. The keyboard is the hero, sound controls sit in drawers, and it includes a bundled piano, the drumlet acoustic kit on the GM drum map, a chord mode and a note-name mode.

**Architecture:** a new library package in `packages/keyboard`, built the same way as `packages/sound-module`: a Vite lib build from source in the package plus shared code imported from `src/`, CSS built by a script, and a `verify-dist` check. It reuses `useSoundEngine` / `getEngine`, `customSampler`, `effects`, `useWebMidi`, `useComputerKeyboard` and, where it fits, `TouchKeyboard`. Pure music logic (chords, spelling, colours, drum map) sits in its own folder with exhaustive unit tests. Bundled samples ship in `dist/assets/` and are found through `import.meta.url`.

**Tech stack:** React 19 (peer 18 or 19), TypeScript, Vite 8 lib mode, Tailwind 4 (scoped), smplr 0.20, Web Audio, vitest + jsdom, ffmpeg for the asset scripts, Playwright (playwright-core) for the width checks.

## Global constraints (from the spec, applying to every task)

- Package name `@pepperhorn/keyboard`; its only component export is `Keyboard`; it exports `styles.css`; peer dependencies are `react`/`react-dom` `^18 || ^19`; client-side only.
- All styles are scoped under `.keyboard-module`. Every element has a semantic `kb-*` class next to its Tailwind utilities. The UI font is Poppins.
- Note badges use the house note-text style: `text-anchor: middle; dominant-baseline: central; fill: #fff; font-size: 20; font-family: Poppins, sans-serif; font-weight: 600; stroke: rgba(0,0,0,.35); stroke-width: 3; paint-order: stroke`.
- CRF colours by pitch class: C `#f86e6e`, C♯/D♭ `#f58841`, D `#ffbc57`, D♯/E♭ `#b8a334`, E `#fff56d`, F `#b3f888`, F♯/G♭ `#93d154`, G `#6bc6a0`, G♯/A♭ `#7ee8df`, A `#88a7f8`, A♯/B♭ `#cc97e8`, B `#e277b1`.
- Default spelling is **flats**. Chord tones are spelled from the root: C♯ chords use sharps, D♭ chords use flats, and a double accidental falls back to the simpler enharmonic name.
- Piano: FluidR3_GM `acoustic_grand_piano` (MIT), a subset of notes in C2–C7, ≤ 500 KB for the format a browser loads, with `.ogg` first and `.m4a` (or `.mp3`) as the fallback.
- Drums: drumlet acoustic1. Variant B (about 330 KB) must be swapped in before the first release.
- Saved per browser under `pepperhorn-keyboard:`: volume, accidentals, note names, effects and MIDI device. Never saved: patch, mode and chord type. Every storage access is wrapped in try/catch.
- The existing app and `@pepperhorn/sound-module` behave exactly as before, and their tests stay green.
- No npm publish. Shaun runs `npm login` and the publish himself, as separate steps.

## Review focus (failure modes the spec implies; each has a test in its owning task)

1. **Stuck notes:** a chord is released after the mode or chord type changed mid-hold, or after the patch changed. Every voice started must still stop (T4: `releases the voices it started even if chord type changed while held`).
2. **Shared tones:** two held chords share a tone and one is released, so the shared tone must keep sounding (T3 `VoiceTracker` test).
3. **Octave edges:** a root near the top of the range has chord tones above MIDI 108 or above the visible range. They must not crash or highlight anything (T3: `clamps chord tones to 0..127`; T4: no highlight off-range).
4. **Drum one-shot:** a fast tap on the crash must not cut its tail, and an unmapped key must stay silent (T1 sampler tests).
5. **Missing storage:** `localStorage` throws, as in Safari private mode, or holds corrupt JSON. The component must still mount with its defaults (T4: `mounts when localStorage throws`).

---

## Tasks

T1, T2 and T3 own disjoint files and can run in parallel. T4 needs all three. T5 needs T4. T6 waits on drumlet.

### T1 — Sampler opt-ins: format fallback, exactOnly, oneShot
- **Depends on:** —
- **Route:** implement (default)
- **Owns:** `src/audio/customSampler.ts`, `src/audio/customSampler.test.ts` (new), `src/patches/types.ts` (the `sampler` source variant only)
- **May read:** anything
- **Acceptance:** spec "Sampler changes" constraint; part of AC3; AC10
- **Verify:** `npm run typecheck && npm test && npm run build`
- **Interfaces (produced):**
  ```ts
  // src/patches/types.ts, extending the sampler variant (all optional; absent = today's behaviour)
  { kind: 'sampler'; baseUrl: string; samples: Record<string, SampleEntry>;
    formats?: string[]      // e.g. ['ogg','m4a']; each sample path's extension is swapped to the first playable one
    exactOnly?: boolean     // only notes with a sample sound; the rest are silent no-ops
    oneShot?: boolean       // the stop function returned by start() is a no-op; the buffer plays out
  }
  ```
  `CustomSampler` keeps its constructor and `start(event): () => void` signature.
- **Steps:**
  1. Write failing tests in `customSampler.test.ts`, with a stub `SampleStorage`, an `AudioContext` stub and a `canPlayType` injection:
     - `formats: picks first playable extension` (ogg playable → fetches `.ogg`; not playable → `.m4a`)
     - `exactOnly: unmapped note returns a no-op and starts no source`
     - `oneShot: calling stop does not stop the source`
     - `default: nearest sample repitched and 40ms release unchanged` (a regression test for existing patches)
  2. Implement. Detect format with `new Audio().canPlayType` (injectable for tests). Choose the format once, at load.
  3. Run the full test suite, then commit `feat(sampler): opt-in format fallback, exactOnly and oneShot`.
- **Notes:** don't touch `loadPatch.ts`. The source object passes straight through, so check whether it needs changes and, if it does, stop and say so in the return handoff.

### T2 — Bundled assets: piano build script, drum kit, patch manifests, GM drum map
- **Depends on:** — (writes manifests against T1's interface above; it doesn't import T1's code)
- **Route:** implement (default)
- **Owns:** `packages/keyboard/assets/**`, `packages/keyboard/scripts/build-piano.mjs`, `packages/keyboard/scripts/copy-kit.mjs`, `packages/keyboard/src/patches/**`, plus the identical include-line edits to `vitest.config.ts` and `tsconfig.json` that T3 also makes
- **May read:** anything; `/home/shaun/drumlet/public/samples/acoustic1/` (source kit); the gleitz CDN (`https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-{ogg,mp3}.js`)
- **Acceptance:** AC2; the asset half of AC3
- **Verify:** `node packages/keyboard/scripts/build-piano.mjs --check && npm test`
- **Interfaces (produced):**
  ```ts
  // packages/keyboard/src/patches/bundled.ts
  export const PIANO_ID = 'kb/piano', DRUMS_ID = 'kb/drums'
  export function bundledPatches(assetBase: URL | string): PatchManifest[] // sampler sources; drums: exactOnly+oneShot, formats
  // packages/keyboard/src/patches/drumMap.ts
  export interface DrumPad { midi: number; sample: string; label: string; short: string }
  export const DRUM_MAP: readonly DrumPad[]   // exactly the spec's table (35–59)
  export function drumPadFor(midi: number): DrumPad | undefined
  export const DRUM_RANGE = { low: 35, high: 59 }
  ```
  Assets go to `packages/keyboard/assets/piano/*.{ogg,m4a}` and `packages/keyboard/assets/drums/*.ogg` plus `NOTICE`.
- **Steps:**
  1. Write failing tests in `src/patches/drumMap.test.ts`:
     - every spec row is mapped (35/36 → kick, …, 53 → ride-bell)
     - `drumPadFor(39)` is `undefined`
     - every `sample` named exists in `assets/drums/`
  2. Write failing tests in `src/patches/bundled.test.ts`:
     - the piano manifest's note names lie within C2–C7, and each one has files in both formats
     - the drums manifest sets `exactOnly`, `oneShot` and `formats`
  3. Write `build-piano.mjs`. It downloads the gleitz mp3 `.js` soundfont, decodes its base64 notes, picks every third semitone from C2 to C7 (the spacing may be adjusted to fit the budget), and uses ffmpeg to encode `.ogg` (Vorbis q3) and `.m4a` (AAC 96k). With `--check`, it reports the total per format and fails if either is over 500 KB. Run it, then commit the outputs.
  4. Write `copy-kit.mjs <src-dir>`. It copies the drumlet kit's files and adds an `m4a` set when the source has one. For now the source is `.ogg` only, so the manifest lists `formats: ['ogg']` (T6 changes this). Write `NOTICE` with the drumlet kit credit, the "cleared for redistribution 2026-11-27" note, and FluidR3 MIT attribution.
  5. Make the tests pass, then commit `feat(keyboard): bundled piano + acoustic kit, GM drum map`.

### T3 — Music theory: chords, spelling, colours, voice tracking
- **Depends on:** —
- **Route:** implement (alt)
- **Owns:** `packages/keyboard/src/theory/**`, plus the identical include-line edits to `vitest.config.ts` and `tsconfig.json` that T2 also makes
- **May read:** anything
- **Acceptance:** the logic halves of AC4 and AC5, and AC6 (spelling)
- **Verify:** `npx vitest run packages/keyboard/src/theory`
- **Interfaces (produced):**
  ```ts
  export type ChordType = 'maj' | 'min' | 'dim' | 'aug' | '7' | 'maj7'
  export const CHORD_TYPES: readonly ChordType[]          // display order as listed
  export const CHORD_INTERVALS: Record<ChordType, number[]> // maj [0,4,7] min [0,3,7] dim [0,3,6] aug [0,4,8] 7 [0,4,7,10] maj7 [0,4,7,11]
  export type Accidentals = 'flat' | 'sharp'
  export function chordNotes(root: number, type: ChordType): number[]   // midi, clamped to 0..127 (drops out-of-range)
  export function spellChord(root: number, type: ChordType, acc: Accidentals): string[] // per tone, aligned with chordNotes
  export function pitchName(midi: number, acc: Accidentals): string    // 'D♭' / 'C♯' / 'C'
  export function noteColor(midi: number): string                     // CRF hex by pitch class
  export class VoiceTracker {                                          // reference-counted note on/off
    press(key: number, notes: number[]): number[]   // returns notes that must start now
    release(key: number): number[]                  // returns notes that must stop now
    held(): ReadonlySet<number>; roots(): ReadonlySet<number>
  }
  ```
- **Spelling algorithm** (the one rule the tests don't fully pin down):
  - The root letter comes from `pitchName(root, acc)`.
  - Each tone gets the letter that is its scale degree above the root's letter (3rd → +2 letters, 5th → +4, 7th → +6).
  - The accidental is whatever makes that letter match the pitch class.
  - If that needs `𝄪` or `𝄫`, use `pitchName(tone, acc)` instead.
- **Steps:**
  1. Write failing tests:
     - `chordNotes`: every type × 12 roots against `CHORD_INTERVALS`; `chordNotes(125,'maj7')` drops the tones above 127
     - `spellChord`:
       - E maj → `['E','G♯','B']`
       - C min → `['C','E♭','G']`
       - F maj → `['F','A','C']`
       - B dim → `['B','D','F']`
       - C aug → `['C','E','G♯']`
       - C♯ maj (sharp) → `['C♯','E♯','G♯']`
       - D♭ maj (flat) → `['D♭','F','A♭']`
       - G♯ aug (sharp) → `['G♯','B♯','E']`: the 5th falls back to `'E'` instead of `'D𝄪'`
       - every type × 12 roots × both settings: no `𝄪` or `𝄫` ever appears
     - `pitchName`: 61 → `D♭` (flat) and `C♯` (sharp)
     - `noteColor`: all 12 pitch classes match the hex table in Global constraints
     - `VoiceTracker`:
       - C maj and A min held together share C and E
       - releasing C maj stops only G
       - releasing A min afterwards stops A, C and E
       - pressing the same key twice doesn't double-count
  2. Implement them in `chords.ts`, `spelling.ts`, `colors.ts` and `voices.ts`, plus `index.ts`.
  3. Commit `feat(keyboard): chord theory, root-led spelling, CRF colours, voice tracker`.

### T4 — Package, `<Keyboard />` shell and playing surface (Play, Chord and note names)
- **Depends on:** T1, T2, T3 merged
- **Route:** implement (default)
- **Owns:**
  - `packages/keyboard/{package.json,README.md,LICENSE,vite.config.ts,tsconfig.build.json}`
  - `packages/keyboard/scripts/{build-css.mjs,verify-dist.mjs}`
  - `packages/keyboard/src/{index.ts,Keyboard.tsx,KeyboardSurface.tsx,TopBar.tsx,useKeyboardPrefs.ts,useChordPlayer.ts,styles/**}` and their tests
  - root `package.json` (the scripts `build:keyboard` and `verify:keyboard` only)
  - `src/components/TouchKeyboard.tsx`, only for optional new props whose absence changes nothing
- **May read:** anything
- **Acceptance:** AC1, AC3 (behaviour), AC4, AC5 (UI), AC6; the persistence rules in the spec's "What is remembered"
- **Verify:** `npm run typecheck && npm test && npm run build && npm run build:keyboard && npm run verify:keyboard`
- **Interfaces:**
  - Consumes: T1's sampler fields; T2's `bundledPatches`, `DRUM_MAP`, `drumPadFor` and `DRUM_RANGE`; T3's whole `theory` index.
  - Produces, for T5:
    ```ts
    export interface KeyboardProps { /* exactly as in the spec's Props block */ }
    // useKeyboardPrefs.ts
    export interface KeyboardPrefs { volume: number; accidentals: Accidentals; showNames: boolean; effects: Record<string, { on: boolean; amount: number }>; midiDeviceId: string | null }
    export function useKeyboardPrefs(defaults: Partial<KeyboardPrefs>): [KeyboardPrefs, (patch: Partial<KeyboardPrefs>) => void]
    // useChordPlayer.ts: the single entry point for all input sources
    export function useChordPlayer(opts: { mode: 'play'|'chord'; chord: ChordType; isDrums: boolean; noteOn(m:number,v:number):void; noteOff(m:number):void }):
      { press(key: number, velocity: number): void; release(key: number): void; lit: ReadonlyMap<number, { name: string; color: string; root: boolean }> }
    // TopBar.tsx exposes onOpenDrawer(name: 'sounds'|'effects'|'settings') and renders a `kb-drawer-slot`; T5 fills the slot
    ```
- **Steps:**
  1. Scaffold the package, mirroring `packages/sound-module`. Its lib entry is `packages/keyboard/src/index.ts`; the asset dir `packages/keyboard/assets` is copied to `dist/assets`; react, smplr and zustand are external; there's no PWA or vendored-sample plugin. `verify-dist.mjs` checks:
     - `dist/index.js` exports only `Keyboard`
     - every asset URL the manifests reference exists in `dist/assets`
     - `styles.css` has no unscoped selectors
     - the bundle doesn't import `src/components/AuthModal`, `Rack`, `DebugPanel` or `useAuth`
  2. Write failing tests:
     - `Keyboard.test.tsx`:
       - renders with defaults (`kb-root`, 2+ octaves)
       - `defaultMode="chord" defaultChord="min"` shows the chord bar with `min` pressed
       - mode, patch and chord are not restored from storage on remount
       - volume and names are restored
       - `mounts when localStorage throws`
     - `useChordPlayer.test.ts`:
       - chord mode, maj, press 60 → noteOn 60/64/67
       - release → noteOff for all three
       - `releases the voices it started even if chord type changed while held`
       - `lit` for 60 maj = {60 root, 64 E, 67 G} with CRF colours
       - drums: chord mode is ignored and only the key sounds
       - no `lit` entries outside the visible range
     - `KeyboardSurface.test.tsx`:
       - names on → every key labelled with no octave numbers, following accidentals
       - drums → keys from `DRUM_MAP` show `short`, unmapped keys carry `kb-key-dim`
       - drums → the visible range covers 35–59
  3. Implement:
     - **Audio:** `Keyboard` uses `useSoundEngine` with the bundled manifests registered, and the power-on gesture pattern as in `src/embed/SoundModule.tsx`.
     - **Inputs:** touch, computer keyboard and MIDI all route through `useChordPlayer`.
     - **Badges:** they are SVG text in the house note-text style.
     - **Storage isolation:** if `useStore`'s own persist would write sound-module keys, stop it from persisting inside the keyboard. If that isn't possible without changing `useStore`, stop and report it in the return handoff.
  4. Run the verify command, add a Playwright smoke test (harness page; the console stays clean), and commit.

### T5 — Drawers (Sounds, Effects, Settings), MIDI and responsive layout
- **Depends on:** T4 merged
- **Route:** implement (default)
- **Owns:** `packages/keyboard/src/drawers/**`, `packages/keyboard/src/TopBar.tsx` (the `kb-drawer-slot` wiring only), `packages/keyboard/e2e/**`
- **May read:** anything
- **Acceptance:** AC7, AC8, AC9; and AC10 re-checked
- **Verify:** whole-item verification plus `node packages/keyboard/e2e/widths.mjs`
- **Interfaces:** consumes `KeyboardPrefs` / `useKeyboardPrefs`, `onOpenDrawer`, and the engine's patch and effect setters through `useSoundEngine`.
- **Steps:**
  1. Write failing tests:
     - only one drawer is open at a time; Escape, an outside click and the same button all close it
     - Sounds lists Piano and Drums first, then the builtin catalog grouped as `PatchPicker` groups it; selecting a patch closes the drawer
     - Effects: toggling reverb calls the engine's effect setter and persists to prefs
     - Settings:
       - the octave shift is clamped to −2…+2
       - accidentals flips the labels
       - MIDI device choice persists
  2. Implement, reusing `PatchPicker` grouping logic, `EffectPedal`/`Knob` and `MidiPanel` pieces where they fit. Effects are reverb, delay, chorus and distortion, each with on/off plus one amount control; the doublers and reordering are hidden.
  3. Add `e2e/widths.mjs` (playwright-core with cached Chromium). It runs at 360, 390 and 1280 px and asserts no horizontal scroll and that every bar control and drawer is reachable. Save screenshots to the PR.
  4. Commit and open the PR.

### T6 — Swap in drumlet's variant-B kit (ogg + m4a)
- **Depends on:** drumlet task 0001-t1 merged in pepperhorn/drumlet (`scripts/encode-acoustic-kit.sh` plus the re-encoded `public/samples/acoustic1`)
- **Route:** implement (default), through the quick lane
- **Owns:** `packages/keyboard/assets/drums/**`, `packages/keyboard/src/patches/bundled.ts` (drums `formats` only)
- **Acceptance:** drums ≤ ~330 KB per format; drums play on WebKit (the Playwright webkit smoke test, if it's cached, otherwise recorded as untested); AC3 still green
- **Verify:** whole-item verification
- **Notes:** this blocks the first release, but not T1–T5.

## Merge order

T1, T2 and T3 in any order → T4 → T5 → T6 (when drumlet is ready) → Shaun publishes.

## Risks

- **`useStore` persistence collides with sound-module in becreative.** sound-module is already embedded there (`src/embed/SoundModule.tsx`: "becreative passes ''"). If both persist the same keys, preferences bleed between them. T4 must isolate them, or stop and escalate.
- **`import.meta.url` assets under Astro 7 dev.** The README documents `optimizeDeps.exclude`. Integration in becreative is the follow-up that proves it.
- **The 500 KB piano budget is tight with two formats.** Only the format a browser loads counts, and the spacing can widen to every fourth semitone if needed.
- **One engine per page.** The keyboard and sound-module can't share a page. The README says so.
