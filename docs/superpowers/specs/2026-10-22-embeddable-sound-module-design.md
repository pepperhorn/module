# Embeddable Sound Module for becreative — Design

Date: 2026-10-22
Status: Draft for review

## Intent

Put the module on becreative pages (Astro 7, `be.creativeranges.org`) as a
**sound module**: the visitor already has something to play — the computer
keyboard, a MIDI keyboard, or a wind controller — and this component makes the
sound. It is a slimmed-down sibling of the standalone app, not a replacement.

On a teaching site, the on-screen piano doubles as a reference: every key the
computer keyboard can play is labelled with its letter, so a learner can see
which key on their laptop plays which note.

The standalone PWA (offline, save, sign-in, effects) stays exactly as it is.

## Goals

1. An npm package exporting a React component `<SoundModule />` that becreative
   mounts with `client:only="react"`, following the house pattern used by
   `@pepperhorn/react-music-tools` and `pepperscore`.
2. Three inputs, behaving as they do in the module today:
   - **Computer keyboard**, Ableton layout (`src/input/useComputerKeyboard.ts`):
     `A W S E D F T G Y H U J K O L P ; '` = C up to F an octave and a half
     above; `Z`/`X` octave down/up; `C`/`V` velocity down/up; `Esc` panic.
   - **MIDI keyboard** via Web MIDI, with the existing on-demand permission
     flow and input picker.
   - **Wind controller** breath control, including the current MIDI/Breath
     screen (`MidiPanel.tsx`), presets, live meter and learn.
3. **Full current patch list** — all smplr built-ins plus the custom `CST`
   patches — via the existing patch picker (search/browse), with prev/next.
4. **On-screen piano** (from `TouchKeyboard.tsx`) that:
   - shows the computer-keyboard letter on each key the keyboard can play,
     following the current octave (after `Z`/`X`, labels move with it);
   - lights keys played from any input (it already does, via `activeNotes`);
   - remains clickable/tappable to play.
5. Lives inside the page as a self-contained panel: no global CSS, no effect on
   the host's `<html>`, typing elsewhere on the page never plays notes.
6. Keeps the JV-1080 rack look.

## Non-goals

- Offline capability of any kind in the embed: no service worker, no PWA
  manifest, no `virtual:vendored-samples`, no sample warm-up, no Cache API
  (`module-cdn-v1`), no "downloaded" state or offline pill.
- Sign-in, user patches, saving (`useAuth`, `AuthModal`, `UserMenu`,
  `SaveDialog`, `useUserPatchSync`, `applyUserPatchFx`).
- Effects UI (`EffectsRow`, pedals, reorder). The engine runs its default
  effects state; no user control.
- Debug panel, RAW test button, update toast, wake lock, output picker,
  connection status, theme toggle UI, keyboard-mode switch.
- Multiple `<SoundModule>` instances on one page (see Constraints).
- An iframe embed (becreative sends `frame-ancestors 'none'` / `X-Frame-Options: DENY`).
- A CMS block editors can drop into arbitrary pages — possible later. This
  work delivers a reusable component plus one dedicated page using it.

## Anti-goals (failure even if it "works")

- Any style leaking out: host fonts, buttons, `font-mono`, body background or
  Tailwind preflight changing on becreative.
- Typing in becreative's search box, forms, or anywhere outside the module
  plays notes or changes octave.
- The embed registering a service worker or hijacking navigation.
- Breaking the standalone app or its offline mode.
- Shipping 26 MB of samples into becreative's deploy.

## Constraints

- Host: `/home/shaun/becreative`, Astro `^7.3.8`, `@astrojs/react ^7`,
  `output: 'server'`, Node adapter, Tailwind v4, pnpm, React 19.
- House packaging pattern (`/home/shaun/crf-react-music-tools`):
  Vite library mode, ESM only, `minify: false`, `publicDir: false`,
  react/react-dom/jsx-runtime external, peer deps `react`/`react-dom`
  `^18 || ^19`, `exports` with `./styles.css` and opt-in `./fonts.css`,
  `sideEffects: ["*.css"]`, CSS scoped by `scripts/build-css.mjs`
  (`:where(.root, .root *)` scoping, `--tw-*` renamed, rem→px), published to
  npm on `v*` tags by a GitHub Actions workflow.
- Client-only: rendered with `client:only="react"`, so SSR safety is not
  required, but nothing may touch `window`/`document` at import time in a way
  that leaves listeners behind or mutates the host.
- The zustand store (`src/state/useStore.ts`) is a module-level singleton, and
  the engine (`getEngine()`, `AudioEngine.ts:1036`) is a singleton
  AudioContext. Hence one instance per page.
- becreative's `src/lib/security-headers.ts:137` sends `midi=()` site-wide;
  Web MIDI is dead until that changes. Middleware (`src/middleware.ts:299`)
  already varies headers per path (`securityHeadersFor`, `isShareSecretPath`).

## Decisions (made in conversation)

- **Purpose:** sound module for computer keyboard (Ableton layout) / MIDI
  keyboard / wind controller — user's words.
- **Wind controller breath support included**, "as per module now" — user.
- **On-screen piano shows the Ableton computer-keyboard letters** for
  reference — user.
- **Patch list: what we have now** (full list) — user.
- **No offline capability, simpler feature set** — user.

## Design

### Package

- Name: `@pepperhorn/sound-module` *(my call)*. The repo's `package.json`
  stays the app's; the library gets its own build config and publish
  metadata. Whether that's a `packages/sound-module/` workspace or a second
  Vite config + `files`/`exports` in the root `package.json` is left to the
  builder; the constraint is that `npm run build` / `npm run dev` for the app
  are unchanged.
- Library entry `src/embed/index.ts` exporting `SoundModule` and its prop
  types. Build with a separate config (e.g. `vite.lib.config.ts`) that does
  **not** include `VitePWA` or `vendoredSamplesPlugin`.
- `./styles.css` (scoped, required) and `./fonts.css` (opt-in fontsource
  imports for Michroma, Chakra Petch, Inter, JetBrains Mono).
- Released the same way as `crf-react-music-tools` (tag → npm publish).
  For local development before the first release, becreative may use a
  `link:`/`file:` dependency on a branch only.

### Component API

```ts
interface SoundModuleProps {
  /** Base URL that serves the module's /patches/** files (CST patches).
   *  becreative passes "" (its own origin). If omitted, CST patches are hidden. */
  assetBaseUrl?: string
  /** 'dark' (default) | 'light' — applied to the component root only. */
  theme?: 'dark' | 'light'
  /** Number of octaves on the on-screen piano. Default 2 (25 keys). */
  octaves?: number
  className?: string
}
```

Anything more (initial patch, callbacks) is out of scope until needed.

### What's in the embed

Composition, top to bottom, inside a single root
`<div class="sound-module" data-theme=… tabIndex={0}>`:

1. **Header strip** — LCD showing patch name/bank, prev/next, *Browse*
   (opens `PatchPicker`), octave and velocity readout, `MidiStatus` pill
   (opens `MidiPanel`), a small "keys active" indicator (see Focus).
2. **On-screen piano** — `TouchKeyboard` with letter labels.

Reused: the engine, `selectPatch`, `noteOn`/`noteOff`/`uiNoteOn`/`panic`
from `App.tsx`, `useWebMidi`, `useComputerKeyboard`, `Lcd`/`PatchStrip`,
`PatchPicker` (without downloads/offline pill), `MidiStatus`, `MidiPanel`,
`LoadingOverlay`, `LoadErrorToast`, the power-on gesture overlay.

The note/engine wiring currently lives inside `App.tsx`. The builder should
extract it into a hook (e.g. `useSoundEngine`) used by both `App` and
`SoundModule`, rather than duplicating it.

### Sample loading without offline

- `loggedStorage.ts` resolves local `/smplr-samples/…` → alt format → Cache
  API → CDN. The embed needs a **CDN-only mode**: no `/smplr-samples`
  rewrite, no Cache API reads/writes. Expose it as a module-level config set
  by `SoundModule` before the engine starts (e.g. `configureSampleSource({
  mode: 'cdn' })`); the app keeps today's behaviour by default.
- CDN hosts the browser will fetch from: `smpldsnds.github.io`,
  `gleitz.github.io`, `goldst.dev`.
- CST patches: `source.baseUrl` values like `/patches/sine-key/` are resolved
  against `assetBaseUrl`. The package ships the `public/patches/**` audio
  (1.3 MB) in its `dist`, and **becreative copies it into its own
  `public/patches/`** (sync script or build step), so it loads same-origin
  with no CORS or change to the module's server *(my call from options
  offered; user didn't object)*. When `assetBaseUrl` is unset, CST patches are
  filtered out of the catalog in the embed.
- `AudioEngine.ts:136-140` (console.warn override): must not run in the embed,
  or must be scoped/restored on unmount.

### Styling

- Build CSS with the `build-css.mjs` approach, root class `.sound-module`:
  every rule scoped with `:where(.sound-module, .sound-module *)`, no
  preflight outside the root, `--tw-*` → `--sm-tw-*`.
- `src/index.css` is split: tokens and component classes (`hw-btn`, LCD,
  LEDs, rail, knob, keyframes) move to a shared file used by both builds;
  `html, body, #root`, `body` and global `button` rules stay app-only.
- `:root` / `:root[data-theme="light"]` variables become
  `.sound-module` / `.sound-module[data-theme="light"]` in the embed build.
- `@theme` font/colour tokens must not redefine the host's `--font-mono`
  etc.; in the embed they're renamed or scoped.
- Generic class names that could clash (`.fade-in`, `.pop-in`, `.legend`,
  `.rack-panel`, `.hw-btn`, `.cell-hit`) are prefixed or only exist under the
  scoped selector.
- Theme comes from the `theme` prop and is written to the root element only.
  `useTheme`/`applyStoredTheme` are not imported by the embed.

### Layout and overlays

- Root is `position: relative`, `width: 100%`, height determined by content
  (no `100dvh`/`min-h-screen`).
- `PatchPicker`, `MidiPanel`, `LoadingOverlay`, the gesture overlay and toasts
  render **inside the root** (`absolute inset-0`), not `fixed inset-0` over
  the page. Give the root a minimum height large enough for `MidiPanel` to be
  usable, or let those panels scroll internally — builder's call.
- No z-index above the host's chrome; the embed's own stacking stays within
  its root (use `isolation: isolate`).

### Focus and the computer keyboard

- Keys only play while the module is **armed**: the root (or something inside
  it) has focus. Clicking/tapping anywhere in the module focuses the root.
- Text inputs inside the module (patch picker search) still don't play notes.
- On losing focus: release **only notes held from the computer keyboard**
  (a keyboard-specific release, not the global `panic()`).
- **MIDI and breath input are not gated by focus** *(my call)*: a wind or
  MIDI player clicking page text or scrolling mid-phrase must not be cut off,
  and a connected controller plays whether or not the module is focused.
- A visible indicator shows when keys are live ("⌨ keys on") so learners know
  why typing does or doesn't play.
- The `/` shortcut for the patch picker is dropped in the embed.
- `isModalOpen()` currently checks the whole document for
  `[aria-modal="true"]`; in the embed it should check within the root, so a
  host-page dialog doesn't disable the module and vice versa.

### On-screen piano letter labels

- Export the key→semitone map from `useComputerKeyboard.ts` and derive the
  inverse (semitone→letter).
- `TouchKeyboard` gets an opt-in `keyLabels` prop. When on, key at
  `startMidi + n` shows the letter for semitone `n` (n = 0…17), upper-cased
  (`;` and `'` as-is). Keys beyond the computer keyboard's range show none.
- `startMidi` already follows the store's `octave`, so labels move with Z/X.
- Labels always on in the embed; the standalone app is unchanged unless the
  builder wants to enable them there too.
- Label text uses the module's existing type styles, legible on both white
  and black keys.

### State and persistence

- The embed persists only: current patch id, octave, velocity
  (`module:state:v1` subset) and the MIDI profile/enabled keys
  (`module:midi-map:v1`, `module:midi-enabled:v1`). Favourites may persist.
  It must not read/write `module:downloaded:v1`, `module:user-patches:v1` or
  `module:debug:v1`, and must not read `?debug=` from the host URL.
- Keys stay `module:*`; on becreative's origin they're unambiguous *(my call)*.
- Import-time online/offline listeners (`useStore.ts:513`) are PWA concerns
  and not included in the embed bundle.

### Lifecycle

- On unmount: panic, stop MIDI listeners, remove keyboard listeners, release
  the engine (close or suspend the AudioContext so a remount works).
- Audio unlock stays behind the existing tap-to-power-on gesture, scoped to
  the component.

### becreative integration

Work on a feature branch off becreative `master` (not the stale
`feat/play-me` worktree, which predates `security-headers.ts`).

- Dependency `@pepperhorn/sound-module`.
- **A reusable becreative component, used first on one page** (user):
  - `src/components/sound-module/SoundModuleEmbed.tsx` wraps `<SoundModule>`:
    imports `@pepperhorn/sound-module/styles.css` and `/fonts.css`, passes
    `assetBaseUrl=""`, and applies any becreative-specific CSS-variable
    overrides. It's the only place becreative touches the package, so any
    page can reuse it.
  - `src/components/sound-module/SoundModuleIsland.astro` renders
    `<SoundModuleEmbed client:only="react">` with a fallback slot and a
    `<noscript>`, mirroring `becreative-play-me/src/pages/play-me.astro`.
    Pages drop in `<SoundModuleIsland />`.
  - First use: `src/pages/sound-module.astro` — site layout, short intro, the
    island. Its own page, alongside the unmerged `feat/play-me` page, not
    replacing it (user).
- `security-headers.ts`: Permissions-Policy `midi=(self)` on paths listed in
  a single exported list (e.g. `MIDI_ENABLED_PATHS = ['/sound-module']`);
  everywhere else stays `midi=()`. Reusing the island on another page means
  adding that page's path to the list — documented next to the component.
- Report-only CSP: add `https://smpldsnds.github.io`,
  `https://gleitz.github.io`, `https://goldst.dev` to `connect-src` (and `media-src` if the engine needs it).
- Tests alongside becreative's existing header tests for the per-path
  Permissions-Policy.

### Release sequencing *(my call)*

Two milestones:
1. **Module repo:** library build, embed component, tests, and a release
   workflow mirroring `crf-react-music-tools/.github/workflows/release.yml`;
   tag `v0.1.0` → npm. Needs an npm token with publish rights to the
   `@pepperhorn` scope set as a repo secret — the user's step.
2. **becreative:** integrate against the published version. Development may
   use `link:` until then; the becreative PR merges only on the npm version.

## Verification

- Module repo: existing 17 test files still pass; new tests for letter-label
  mapping (incl. octave shift), focus gating (keys ignored when unfocused,
  panic on blur), CDN-only sample resolution, CST filtering without
  `assetBaseUrl`.
- A check on the built `styles.css` that no selector targets `html`, `body`,
  `:root`, bare elements, or unprefixed `--tw-*`.
- App: `npm run build` still produces the PWA and service worker.
- becreative: the page renders, plays from computer keyboard when focused and
  not when typing in the site header search; MIDI permission prompt appears;
  host fonts/buttons unchanged on the page and elsewhere; no service worker
  registered on `be.creativeranges.org`.

## Left to the builder

- Workspace package vs second build config in the root package.
- Exact header-strip layout within the rack look, and the minimum height.
- How `App.tsx` wiring is extracted into a shared hook.
- Whether letter labels also appear in the standalone app.
- Engine release strategy on unmount (close vs suspend and reuse).

## Open

- Nothing blocking. Publishing needs the user's npm token as a repo secret.
