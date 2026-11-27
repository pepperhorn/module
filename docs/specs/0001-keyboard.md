# 0001 — Keyboard: a standalone play-along keyboard component

- **Status:** approved (Shaun, 2026-11-27)
- **Ledger:** 0001 · **Plan:** ../plans/0001-keyboard.md (not yet written)
- **Author:** lead · **Date:** 2026-11-27

## Problem

The sound module (this repo, published as `@pepperhorn/sound-module`) is built like a rack, and the on-screen keyboard is only one part of it. Shaun wants the reverse: a **keyboard** that people play along with on the Creative Ranges site, with the module's sound controls tucked away in small drawers. It needs a good piano and a drum kit to work on its own, plus two learning aids: a chord mode and note names on the keys.

Host site: **becreative** (`pepperhorn/becreative`; Astro 7 + `@astrojs/react` 7, React 19, Tailwind 4). The component is mounted there as a React island. Wiring it into becreative is a separate item in that repo.

## Goals

1. A new package, **`@pepperhorn/keyboard`**, which exports `<Keyboard />`. It lives in `packages/keyboard`, next to `packages/sound-module`, and reuses the module's engine and components from `src/`.
2. The keyboard is the main visual element. Sounds, effects and settings sit in drawers that start closed.
3. Two bundled sounds that play with no network access beyond the package's own files:
   - a small **piano** taken from the General MIDI FluidR3 set
   - the drumlet **acoustic** kit, mapped to the keys using the General MIDI drum map
4. **Chord mode** for six chord types: major, minor, diminished, augmented, 7 (dominant) and maj7. One key press plays the whole chord, with the pressed key as the root. The other chord notes light up and show their names.
5. **Note-name mode**: the name of every key is shown on the key.

## Non-goals

- Mounting it in becreative: that's a follow-up item in that repo.
- Publishing to npm. Shaun runs `npm login` and the publish himself, as separate steps.
- Chord types beyond the six listed, as well as inversions, voicing choices, strum or arpeggio.
- Recording, looping, a sequencer, or a metronome.
- More than one `<Keyboard />` on a page. The engine is a single instance, the same limit as sound-module.
- Changes to the existing app or the `@pepperhorn/sound-module` embed, other than small, behaviour-neutral refactors to `src/` that let both use shared code. Any such refactor must keep both builds and every existing test green.

## Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | New package `@pepperhorn/keyboard` in `packages/keyboard`, same library build as sound-module, importing from `src/`. Bundles its own piano and kit. | One more package to publish; its own versioning and look; changes to it can't break the sound-module embed. | **Chosen** (Shaun, 2026-11-27) |
| B | A second export, `Keyboard`, from `@pepperhorn/sound-module`. | One package, but the embed carries the drum kit, chord logic and drawers, and both components always release together. | Rejected |
| C | A separate repo. | Duplicates the engine, patches and effects. | Rejected |

## User-visible behaviour

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [♪ Piano ▾]   [Play | Chord]  [maj min dim aug 7 maj7]  [Aa]  [⚙] │  ← slim top bar
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  KEYBOARD (fills the width)                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
   drawers slide over or under the bar: Sounds · Effects · Settings
```

- The keyboard fills the component's width. Its height comes from the width, and it is never taller than about 45% of the viewport.
- The top bar is one slim row. Its controls, from left to right:
  - **Sound button**, showing the current patch name. It opens the **Sounds** drawer.
  - **Play / Chord** toggle.
  - **Chord-type buttons**, visible only in Chord mode.
  - **Aa** toggle for note names.
  - **⚙** button, which opens **Effects** and **Settings**.
- The component is usable at phone width (360 px). The bar wraps or collapses into icons, and nothing scrolls sideways.
- Only one drawer is open at a time. Escape, a click outside, or the same button closes it.

### Sounds drawer

- The two bundled sounds, **Piano** and **Drums**, are pinned at the top. Both play instantly once the package has loaded.
- Below them is the module's built-in patch catalog (`src/patches/builtin.ts`), grouped as in the module's `PatchPicker`. These stream from their CDNs as they do in the module, so a loading state shows while one loads.
- Selecting a patch closes the drawer.

### Effects drawer

- Reverb, delay, chorus and distortion from `src/audio/effects.ts`.
- Each effect has an on/off control and one main amount control. The builder may reuse `EffectPedal` and `Knob` from `src/components`.
- The doublers and the effect reordering are not shown.

### Settings drawer

- Volume.
- Octave shift (−2 to +2).
- Sharps or flats spelling, defaulting to **flats** to match the CRF pitch-audition convention (GBrain `projects/crf-transcribe` #9).
- MIDI input device, reusing the module's MIDI input.
- Computer-keyboard playing, reusing `useComputerKeyboard`, is on by default and has no setting.

### Play mode (the default)

One key sounds one note. The pressed key is shown as active.

### Chord mode

- A chord type is always selected. **Major** is selected by default.
- Pressing a key plays the chosen chord in root position, with the pressed key as the root. For example, C with major selected plays C-E-G. All chord notes sound together at the pressed key's velocity and stop together when the key is released.
- While the key is held:
  - the root key shows as pressed
  - each other chord-tone key is highlighted in its **CRF note colour** (tables in `~/.claude/CLAUDE.md` "CRF note colours"; source `tiles/src/notes.ts`)
  - each chord-tone key shows a name badge, whether or not note-name mode is on
- Chord tones are spelled correctly for the chord, and the spelling follows the root (Shaun, 2026-11-27):
  - E major is E-G♯-B, C minor is C-E♭-G, and F major is F-A-C.
  - A C♯ chord is spelled with sharps (C♯-E♯-G♯), and a D♭ chord with flats (D♭-F-A♭).
  - For a black-key root, the sharp or flat setting picks the root's name (C♯ or D♭), and the other chord tones follow from that name.
  - When the correct spelling would need a double sharp or double flat, the simpler enharmonic name is used instead.
- When a chord tone falls above the visible range, it still sounds but isn't highlighted.
- Holding several keys plays several chords at once. A chord tone that two chords share is turned off only when the last chord using it is released.
- MIDI and computer-keyboard input follow chord mode in the same way as touch.

### Note-name mode (the Aa toggle)

- Every key shows its pitch-class name, without an octave number, in the sharp or flat spelling set in Settings. This is the same convention as crf-transcribe's "Name all keys" (GBrain `projects/crf-transcribe` #10).
- It works together with chord mode. Chord-tone badges are coloured, and the other names are muted.

### Drums patch

- Keys play the drumlet acoustic kit using this map (General MIDI note → sample):

  | MIDI | Sound | Sample |
  |---|---|---|
  | 35, 36 | Kick | kick |
  | 37 | Side stick | crossstick |
  | 38 | Snare | snare-on1 |
  | 40 | Snare 2 | snare-on2 |
  | 41, 43 | Floor tom | floor-tom |
  | 42 | Closed hi-hat | hh-closed1 |
  | 44 | Pedal hi-hat | hh-foot |
  | 46 | Open hi-hat | hh-open |
  | 45, 47, 48, 50 | Tom | hi-tom |
  | 49, 57 | Crash | crash |
  | 51, 59 | Ride | ride |
  | 53 | Ride bell | ride-bell |

  Keys with no sample are dimmed and silent. (`hh-closed2` and `snare-off` aren't mapped, which is the builder's call to revisit.)
- When Drums is selected, the visible range moves so that 35–59 are in view. Choosing another patch restores the previous range.
- Chord mode is disabled while Drums is selected: the toggle is greyed out, with a tooltip.
- With note names on, the keys show short drum names (Kick, Snare, HH…) instead of pitch names.

### Props (public API)

```ts
interface KeyboardProps {
  defaultPatch?: 'piano' | 'drums' | string // a builtin patch id; default 'piano'
  defaultMode?: 'play' | 'chord'            // default 'play'
  defaultChord?: 'maj' | 'min' | 'dim' | 'aug' | '7' | 'maj7' // default 'maj'
  showNoteNames?: boolean                   // initial Aa state; default false
  accidentals?: 'flat' | 'sharp'            // default 'flat'
  octaves?: number                          // visible octaves; default: fits width (2 on phones, up to 4)
  startOctave?: number                      // lowest C shown; default 3 (C3 = MIDI 48)
  assetBaseUrl?: string                     // override where bundled samples are served from
  className?: string
}
```

User changes after mount (patch, mode, toggles) are kept in component state, not read back from props.

**What is remembered (lead's call).** These are personal preferences, saved site-wide in `localStorage` under the `pepperhorn-keyboard:` prefix: volume, the sharp or flat setting, the note-names toggle, effects, and the MIDI device. They are separate from sound-module's `useStore` keys. Saved values take over from the props on the next load. **Patch, mode and chord type are not saved.** They always start from the props, so a lesson page that sets `defaultMode="chord" defaultChord="min"` always opens that way. Every storage access is wrapped in try/catch, so the component still works without storage.

## Constraints

- **Stack:** React 18 or 19 peer dependency, TypeScript, and Tailwind 4 scoped to a `.keyboard-module` root with no global style leaks. Every element carries a semantic class name next to its utility classes (for example `kb-drawer-sounds`, `kb-chord-btn`). The UI font is Poppins.
- **Note badges** on keys use the house note-text style: white Poppins 600 text with a `rgba(0,0,0,.35)` 3px stroke and `paint-order: stroke`, as specified in `~/.claude/CLAUDE.md` "Note-text SVG style".
- **Rendering:** client-side only. Audio starts on the first user gesture, using the module's power-on or unlock pattern. In Astro it is mounted with `client:only="react"`.
- **Piano asset:**
  - Source: gleitz `midi-js-soundfonts` **FluidR3_GM** `acoustic_grand_piano` (MIT), decoded into separate files.
  - Shipped notes: a subset, roughly every third semitone from C2 to C7. The player fills the gaps by repitching.
  - Formats: `.ogg` plus `.mp3` or `.m4a` as a fallback for Safari.
  - Budget: **≤ 500 KB** for the format a browser actually loads.
  - It is built by a script committed in the repo, so it can be rebuilt.
  - It plays through the module's existing `sampler` patch kind (`src/audio/customSampler.ts`).
- **Sampler changes (lead's call).** `customSampler` may gain options that change nothing unless a patch turns them on:
  - a list of fallback formats for each sample (`.ogg` first, then `.m4a` or `.mp3`)
  - `exactOnly`, so a key with no sample stays silent instead of playing the nearest sample repitched
  - `oneShot`, which ignores note-off so the sample plays out (General MIDI drum behaviour)

  The Drums patch uses `exactOnly` and `oneShot`. Patches that don't set them behave exactly as today, and existing tests must stay green.
- **Where the bundled samples are served from (lead's call).** The samples ship in `dist/assets/` and are found with `new URL('./assets/…', import.meta.url)`. If `assetBaseUrl` is set, it overrides that, for hosts that copy the files into their own `public/`. The package README gives the Astro/Vite setting needed if dev pre-bundling breaks `import.meta.url` (`optimizeDeps.exclude: ['@pepperhorn/keyboard']`). `verify-dist` checks that every referenced asset is in `dist/assets/`.
- **Drum asset:**
  - Source: drumlet `public/samples/acoustic1`, using **variant B** as approved in drumlet `docs/plans/0001-drumlet-player.md` (trimmed cymbal tails, mono except the cymbals and open hat; Vorbis q3 plus AAC).
  - Target: about 330 KB for the format a browser loads.
  - Copy it from drumlet once drumlet task 0001-t1 has merged (the encode script `scripts/encode-acoustic-kit.sh`). If that hasn't landed when this work starts, build against the current 903 KB `.ogg`-only kit and swap it in afterwards. **The swap is required before the first release**, because the current kit has no AAC files and so won't play on Safari.
  - Licence: drumlet's spec records that the kit is cleared for public redistribution (2026-11-27). Ship a NOTICE file with the samples.
- **Bundle:** the package's JS must not pull in the rest of the app (auth, rack, debug). Lazy-load anything heavy.
- **Verify:** `npm run typecheck && npm test && npm run build`, plus the new package's lib build and a `verify-dist` check like sound-module's.

## Acceptance criteria

- [ ] AC1: `packages/keyboard` builds a library with `<Keyboard />` as its only component export, plus `styles.css`. A minimal React 19 harness page renders it with no console errors.
- [ ] AC2: The piano plays from the bundled files with the network limited to the package's own files. Its loaded size is ≤ 500 KB in the chosen format, and the rebuild script reproduces it.
- [ ] AC3: The drums patch plays every mapped General MIDI note from the table above. Keys with no sample are dimmed and silent. The range moves to show 35–59.
- [ ] AC4: In chord mode, each of the six types plays the correct intervals from the pressed root (unit test: every type × all 12 roots). Releasing the key stops every note of that chord. Overlapping chords release correctly.
- [ ] AC5: Chord tones are highlighted in the correct CRF colour and labelled with correct spellings that follow the root (unit test: E maj → G♯, C min → E♭, B dim → F, C aug → G♯, C♯ maj → C♯-E♯-G♯, D♭ maj → D♭-F-A♭; the double-accidental fallback).
- [ ] AC6: Note-name mode labels every visible key without octave numbers and follows the sharp or flat setting. With drums selected, it shows drum names.
- [ ] AC7: The Sounds, Effects and Settings drawers open and close as described, with only one open at a time, closing on Escape or an outside click. Changing a patch or an effect is audible.
- [ ] AC8: Computer-keyboard and Web MIDI input both play, including in chord mode.
- [ ] AC9: At 360 px wide, nothing scrolls sideways and every control can be reached. Checked in a headless browser at 360, 390 and 1280 px.
- [ ] AC10: The existing app and `@pepperhorn/sound-module` builds and tests are unchanged and green.

## Open questions

- None blocking. The drum-kit timing depends on drumlet task 0001-t1 (see Constraints).

## Left to the builder

- The exact piano sample spacing and range within the size budget.
- The drawer animation.
- Exactly how the bar collapses at phone width.
- Whether to reuse `TouchKeyboard` with new props (highlight colours, badges, dimmed keys) or wrap it.
- The short drum labels.
