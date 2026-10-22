# `@pepperhorn/sound-module` Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the module as `@pepperhorn/sound-module`, an npm package exporting a self-contained `<SoundModule />` React component (computer keyboard, MIDI and breath input, full patch list, labelled on-screen piano) that becreative can mount, while the standalone PWA keeps working exactly as it does now.

**Architecture:** The library sources live in the existing `src/` tree (`src/embed/`). They are built by a second Vite config, plus a scoped-CSS script, into a sub-package directory `packages/sound-module/`. That directory is a publishable package, not an npm workspace, and the root `package.json` stays the app's. The note and engine wiring in `App.tsx` moves into a shared `useSoundEngine` hook. Embed-specific behaviour comes from runtime switches that default to today's app behaviour: CDN-only sample loading, a store persistence scope, a store hydration step that only the app runs, focus-scoped keyboard listening, and overlays drawn inside the component's root.

**Tech Stack:** React 19, TypeScript 5.7, Vite 8 (library mode), Tailwind v4 (`@tailwindcss/cli`) plus PostCSS and `postcss-selector-parser`, zustand 5, smplr 0.20, Vitest 3 with jsdom and Testing Library, GitHub Actions, npm.

**Spec:** `docs/superpowers/specs/2026-10-22-embeddable-sound-module-design.md`. This plan covers milestone 1 (the module repo) only. becreative integration is a separate plan.

## Global Constraints

- Package name `@pepperhorn/sound-module`, version `0.1.0`, ESM only, `minify: false`, `publicDir: false`. External: `react`, `react-dom`, `react/jsx-runtime`, `react-dom/client`, plus the runtime dependencies `smplr` and `zustand`. Peer deps `react`/`react-dom` `^18.0.0 || ^19.0.0`. `sideEffects: ["*.css"]`. `exports` includes `./styles.css` and the opt-in `./fonts.css`.
- CSS scoping follows `/home/shaun/crf-react-music-tools/scripts/build-css.mjs`. The root class is `.sound-module`, every rule is scoped with `:where(.sound-module, .sound-module *)`, `--tw-*` becomes `--sm-tw-*`, and `rem` becomes `px` at 1rem = 16px.
- Standalone app: `npm run dev`, `npm run build` (which still emits `dist/sw.js` and `dist/manifest.webmanifest`, as checked by `.github/workflows/ci.yml`) and `npm run preview` behave as they do today. The app's built CSS is byte-identical after the stylesheet split.
- No offline machinery in the embed: no service worker, no `virtual:pwa-register`, no `virtual:vendored-samples`, no warm-up, no Cache API (`module-cdn-v1`), and no downloaded state or offline pill.
- The embed may write only the `module:state:v1` subset `{currentPatchId, octave, velocity}`, plus `module:midi-map:v1`, `module:midi-enabled:v1` and `module:favourites:v1`. It never reads or writes `module:downloaded:v1`, `module:user-patches:v1` or `module:debug:v1`, and it never reads `?debug=` from the host URL.
- CDN sample hosts, fetched directly in the embed: `smpldsnds.github.io`, `gleitz.github.io`, `goldst.dev`.
- One `<SoundModule>` per page, because the zustand store and `getEngine()` are singletons.
- Importing the embed's module graph adds no `window`/`document` listeners and does not mutate `<html>`. `useTheme` and `applyStoredTheme` are never imported by the embed.
- MIDI and breath input are never gated by focus. Only the computer keyboard is.
- Every new element carries a contextual semantic class name alongside its Tailwind utilities. New embed elements use the `sm-` prefix (`sm-root`, `sm-status-row`, `sm-keys-indicator`…), and the new key label is `touch-key-label`, matching the `touch-key-*` names in `TouchKeyboard.tsx`.
- Note-letter labels on the piano use the module's existing key-label type style (`font-mono text-[10px] uppercase`, as in `src/components/TouchKeyboard.tsx:221`). They do not use the global Poppins/SVG note-text style.
- Test command: `npx vitest run <file>`. All 17 existing test files keep passing (`npm test`).
- Package manager: npm (`package-lock.json`). Do not introduce pnpm.

## Review Focus

These are the conditions the spec implies but does not spell out, most likely to bite first. Each one is pinned by a test in the task named.

1. **Global `@keyframes` names collide with the host.** `fade-in`, `pop-in`, `spin`, `led-pulse` and `lcd-cursor-blink` are page-global, and scoping selectors does not scope keyframes. If they are left unchanged, the module's `@keyframes fade-in` replaces becreative's. Every keyframe is renamed `sm-*`, along with every `animation` that references it. Test in Task 10.
2. **Octave change while a key is held (hold `A`, press `X`, release `A`).** Today `keyup` recomputes the MIDI note from the *current* octave (`useComputerKeyboard.ts:95`), so the note-off goes to the wrong pitch and the original note sticks. The fix records each held key's MIDI note at press time. Test in Task 4.
3. **Clicking the on-screen piano must arm the keyboard.** `TouchKeyboard`'s `onPointerDown` calls `preventDefault()` (`TouchKeyboard.tsx:153`), which stops focus from moving. The root therefore focuses itself in `onPointerDownCapture`. Test in Task 9.
4. **The persisted patch is no longer in the embed catalog.** If `module:state:v1` holds `custom/sine-key` and `assetBaseUrl` is unset, the LCD must fall back to the default patch rather than show a raw id or fail to load. Test in Task 8.
5. **Remount after unmount.** This covers React StrictMode's double effect in dev and Astro view transitions in production. A suspended engine must play again: either the power-on gesture shows again, or, when state survived a StrictMode remount, the engine resumes. It must not stay silent with no overlay. Test in Task 6.

## External contract (what becreative consumes)

These are fixed by this plan and verified by `packages/sound-module/scripts/verify-dist.mjs` (Task 11):

- **Component:** `import { SoundModule, type SoundModuleProps } from '@pepperhorn/sound-module'`
  ```ts
  interface SoundModuleProps {
    /** Base URL that serves /patches/**. becreative passes "". Omitted → CST patches hidden. */
    assetBaseUrl?: string
    /** Applied to the component root only. Default 'dark'. */
    theme?: 'dark' | 'light'
    /** On-screen piano octaves. Default 2 (25 keys). */
    octaves?: number
    className?: string
  }
  ```
  The package exports nothing else at runtime.
- **Styles:** `import '@pepperhorn/sound-module/styles.css'` is required. `import '@pepperhorn/sound-module/fonts.css'` is opt-in and contains the `@fontsource` imports for Michroma, Chakra Petch, Inter and JetBrains Mono.
- **Root element:** `<div class="sound-module sm-root …" data-theme="dark|light" tabindex="0">`. Hosts may override any token (`--color-*`, `--face-bg`, `--card-bg`, …) with a selector of specificity at least `(0,2,0)`, for example `.my-page .sound-module { --color-coral: … }`.
- **Patch audio:** shipped at `node_modules/@pepperhorn/sound-module/dist/patches/<folder>/<file>.wav` (today `poly-bass/` and `sine-key/`). becreative copies the *contents* of `dist/patches/` into its own `public/patches/`, so `/patches/sine-key/C4.wav` resolves same-origin when `assetBaseUrl=""`. The package directory can be located with `require.resolve('@pepperhorn/sound-module/package.json')`, because `./package.json` is exported. The files are also exported as `./patches/*`.
- **Runtime needs from the host:** the page must be rendered client-only (`client:only="react"`). It needs `connect-src` for `https://smpldsnds.github.io`, `https://gleitz.github.io` and `https://goldst.dev`, and `Permissions-Policy: midi=(self)` on pages that host it. Only one instance per page.
- **Storage keys used on the host origin:** `module:state:v1` (patch, octave and velocity only), `module:midi-map:v1`, `module:midi-enabled:v1`, `module:favourites:v1`, and `module:ui:v1` (read only, ignored).

## File structure

| Path | Responsibility |
|---|---|
| `src/state/useStore.ts` (modify) | Remove import-time reads of app-only keys and the import-time listeners. Add `hydrateAppState()` and `setPersistScope()`. |
| `src/main.tsx` (modify) | Call `hydrateAppState()` before render. |
| `src/audio/loggedStorage.ts` (modify) | Add `configureSampleSource({ mode })`. In `'cdn'` mode, skip `/smplr-samples` rewrites and the Cache API. |
| `src/audio/AudioEngine.ts` (modify) | Add `EngineOptions { consoleShim }`, `getEngine(options?)` and `suspend()`. |
| `src/input/useComputerKeyboard.ts` (modify) | Export the key map and `keyLabelForSemitone`. Add a `target` option for focus-scoped mode, `armed`, held-note MIDI capture, and a scoped `isModalOpen`. |
| `src/components/TouchKeyboard.tsx` (modify) | Add the `keyLabels` prop. |
| `src/state/useSoundEngine.ts` (create) | Engine and store wiring extracted from `App.tsx`. Shared by `App` and `SoundModule`. |
| `src/components/LiveTouchKeyboard.tsx` (create) | Moved from `App.tsx:745-752`, with `keyLabels` and `octaves` passed through. |
| `src/components/PowerOnOverlay.tsx` (create) | The gesture overlay moved from `App.tsx:395-427`, with a `contained` prop. |
| `src/components/{PatchPicker,PatchCard,MidiPanel,LoadingOverlay}.tsx` (modify) | Add the `contained` prop. The picker and card get `offlineFeatures`. |
| `src/App.tsx` (modify) | Consumes `useSoundEngine`, `PowerOnOverlay` and `LiveTouchKeyboard`. No behaviour change. |
| `src/embed/catalog.ts` (create) | `embedCatalog()` (filters CST or rewrites base URLs) and `configureEmbed()`. |
| `src/embed/SoundModule.tsx` (create) | The component. |
| `src/embed/index.ts` (create) | Library entry. |
| `src/styles/{theme,materials,components}.css` (create) | Split out of `src/index.css` and shared by both builds. |
| `src/embed/styles/{tailwind,base,fonts}.css` (create) | Embed stylesheet inputs. |
| `src/test/fakeEngine.ts` (create) | A test double for `AudioEngine`, used by Tasks 6 and 9. |
| `packages/sound-module/` (create) | `package.json`, `vite.config.ts`, `tsconfig.build.json`, `README.md`, and `scripts/{build-css,copy-patches,verify-dist}.mjs` (+ `build-css.d.mts`). |
| `.github/workflows/release.yml` (create), `.github/workflows/ci.yml` (modify) | Publish on a `v*` tag. CI also builds the library. |

---

### Task 1: Store — app-only hydration and persistence scope

**Files:**
- Modify: `src/state/useStore.ts:259-345` (initial values), `:279-293` (`persist`), `:512-515` (listeners)
- Modify: `src/main.tsx:22-23`
- Test: `src/state/useStore.persistence.test.ts` (create)

**Interfaces:**
- Produces: `export function hydrateAppState(): void`. It loads `downloaded`, `userPatches` and `debugMode` (including the `?debug=` handling in `loadDebug`, `useStore.ts:150-167`) into the store, and installs the `online`/`offline` window listeners once. It is idempotent.
- Produces: `export type PersistScope = 'app' | 'embed'` and `export function setPersistScope(scope: PersistScope): void`. The default is `'app'`. With `'embed'`, `persist()` writes only `{ currentPatchId, octave, velocity }`.
- The initial store values become `downloaded: new Set()`, `userPatches: []` and `debugMode: false`. Everything else is unchanged, including `loadPersisted`, `loadFavourites` and `loadUi`.

- [ ] **Step 1: Write the failing tests**

Each test calls `vi.resetModules()`, clears `localStorage` and does `const m = await import('./useStore')` so it sees a fresh module.

```ts
it('importing the store reads none of the app-only keys, even with ?debug=1', async () => {
  window.history.replaceState({}, '', '/?debug=1')
  const getItem = vi.spyOn(Storage.prototype, 'getItem')
  const m = await import('./useStore')
  const read = getItem.mock.calls.map((c) => c[0])
  expect(read).not.toContain('module:downloaded:v1')
  expect(read).not.toContain('module:user-patches:v1')
  expect(read).not.toContain('module:debug:v1')
  expect(m.useStore.getState().debugMode).toBe(false)
  expect(localStorage.getItem('module:debug:v1')).toBeNull()
})

it('importing the store installs no online/offline listeners', async () => {
  const add = vi.spyOn(window, 'addEventListener')
  await import('./useStore')
  expect(add.mock.calls.map((c) => c[0])).not.toContain('online')
  expect(add.mock.calls.map((c) => c[0])).not.toContain('offline')
})

it('hydrateAppState restores downloaded, user patches, debug and listeners', async () => {
  localStorage.setItem('module:downloaded:v1', JSON.stringify(['ep/x']))
  localStorage.setItem('module:user-patches:v1', JSON.stringify([{ id: 'usr/a', name: 'A', basePatchId: 'ep/wurlitzerep200', color: 'sky', fxEnabled: {}, fxParams: {}, createdAt: 1 }]))
  window.history.replaceState({}, '', '/?debug=1')
  const add = vi.spyOn(window, 'addEventListener')
  const m = await import('./useStore')
  m.hydrateAppState()
  const s = m.useStore.getState()
  expect(s.downloaded.has('ep/x')).toBe(true)
  expect(s.userPatches).toHaveLength(1)
  expect(s.debugMode).toBe(true)
  expect(add.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['online', 'offline']))
})

it('embed scope persists only patch, octave and velocity', async () => {
  const m = await import('./useStore')
  m.setPersistScope('embed')
  m.useStore.getState().setOctave(5)
  expect(Object.keys(JSON.parse(localStorage.getItem('module:state:v1')!)).sort())
    .toEqual(['currentPatchId', 'octave', 'velocity'])
})

it('app scope still persists the fx state', async () => {
  const m = await import('./useStore')
  m.useStore.getState().setOctave(5)
  expect(JSON.parse(localStorage.getItem('module:state:v1')!)).toHaveProperty('fxEnabled')
})
```

Restore the URL with `replaceState({}, '', '/')` and call `vi.restoreAllMocks()` in `afterEach`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/state/useStore.persistence.test.ts`
Expected: FAIL (`hydrateAppState` is not a function, and the key reads are present).

- [ ] **Step 3: Implement it.** Move the three loads and the two listeners (`useStore.ts:512-515`) into `hydrateAppState()`, guarded by a module-level `let hydrated = false`. Add a module-level `let persistScope: PersistScope = 'app'`, and have `persist()` branch on it. In `src/main.tsx`, call `hydrateAppState()` right after `applyStoredTheme()` (line 23), before `createRoot`. `App` then sees the same initial state as today.

- [ ] **Step 4: Run the tests and confirm they pass, then run the full suite**

Run: `npx vitest run src/state/useStore.persistence.test.ts && npm test`
Expected: PASS. All 17 existing files are still green.

- [ ] **Step 5: Commit**

```bash
git add src/state/useStore.ts src/state/useStore.persistence.test.ts src/main.tsx
git commit -m "refactor(store): app-only hydration step and embed persistence scope"
```

---

### Task 2: CDN-only sample source

**Files:**
- Modify: `src/audio/loggedStorage.ts:86-90, 124-171, 196-316`
- Test: `src/audio/loggedStorage.test.ts` (append a `describe`)

**Interfaces:**
- Produces: `export type SampleSourceMode = 'app' | 'cdn'`, `export function configureSampleSource(config: { mode: SampleSourceMode }): void` and `export function getSampleSourceMode(): SampleSourceMode`. The default is `'app'`, which is today's cascade.
- In `'cdn'` mode, `createLoggedStorage().fetch` does three things differently. It skips `rewriteToLocal` and the alternate-format retry. `tryCache`, `putCache` and `openCache` are never called, for CDN URLs or for same-origin bundled ones. Same-origin URLs are fetched once and counted `bySource.local`, and CDN URLs are fetched once and counted `bySource.cdn`.

- [ ] **Step 1: Write the failing tests** in `describe('CDN-only sample source', …)`. Stub `fetch` to return `new Response(new Uint8Array(4), { headers: { 'content-type': 'audio/ogg' } })`, stub `caches` with `open: vi.fn()`, and run `afterEach(() => configureSampleSource({ mode: 'app' }))`.

```ts
it('fetches CDN urls directly, never from /smplr-samples', async () => {
  configureSampleSource({ mode: 'cdn' })
  await createLoggedStorage().fetch('https://smpldsnds.github.io/a/b.ogg')
  expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['https://smpldsnds.github.io/a/b.ogg'])
})
it('never opens the Cache API for CDN or bundled urls', async () => {
  configureSampleSource({ mode: 'cdn' })
  const s = createLoggedStorage()
  await s.fetch('https://gleitz.github.io/x.mp3')
  await s.fetch('/patches/sine-key/C4.wav')
  expect(cachesOpen).not.toHaveBeenCalled()
  expect(s.snapshot().bySource).toMatchObject({ cdn: 1, local: 1, cache: 0, localAlt: 0 })
})
it('app mode keeps the local-first cascade', async () => {
  await createLoggedStorage().fetch('https://smpldsnds.github.io/a/b.ogg')
  expect(fetchMock.mock.calls[0][0]).toBe('/smplr-samples/smpldsnds/a/b.ogg')
})
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/audio/loggedStorage.test.ts`. Expected: FAIL (`configureSampleSource` is not exported).

- [ ] **Step 3: Implement it.** Add a module-level `let sourceMode: SampleSourceMode = 'app'`. Make `tryCache` and `putCache` return early when it is `'cdn'`, and bypass the local tiers in `fetch`. Update the header comment at lines 4-8 to describe the cdn mode.

- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/audio/loggedStorage.test.ts`. Expected: PASS, with the existing caching tests unchanged.

- [ ] **Step 5: Commit.** `git add src/audio/loggedStorage.ts src/audio/loggedStorage.test.ts && git commit -m "feat(audio): CDN-only sample source mode for the embed"`

---

### Task 3: Engine options — console shim opt-out and suspend

**Files:**
- Modify: `src/audio/AudioEngine.ts:133-173` (shim), `:270-282` (constructor), `:1036-1040` (`getEngine`)
- Test: `src/audio/AudioEngine.test.ts` (create)

**Interfaces:**
- Produces: `export interface EngineOptions { /** Patch console.warn to surface smplr decode failures. Default true. */ consoleShim?: boolean }`
- Produces: `constructor(options: EngineOptions = {})`. It calls `installConsoleShim()` only when `options.consoleShim !== false`.
- Produces: `export function getEngine(options?: EngineOptions): AudioEngine`. Options apply only when the singleton is first created.
- Produces: `async suspend(): Promise<void>`. It calls `this.stopPreview()` and `this.panic()`, then `await this.context.suspend()`, swallowing any error. The chain and the instrument cache are kept, so a later `resume()` plays again.

- [ ] **Step 1: Write the failing tests.** Stub `AudioContext` with `vi.stubGlobal` as a class with `state = 'suspended'`, `sampleRate = 48000`, `baseLatency = 0`, `decodeAudioData = vi.fn()`, `suspend = vi.fn(async () => {})` and `resume = vi.fn(async () => {})`. Use `vi.resetModules()` plus a dynamic import per test, because `_consoleShimInstalled` is module state.

```ts
it('leaves console.warn alone when consoleShim is false', async () => {
  const before = console.warn
  const { AudioEngine } = await import('./AudioEngine')
  new AudioEngine({ consoleShim: false })
  expect(console.warn).toBe(before)
})
it('installs the console shim by default', async () => {
  const before = console.warn
  const { AudioEngine } = await import('./AudioEngine')
  new AudioEngine()
  expect(console.warn).not.toBe(before)
  console.warn = before
})
it('getEngine applies options only on first creation', async () => {
  const before = console.warn
  const { getEngine } = await import('./AudioEngine')
  const a = getEngine({ consoleShim: false })
  expect(getEngine()).toBe(a)
  expect(console.warn).toBe(before)
})
it('suspend() suspends the context', async () => {
  const { AudioEngine } = await import('./AudioEngine')
  const e = new AudioEngine({ consoleShim: false })
  await e.suspend()
  expect((e.context as unknown as { suspend: Mock }).suspend).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/audio/AudioEngine.test.ts`. Expected: FAIL (the constructor ignores its options, and `suspend` is not a function).
- [ ] **Step 3: Implement it** as described in the Interfaces block.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/audio/AudioEngine.test.ts && npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(audio): engine options (console shim opt-out) and suspend()"`. Add the new test file first.

---

### Task 4: Computer keyboard — letter map, focus-scoped mode, held-note fix

**Files:**
- Modify: `src/input/useComputerKeyboard.ts` (whole file, 111 lines)
- Test: `src/input/useComputerKeyboard.test.tsx` (append)

**Interfaces:**
- Produces: `export const KEY_TO_SEMITONE: Readonly<Record<string, number>>`. This is the existing map from lines 4-24, now exported.
- Produces: `export function keyLabelForSemitone(n: number): string | null`. It returns the key for semitone `n` (0…17), upper-cased (`'A'`, `'W'`, …), with `;` and `'` returned unchanged. It returns `null` outside 0…17.
- Produces: `export function isModalOpen(scope?: ParentNode | null): boolean`. With a `scope`, it looks for `[aria-modal="true"]` only inside the scope. Without one, it behaves as it does today.
- Produces: `export interface ComputerKeyboardOptions { /** Focus-scoped mode: listen on this element only; keys play only while focus is inside it. */ target?: RefObject<HTMLElement | null> }`
- Produces: `export function useComputerKeyboard(callbacks: KeyboardCallbacks, options?: ComputerKeyboardOptions): { armed: boolean }`
  - **Without `target`**, it behaves as it does today. It listens on `window`, a window `blur` calls `panic()`, and it always returns `armed: true`.
  - **With `target`**, `keydown` and `keyup` are listened for on `target.current`. Focus leaving the target (`focusout` whose `relatedTarget` is outside it) and a window `blur` both release only the keys this hook holds. Each held key gets `noteOff` with its recorded MIDI note, and `panic()` is *not* called. `armed` is `target.contains(document.activeElement)` and is updated on `focusin` and `focusout`. Modal checks use `isModalOpen(target.current)`. `Escape` still calls `panic()`.
  - **In both modes**, `heldRef` becomes `Map<string, number>` (key → MIDI note at press time). `keyup` releases the recorded note.

- [ ] **Step 1: Write the failing tests.** Use a `Harness` that renders `<div data-testid="root" tabIndex={0} ref={ref}><input data-testid="inner" /></div><input data-testid="outside" />` and calls the hook with `{ target: ref }`. Set `useStore.setState({ octave: 4, velocity: 100 })` in `beforeEach`.

```ts
it('maps semitones to upper-cased letters', () => {
  expect(keyLabelForSemitone(0)).toBe('A'); expect(keyLabelForSemitone(1)).toBe('W')
  expect(keyLabelForSemitone(16)).toBe(';'); expect(keyLabelForSemitone(17)).toBe("'")
  expect(keyLabelForSemitone(18)).toBeNull(); expect(keyLabelForSemitone(-1)).toBeNull()
})
it('scoped: keys typed outside the root do nothing', () => {
  outside.focus(); fireEvent.keyDown(outside, { key: 'a' })
  expect(noteOn).not.toHaveBeenCalled()
})
it('scoped: plays while the root has focus', () => {
  root.focus(); fireEvent.keyDown(root, { key: 'a' })
  expect(noteOn).toHaveBeenCalledWith(60, 100)
})
it('scoped: text input inside the root does not play', () => {
  inner.focus(); fireEvent.keyDown(inner, { key: 'a' })
  expect(noteOn).not.toHaveBeenCalled()
})
it('scoped: focus leaving releases only keyboard-held notes, without panic', () => {
  root.focus(); fireEvent.keyDown(root, { key: 'a' }); fireEvent.keyDown(root, { key: 'w' })
  fireEvent.focusOut(root, { relatedTarget: outside })
  expect(noteOff.mock.calls.map((c) => c[0]).sort()).toEqual([60, 61])
  expect(panic).not.toHaveBeenCalled()
})
it('scoped: a host-page aria-modal does not disable the keys', () => {
  render(<div role="dialog" aria-modal="true" />)   // outside the root
  root.focus(); fireEvent.keyDown(root, { key: 'a' })
  expect(noteOn).toHaveBeenCalled()
})
it('scoped: an aria-modal inside the root does disable them', () => { /* modal rendered inside root */ })
it('scoped: armed follows focus', () => {
  expect(result.armed).toBe(false); act(() => root.focus()); expect(result.armed).toBe(true)
})
it('releases the pitch that sounded after an octave shift mid-hold', () => {
  // window mode (existing API)
  fireEvent.keyDown(window, { key: 'a' }); fireEvent.keyDown(window, { key: 'x' })
  fireEvent.keyUp(window, { key: 'a' })
  expect(noteOff).toHaveBeenCalledWith(60)
})
```

The existing two tests (lines 7-25) stay as they are.

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/input/useComputerKeyboard.test.tsx`. Expected: FAIL. The new exports are missing, and the octave test gets `noteOff(72)`.
- [ ] **Step 3: Implement it** as described in the Interfaces block. Build `SEMITONE_TO_KEY` once from `KEY_TO_SEMITONE`.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/input/useComputerKeyboard.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(input): focus-scoped computer keyboard, letter map, held-note fix"` (after `git add` of both files).

---

### Task 5: TouchKeyboard letter labels

**Files:**
- Modify: `src/components/TouchKeyboard.tsx:4-16` (props), `:215-273` (key render)
- Test: `src/components/TouchKeyboard.test.tsx` (append)

**Interfaces:**
- Consumes: `keyLabelForSemitone(n)` from Task 4.
- Produces: the `keyLabels?: boolean` prop (default `false`). When it is on, the key at `startMidi + n` (`startMidi = (octave + 1) * 12`, line 79) renders `<span className="touch-key-label …">{keyLabelForSemitone(n)}</span>` for `n` in 0…17. No other key gets a label span. White keys show the label above the existing C-octave label (they are already `flex-col justify-end`). Black keys show it near their bottom edge. The styling is `touch-key-label pointer-events-none font-mono text-[10px] uppercase`. The colour is `rgba(20,30,60,0.55)` on white keys, `rgba(255,255,255,0.75)` on black keys, and `rgba(255,255,255,0.9)` when pressed. The span sits inside the `data-midi` element, so `midiFromTarget` still resolves.

- [ ] **Step 1: Write the failing tests**

```ts
const label = (c: HTMLElement, midi: number) =>
  c.querySelector(`[data-midi="${midi}"] .touch-key-label`)?.textContent ?? null
it('labels the playable keys with their computer-keyboard letters', () => {
  useStore.setState({ octave: 4 })
  const { container } = render(<TouchKeyboard noteOn={noop} noteOff={noop} keyLabels />)
  expect(label(container, 60)).toBe('A'); expect(label(container, 61)).toBe('W')
  expect(label(container, 76)).toBe(';'); expect(label(container, 77)).toBe("'")
  expect(label(container, 78)).toBeNull()
  expect(container.querySelectorAll('.touch-key-label')).toHaveLength(18)
})
it('labels follow the octave', () => {
  useStore.setState({ octave: 3 })
  const { container } = render(<TouchKeyboard noteOn={noop} noteOff={noop} keyLabels />)
  expect(label(container, 48)).toBe('A'); expect(label(container, 60)).toBe('K')
})
it('shows no labels by default', () => {
  const { container } = render(<TouchKeyboard noteOn={noop} noteOff={noop} />)
  expect(container.querySelectorAll('.touch-key-label')).toHaveLength(0)
})
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/components/TouchKeyboard.test.tsx`. Expected: FAIL (0 labels).
- [ ] **Step 3: Implement the prop** as described in the Interfaces block.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/components/TouchKeyboard.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(keyboard): opt-in computer-keyboard letter labels on the piano"`

---

### Task 6: Extract `useSoundEngine` from `App.tsx`

**Files:**
- Create: `src/state/useSoundEngine.ts`, `src/components/LiveTouchKeyboard.tsx`, `src/components/PowerOnOverlay.tsx`, `src/test/fakeEngine.ts`
- Modify: `src/App.tsx`. Remove lines 34-99, 101-346, 349 and 365-386 (moved into the hook), lines 395-427 (now `PowerOnOverlay`) and lines 745-752 (now `LiveTouchKeyboard`). Keep `useUserPatchSync` (32), `useComputerKeyboard` (347), `useWakeLock` (348), the `/` hotkey (351-363), `openPicker` (388-391) and both layouts.
- Modify: `tsconfig.json` (add `"src/test"` to `exclude`)
- Test: `src/state/useSoundEngine.test.tsx` (create)

**Interfaces:**
- Consumes: `getEngine(options?)`, `EngineOptions` and `engine.suspend()` from Task 3.
- Produces: `src/state/useSoundEngine.ts`
  ```ts
  export interface SoundEngineOptions {
    trackOffline?: boolean        // default true. When false, markOfflineReady is a no-op (embed).
    engineOptions?: EngineOptions // forwarded to getEngine()
    suspendOnUnmount?: boolean    // default false. When true: cleanup → panic() + engine.suspend();
                                  // re-run with needsGesture already false → engine.resume()
  }
  export interface SoundEngineApi {
    engine: AudioEngine; fullCatalog: PatchManifest[]
    displayPatch: PatchManifest | undefined; displayIndex: number; isLoading: boolean
    activeBank: Bank; currentBankPatches: PatchManifest[]; needsGesture: boolean
    ensureAudio(): Promise<void>; selectPatch(p: PatchManifest): void; selectPatchId(id: string): void
    previewPatchById(id: string): void; downloadPatchById(id: string): void
    handleStep(delta: number): void; handleBankSelect(bank: Bank): void
    noteOn(midi: number, vel: number): void; noteOff(midi: number): void
    uiNoteOn(midi: number, vel: number): void; panic(): void; getLatency(): LatencyInfo
  }
  export function useSoundEngine(options?: SoundEngineOptions): SoundEngineApi
  ```
  The bodies are the moved `App.tsx` code, unchanged apart from the three options.
- Produces: `LiveTouchKeyboard(props: { noteOn; noteOff; fill?: boolean; keyLabels?: boolean; octaves?: number })`
- Produces: `PowerOnOverlay(props: { onPowerOn: () => void; contained?: boolean })`. It has the same markup and copy as `App.tsx:396-426`. `contained` swaps `fixed inset-0` for `absolute inset-0`.
- Produces: `src/test/fakeEngine.ts`, with `export function makeFakeEngine(): FakeEngine`. Every `AudioEngine` method the hook calls is a `vi.fn`: `resume`, `suspend`, `loadPatch` and `previewPatch` resolve, `preloadPatch` resolves `{ ok: true, failed: [] }`, and the object has `loadedPatchId: null`, `context: { state: 'running' }` and `latencyInfo: () => ({ baseLatencyMs: 0, outputLatencyMs: null })`. The `on*` callback fields are assignable.

- [ ] **Step 1: Write the failing tests.** Start the file with `vi.mock('../audio/AudioEngine', () => ({ getEngine: () => fake }))`.

```ts
it('uiNoteOn lifts breath before playing', () => {
  const { result } = renderHook(() => useSoundEngine())
  act(() => result.current.uiNoteOn(60, 100))
  expect(fake.liftBreath.mock.invocationCallOrder[0]).toBeLessThan(fake.noteOn.mock.invocationCallOrder[0])
  expect(fake.noteOn).toHaveBeenCalledWith(60, 100)
})
it('trackOffline false never marks a clean load downloaded', () => {
  renderHook(() => useSoundEngine({ trackOffline: false }))
  act(() => fake.onLoaded!('ep/wurlitzerep200', { source: tag, offlineReady: true }))
  expect(useStore.getState().downloaded.has('ep/wurlitzerep200')).toBe(false)
})
it('default trackOffline marks it', () => { /* same, expect true */ })
it('suspendOnUnmount: unmount panics and suspends', () => {
  const { unmount } = renderHook(() => useSoundEngine({ suspendOnUnmount: true }))
  unmount()
  expect(fake.panic).toHaveBeenCalled(); expect(fake.suspend).toHaveBeenCalledOnce()
})
it('without suspendOnUnmount, unmount leaves the engine running', () => { /* expect suspend not called */ })
it('StrictMode remount after power-on resumes the engine', async () => {
  const { result } = renderHook(() => useSoundEngine({ suspendOnUnmount: true }), { wrapper: StrictMode })
  await act(() => result.current.ensureAudio())
  // StrictMode replays effects on mount; after power-on the re-run must resume
  expect(fake.resume.mock.calls.length).toBeGreaterThanOrEqual(1)
  expect(result.current.needsGesture).toBe(false)
})
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/state/useSoundEngine.test.tsx`. Expected: FAIL (the module is not found).
- [ ] **Step 3: Implement the hook, the two components and the fake.** Then rewire `App.tsx` so that its JSX reads every value from `const s = useSoundEngine()`.
- [ ] **Step 4: Verify the app is unchanged.** Run `npx vitest run src/state/useSoundEngine.test.tsx && npm test && npm run typecheck && npm run build`. Expected: all PASS, and `dist/sw.js` and `dist/manifest.webmanifest` exist. Then manually run `npm run dev -- --host 0.0.0.0` and check: power-on, play `A`, `Z`/`X`, prev/next, browse, keyboard mode and the MIDI panel all work as before.
- [ ] **Step 5: Commit.** `git commit -m "refactor: extract useSoundEngine, PowerOnOverlay and LiveTouchKeyboard from App"`

---

### Task 7: Contained overlays and a picker without offline features

**Files:**
- Modify: `src/components/PatchPicker.tsx:7-15, 86, 108-130, 186-229`, `src/components/PatchCard.tsx:3-17, 120-130`, `src/components/MidiPanel.tsx:21-24, 92, 104`, `src/components/LoadingOverlay.tsx:4, 25, 30`
- Test: `src/components/containedOverlays.test.tsx` (create)

**Interfaces:**
- Produces: a `contained?: boolean` prop (default `false`) on `PatchPicker`, `MidiPanel` and `LoadingOverlay`. Their outer `fixed inset-0` becomes `absolute inset-0`. Inside, `MidiPanel`'s `max-h-[92dvh]` becomes `max-h-full`, and `LoadingOverlay`'s card width uses `w-[min(420px,calc(100%-2rem))]`. The z-index values stay the same, because the embed root isolates stacking.
- Produces: `PatchPicker` gets `offlineFeatures?: boolean` (default `true`), and `onDownload` becomes optional. With `false`, the offline pill (lines 108-130) is not rendered, `unavailableOffline` is always `false`, and `PatchCard` receives `showDownload={false}`.
- Produces: `PatchCard` gets `showDownload?: boolean` (default `true`), and `onDownload` becomes optional. With `false`, `DownloadButton` (`.patch-card-dl`) is not rendered.

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  ['PatchPicker', () => { useStore.setState({ pickerOpen: true }); return <PatchPicker contained onSelect={noop} onPreview={noop} /> }, '.patch-picker'],
  ['MidiPanel', () => { useStore.setState({ midiPanelOpen: true }); return <MidiPanel contained /> }, '.midi-panel-scrim'],
  ['LoadingOverlay', () => { useStore.setState({ loadingPatchId: 'ep/wurlitzerep200' }); return <LoadingOverlay contained /> }, '.loading-overlay'],
  ['PowerOnOverlay', () => <PowerOnOverlay contained onPowerOn={noop} />, '.gesture-overlay'],
])('%s contained renders absolute, not fixed', (_n, el, sel) => {
  const cls = render(el()).container.querySelector(sel)!.className
  expect(cls).toMatch(/\babsolute\b/); expect(cls).not.toMatch(/\bfixed\b/)
})
it('overlays stay fixed by default (app unchanged)', () => { /* same four without contained → /\bfixed\b/ */ })
it('picker without offline features shows no download buttons or offline pill', () => {
  useStore.setState({ pickerOpen: true, online: false })
  const { container } = render(<PatchPicker offlineFeatures={false} onSelect={noop} onPreview={noop} />)
  expect(container.querySelector('.patch-card-dl')).toBeNull()
  expect(container.querySelector('.patch-picker-offline-pill')).toBeNull()
  expect(container.querySelector('.patch-card-offline')).toBeNull()
})
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/components/containedOverlays.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the props** as described in the Interfaces block.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/components/containedOverlays.test.tsx && npm test`. Expected: PASS, with `MidiPanel.test.tsx` unchanged.
- [ ] **Step 5: Commit.** `git commit -m "feat(ui): contained overlay mode and picker without offline features"`

---

### Task 8: Embed catalog and configuration

**Files:**
- Create: `src/embed/catalog.ts`
- Test: `src/embed/catalog.test.ts`

**Interfaces:**
- Consumes: `configureSampleSource` (Task 2) and `setPersistScope` (Task 1).
- Produces: `export function embedCatalog(catalog: PatchManifest[], assetBaseUrl: string | undefined): PatchManifest[]`. When `assetBaseUrl === undefined`, it drops every `bank === 'CST'` entry. Otherwise it returns new manifests in which each `source.kind === 'sampler'` has `baseUrl = joinAssetUrl(assetBaseUrl, baseUrl)`. It never mutates its input.
- Produces: `export function joinAssetUrl(base: string, path: string): string`. Examples: `('', '/patches/a/') → '/patches/a/'`, `('https://x.test', '/patches/a/') → 'https://x.test/patches/a/'` and `('https://x.test/', '/patches/a/') → 'https://x.test/patches/a/'`.
- Produces: `export function configureEmbed(opts: { assetBaseUrl?: string }): void`. It calls `configureSampleSource({ mode: 'cdn' })` and `setPersistScope('embed')`, then sets `useStore` `catalog` to `embedCatalog(getCatalog(), opts.assetBaseUrl)`. If the store's `currentPatchId` is not in that catalog, it sets it to `'ep/wurlitzerep200'` (or `catalog[0].id`), mirroring `useStore.ts:261-264`.

- [ ] **Step 1: Write the failing tests**

```ts
it('hides CST patches when assetBaseUrl is undefined', () => {
  const all = getCatalog()
  const out = embedCatalog(all, undefined)
  expect(out.some((p) => p.bank === 'CST')).toBe(false)
  expect(out).toHaveLength(all.filter((p) => p.bank !== 'CST').length)
})
it('keeps same-origin paths for assetBaseUrl ""', () => {
  const sine = embedCatalog(getCatalog(), '').find((p) => p.id === 'custom/sine-key')!
  expect(sine.source).toMatchObject({ kind: 'sampler', baseUrl: '/patches/sine-key/' })
})
it.each(['https://cdn.example.com', 'https://cdn.example.com/'])('resolves against %s', (base) => {
  const sine = embedCatalog(getCatalog(), base).find((p) => p.id === 'custom/sine-key')!
  expect((sine.source as { baseUrl: string }).baseUrl).toBe('https://cdn.example.com/patches/sine-key/')
})
it('does not mutate the source catalog', () => {
  embedCatalog(getCatalog(), 'https://x.test')
  expect((findPatch('custom/sine-key')!.source as { baseUrl: string }).baseUrl).toBe('/patches/sine-key/')
})
it('configureEmbed falls back from a hidden persisted CST patch to the default', () => {
  useStore.setState({ currentPatchId: 'custom/sine-key' })
  configureEmbed({})
  expect(useStore.getState().currentPatchId).toBe('ep/wurlitzerep200')
  expect(getSampleSourceMode()).toBe('cdn')
})
```

Use `afterEach` to restore `configureSampleSource({ mode: 'app' })`, `setPersistScope('app')` and `useStore.setState({ catalog: getCatalog() })`.

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/embed/catalog.test.ts`. Expected: FAIL (the module is not found).
- [ ] **Step 3: Implement it** as described in the Interfaces block.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/embed/catalog.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(embed): embed catalog (CST filtering / asset base URL) and configureEmbed"`

---

### Task 9: `SoundModule` component and library entry

**Files:**
- Create: `src/embed/SoundModule.tsx`, `src/embed/index.ts`
- Test: `src/embed/SoundModule.test.tsx`, `src/embed/index.test.ts`

**Interfaces:**
- Consumes: `useSoundEngine({ trackOffline: false, engineOptions: { consoleShim: false }, suspendOnUnmount: true })` (Task 6). Also `useComputerKeyboard({ noteOn: uiNoteOn, noteOff, panic }, { target: rootRef })` (Task 4), `configureEmbed` (Task 8), `LiveTouchKeyboard` and `PowerOnOverlay` (Task 6), and the `contained` and `offlineFeatures` props (Task 7).
- Produces: `export function SoundModule(props: SoundModuleProps): JSX.Element` and `export interface SoundModuleProps`, exactly as in the External contract.
- Produces: `src/embed/index.ts`, with `export { SoundModule } from './SoundModule'; export type { SoundModuleProps } from './SoundModule'`.
- Composition: `configureEmbed({ assetBaseUrl })` runs in a `useLayoutEffect` keyed on `assetBaseUrl`. No fetch happens before the power-on gesture, so this runs before any load. The root is `<div ref={rootRef} className={\`sound-module sm-root relative isolate w-full min-h-[420px] overflow-hidden rounded-lg ${className ?? ''}\`} data-theme={theme ?? 'dark'} tabIndex={0} onPointerDownCapture={…} onClick={…}>`. The pointer-down handler calls `rootRef.current.focus({ preventScroll: true })` unless focus is already inside the root. The click handler calls `ensureAudio()` while `needsGesture` is true. The root contains, in order:
  1. `sm-body flex flex-col gap-3 p-3`, with `background: var(--face-bg)`.
  2. `PatchStrip`, which supplies the LCD, prev/next and browse via `handleStep` and `openPicker`.
  3. `sm-status-row flex flex-wrap items-center gap-2`, holding:
     - `<span className="sm-readout legend">OCT {octave} · VEL {velocity}</span>`
     - `<MidiStatus />`
     - `<span className="sm-keys-indicator legend …" data-armed={armed}>`, reading `⌨ keys on` when armed and `⌨ keys off` otherwise.
  4. `<LoadErrorToast inline onRetry={selectPatchId} />`
  5. `<LiveTouchKeyboard keyLabels octaves={octaves ?? 2} …/>`
  6. The overlays: `PowerOnOverlay contained`, `PatchPicker contained offlineFeatures={false}`, `LoadingOverlay contained` and `MidiPanel contained getLatency`.

  The embed has no `/` hotkey and does not import `useTheme`, `useAuth`, `useUserPatchSync`, `useWakeLock` or anything under `src/pwa/`.

- [ ] **Step 1: Write the failing tests.** Start `SoundModule.test.tsx` with `vi.mock('../audio/AudioEngine', () => ({ getEngine: () => fake }))`, using `makeFakeEngine()` from Task 6.

```ts
it('renders a themed, focusable root and leaves <html> alone', () => {
  const { container } = render(<SoundModule theme="light" className="host-x" />)
  const root = container.querySelector('.sound-module') as HTMLElement
  expect(root.dataset.theme).toBe('light'); expect(root.tabIndex).toBe(0)
  expect(root.className).toContain('host-x')
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
})
it('keys play only while the module has focus', () => {
  fireEvent.keyDown(document.body, { key: 'a' }); expect(fake.noteOn).not.toHaveBeenCalled()
  act(() => root.focus()); fireEvent.keyDown(root, { key: 'a' }); expect(fake.noteOn).toHaveBeenCalled()
  expect(root.querySelector('.sm-keys-indicator')!.textContent).toMatch(/keys on/i)
})
it('pressing the on-screen piano arms the keyboard', () => {
  fireEvent.pointerDown(root.querySelector('.touch-keyboard-body')!, { pointerId: 1 })
  expect(root.contains(document.activeElement)).toBe(true)
})
it('focus loss does not call the global panic (MIDI/breath keep playing)', () => {
  act(() => root.focus()); fireEvent.keyDown(root, { key: 'a' })
  fireEvent.focusOut(root, { relatedTarget: document.body })
  expect(fake.noteOff).toHaveBeenCalledWith(60); expect(fake.panic).not.toHaveBeenCalled()
})
it('labels 18 piano keys', () => { expect(root.querySelectorAll('.touch-key-label')).toHaveLength(18) })
it('draws the picker and MIDI panel inside the root', () => {
  act(() => useStore.setState({ pickerOpen: true, midiPanelOpen: true }))
  expect(root.querySelector('.patch-picker')).not.toBeNull()
  expect(root.querySelector('.midi-panel-scrim')).not.toBeNull()
  expect(root.querySelector('.patch-card-dl')).toBeNull()
})
it('hides CST patches without assetBaseUrl', () => {
  expect(useStore.getState().catalog.some((p) => p.bank === 'CST')).toBe(false)
})
it('unmount panics and suspends the engine', () => {
  unmount(); expect(fake.panic).toHaveBeenCalled(); expect(fake.suspend).toHaveBeenCalledOnce()
})
it('never touches app-only storage keys', () => {
  // spy getItem/setItem before render; power on; play; select a patch via fake.onLoaded
  for (const k of ['module:downloaded:v1', 'module:user-patches:v1', 'module:debug:v1'])
    expect(keysTouched).not.toContain(k)
})
```

`index.test.ts` first uses `vi.mock` with throwing factories for `../state/useTheme`, `../state/useAuth`, `../state/useUserPatchSync` and `../pwa/warmVendored`. Each factory is `() => { throw new Error('app-only module imported') }`. Then:

```ts
it('exports exactly SoundModule and imports no app-only modules', async () => {
  const mod = await import('./index')
  expect(Object.keys(mod)).toEqual(['SoundModule'])
})
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run: `npx vitest run src/embed/SoundModule.test.tsx src/embed/index.test.ts`. Expected: FAIL (the module is not found).
- [ ] **Step 3: Implement `SoundModule.tsx` and `index.ts`** as described in the Interfaces block.
- [ ] **Step 4: Run the tests and confirm they pass.** Run: `npx vitest run src/embed && npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(embed): SoundModule component and library entry"`

---

### Task 10: Stylesheet split and the scoped `styles.css` / `fonts.css`

**Files:**
- Create: `src/styles/theme.css` (from `src/index.css:3-38`), `src/styles/materials.css` (from `:47-206`), `src/styles/components.css` (from `:226-434`)
- Modify: `src/index.css`. It becomes `@import "tailwindcss";` plus imports of the three files in that order, followed by the app-only rules `html, body, #root`, `body` and `button` (lines 208-224, kept verbatim and in place).
- Create: `src/embed/styles/tailwind.css`, `src/embed/styles/base.css`, `src/embed/styles/fonts.css`
- Create: `packages/sound-module/scripts/build-css.mjs`, `packages/sound-module/scripts/build-css.d.mts`
- Modify: root `package.json`. Add the devDependencies `@tailwindcss/cli@^4.2.2`, `postcss@^8` and `postcss-selector-parser@^7`.
- Test: `src/embed/styles.test.ts` (create, with a `// @vitest-environment node` docblock)

**Interfaces:**
- Produces: `export const SCOPE = '.sound-module'` and `export async function buildStyles(): Promise<string>` from `build-css.mjs`. When run directly, the script writes `packages/sound-module/dist/styles.css` and copies `src/embed/styles/fonts.css` to `dist/fonts.css`.
- `src/embed/styles/tailwind.css`:
  - `@import 'tailwindcss/theme.css' layer(theme);`
  - `@import '../../styles/theme.css' theme(static);` (emits every token even if only inline styles use it)
  - `@import 'tailwindcss/utilities.css' layer(utilities) source(none);`
  - `@import '../../styles/materials.css';` and `@import '../../styles/components.css';`
  - `@source '../../components'; @source '..';` and `@source not '../../**/*.test.{ts,tsx}';`
  - No preflight.
- `src/embed/styles/base.css` is a scoped preflight subset modelled on `/home/shaun/crf-react-music-tools/src/styles/base.css`. It applies `box-sizing: border-box`, `margin: 0`, `padding: 0` and `border: 0 solid` to `.sound-module` and `.sound-module :where(*)`, and resets buttons, inputs and SVG to `font: inherit; color: inherit; background: transparent`. The root rule is `.sound-module { position: relative; isolation: isolate; font-family: var(--font-body); color: var(--color-text); font-size: 16px; line-height: 1.5; -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }`.
- `src/embed/styles/fonts.css` holds the `@import '@fontsource/…'` lines for exactly the weights in `src/main.tsx:4-13`.
- The PostCSS transform does the crf steps plus three more:
  1. **Root rewrite.** The selectors `:root`, `:host` and `html` become `.sound-module`, and `:root[data-theme="light"]` becomes `.sound-module[data-theme="light"]`. Selectors that already start with `.sound-module` are not re-scoped.
  2. **Keyframe rename.** Every `@keyframes X` becomes `sm-X`, and every `animation`/`animation-name` value that mentions `X` is rewritten to match.
  3. **Prefix rename.** The `--sm-tw-` prefix is used and the `properties` layer is renamed `sm-properties`.

- [ ] **Step 1: Record the app's CSS baseline.** Run `npm run build && sha256sum dist/assets/index-*.css > /tmp/app-css.sha` before touching `src/index.css`.

- [ ] **Step 2: Write the failing test** `src/embed/styles.test.ts`, modelled on `/home/shaun/crf-react-music-tools/src/styles/styles.test.ts`:

```ts
it('scopes every selector to .sound-module', () => {
  const unscoped = rules.flatMap((r) => r.selectors).filter((s) => !s.includes(SCOPE))
    .filter((s) => !['*', '::before', '::after', '::backdrop'].includes(s.trim()))
  expect(unscoped).toEqual([])
})
it('has no global selectors', () => {
  expect(rules.flatMap((r) => r.selectors).filter((s) => /^(html|body|:root|:host|button|input|svg|\*)\b/.test(s.trim()) && !/^\*$/.test(s.trim()))).toEqual([])
})
it('renames Tailwind internals and converts rem', () => {
  expect(css).not.toMatch(/--tw-/); expect(css).not.toMatch(/\d(rem)\b/)
  root.walkAtRules('property', (at) => expect(at.params).toMatch(/^--sm-tw-/))
})
it('prefixes every keyframe and its uses', () => {
  root.walkAtRules(/keyframes$/, (at) => expect(at.params).toMatch(/^sm-/))
  root.walkDecls(/^animation(-name)?$/, (d) => expect(d.value).toMatch(/\bsm-[a-z-]+/))
})
it('declares the theme and material tokens on the root, dark and light', () => {
  const dark = rules.find((r) => r.selector === '.sound-module' && r.some((n) => n.type === 'decl' && n.prop === '--color-coral'))
  expect(dark).toBeTruthy()
  for (const p of ['--font-mono', '--font-legend', '--face-bg', '--scrim', '--card-bg']) expect(css).toContain(p)
  const light = rules.find((r) => r.selector === '.sound-module[data-theme="light"]')!
  expect(light.toString()).toContain('--color-text: #26241F')
})
it('includes the component classes and the utilities the embed uses, scoped', () => {
  for (const s of ['.hw-btn:where(.sound-module, .sound-module *)', '.legend:where(', '.inset-0:where(', '.font-mono:where('])
    expect(css).toContain(s)
})
it('does not bundle fonts', () => { expect(css).not.toMatch(/@font-face|@import/) })
```

- [ ] **Step 3: Run the test and confirm it fails.** Run: `npx vitest run src/embed/styles.test.ts`. Expected: FAIL (`build-css.mjs` is not found).
- [ ] **Step 4: Split `src/index.css`, install the devDependencies (`npm i -D @tailwindcss/cli@^4.2.2 postcss@^8 postcss-selector-parser@^7`), and write the three embed CSS inputs and `build-css.mjs`.**
- [ ] **Step 5: Run the test and confirm it passes, and that the app's CSS is identical.** Run `npx vitest run src/embed/styles.test.ts`, then `npm run build && sha256sum -c /tmp/app-css.sha`. Expected: PASS and `OK`. If the hash differs, fix the split by restoring the original order. Do not accept the difference.
- [ ] **Step 6: Commit.** `git commit -m "feat(embed): split shared CSS and build a scoped styles.css/fonts.css"`

---

### Task 11: Library package build, patches in dist, CI

**Files:**
- Create: `packages/sound-module/package.json`, `packages/sound-module/vite.config.ts`, `packages/sound-module/tsconfig.build.json`, `packages/sound-module/scripts/copy-patches.mjs`, `packages/sound-module/scripts/verify-dist.mjs`, `packages/sound-module/README.md`
- Modify: root `package.json` (`scripts`), `.github/workflows/ci.yml` (add a step after "Check PWA output")

**Interfaces:**
- Consumes: `src/embed/index.ts` (Task 9) and `build-css.mjs` (Task 10).
- `packages/sound-module/package.json`:
  - Identity: `name: "@pepperhorn/sound-module"`, `version: "0.1.0"`, `type: "module"`, `license: "MIT"`. Add `LICENSE` (MIT, "Copyright (c) 2026 PepperHorn") at the repo root and copy it into `packages/sound-module/LICENSE`; include `LICENSE` in `files`.
  - Entry points: `main` and `module` are `./dist/index.js`, and `types` is `./dist/types/embed/index.d.ts`.
  - `sideEffects: ["*.css"]` and `files: ["dist", "README.md"]`.
  - `exports`: `"."` (`{ types, import }`), `"./styles.css": "./dist/styles.css"`, `"./fonts.css": "./dist/fonts.css"`, `"./patches/*": "./dist/patches/*"` and `"./package.json": "./package.json"`.
  - `peerDependencies`: react and react-dom `^18.0.0 || ^19.0.0`.
  - `dependencies`: `smplr ^0.20.0`, `zustand ^5.0.12`, and the four `@fontsource/*` packages at the root's versions.
  - `publishConfig: { access: "public" }` and `scripts.prepublishOnly: "node scripts/verify-dist.mjs"`.
- `vite.config.ts` contains only the `react()` plugin, with no tailwind, PWA or vendored plugins. It sets `publicDir: false`, and in `build`: `target: 'es2020'`, `minify: false`, `sourcemap: false`, `copyPublicDir: false`, `outDir: resolve(import.meta.dirname, 'dist')`, `lib: { entry: { index: resolve(import.meta.dirname, '../../src/embed/index.ts') }, formats: ['es'] }`, and `rollupOptions.external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'smplr', 'zustand', /^smplr\//, /^zustand\//]`.
- `tsconfig.build.json` extends `../../tsconfig.json`. It sets `noEmit: false`, `declaration: true`, `emitDeclarationOnly: true`, `rootDir: "../../src"`, `outDir: "dist/types"` and `types: ["vite/client"]`, with `files: ["../../src/embed/index.ts"]`.
- `copy-patches.mjs` copies `public/patches/**` to `packages/sound-module/dist/patches/**`, excluding `README.md`.
- `verify-dist.mjs` exits non-zero unless all of the following hold:
  - These files exist and are non-empty: `dist/index.js`, `dist/styles.css`, `dist/fonts.css`, `dist/types/embed/index.d.ts`, `dist/patches/sine-key/C4.wav` and `dist/patches/poly-bass/C2.wav`.
  - `dist/index.js` contains none of `registerSW`, `virtual:`, `workbox`, `module-cdn-v1`, `serviceWorker` or `smplr-samples`.
  - `dist/index.js` does not contain an inlined React (the string `react.production` or `__SECRET_INTERNALS`).
  - Every file under `dist/patches` matches a file under `public/patches`.
- Root `package.json` scripts:
  - `"build:lib": "node -e \"require('node:fs').rmSync('packages/sound-module/dist',{recursive:true,force:true})\" && vite build --config packages/sound-module/vite.config.ts && tsc -p packages/sound-module/tsconfig.build.json && node packages/sound-module/scripts/build-css.mjs && node packages/sound-module/scripts/copy-patches.mjs"`
  - `"verify:lib": "node packages/sound-module/scripts/verify-dist.mjs"`
  - `dev`, `build` and `preview` are unchanged.
- `packages/sound-module/README.md` documents the External contract above: install, the two CSS imports, props, copying the patch audio, CSP and Permissions-Policy needs, one instance per page, and the storage keys.

- [ ] **Step 1: Write the failing check.** Create `verify-dist.mjs` first, then run `npm run verify:lib`. Expected: FAIL (`dist/index.js` is missing).
- [ ] **Step 2: Create the package files and the root scripts** as described in the Interfaces block.
- [ ] **Step 3: Build and verify.** Run `npm run build:lib && npm run verify:lib`. Expected: the build succeeds and the script prints `sound-module dist OK`.
- [ ] **Step 4: Check the packed contents and a real consumer.** Run `cd packages/sound-module && npm pack --dry-run`. Expected: the list contains `dist/index.js`, `dist/styles.css`, `dist/fonts.css`, `dist/types/…`, `dist/patches/sine-key/*.wav`, `dist/patches/poly-bass/*.wav` and `README.md`, and nothing else. Then run `npm pack` and install the tarball into a scratch Vite React app (`npm create vite@latest /tmp/sm-consumer -- --template react-ts`). Import the component and both CSS files, render `<SoundModule assetBaseUrl="" />`, and run `npm run dev -- --host 0.0.0.0`. The panel should render with the rack look, and the page's own body font and buttons should be unchanged. Delete the scratch app afterwards.
- [ ] **Step 5: Confirm the app is unchanged.** Run `npm test && npm run build` (the PWA check files exist) and `git status` (no `dist/` tracked).
- [ ] **Step 6: Add the CI step.** In `.github/workflows/ci.yml`, add a step named `Library build` after `Check PWA output` that runs `npm run build:lib && npm run verify:lib`.
- [ ] **Step 7: Commit.** `git add packages/sound-module package.json package-lock.json .github/workflows/ci.yml && git commit -m "build: @pepperhorn/sound-module library package with patches in dist"`

---

### Task 12: Release workflow

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: `build:lib` and `verify:lib` (Task 11).
- It mirrors `/home/shaun/crf-react-music-tools/.github/workflows/release.yml`, adapted to npm and the sub-package:
  - **Trigger and permissions:** `on: push: tags: ['v*']`, with `permissions: contents: read, id-token: write`.
  - **Setup:** `actions/checkout@v7`, then `actions/setup-node@v7` with `node-version: 24`, `cache: npm` and `registry-url: https://registry.npmjs.org`, then `npm install -g npm@latest`.
  - **Tag check:** "Tag matches package version" compares `v$(node -p "require('./packages/sound-module/package.json').version")` with `$GITHUB_REF_NAME`.
  - **Build and test:** `npm ci`, `npm run typecheck`, `npm test`, `npm run build:lib`, `npm run verify:lib`.
  - **Publish:** `npm publish ./packages/sound-module --access public` via **npm trusted publishing (OIDC)**, same as crf-react-music-tools: no `NPM_TOKEN` secret, no `NODE_AUTH_TOKEN`. Requires npm >= 11.5.1 (hence `npm install -g npm@latest`) and `id-token: write`.

- [ ] **Step 1: Write the workflow** as described in the Interfaces block.
- [ ] **Step 2: Validate it.** Run `npx --yes @action-validator/cli .github/workflows/release.yml` (or `actionlint` if it is installed). Expected: no errors. Then dry-run the tag check locally: `GITHUB_REF_NAME=v0.1.0 bash -c '[ "v$(node -p "require(\"./packages/sound-module/package.json\").version")" = "$GITHUB_REF_NAME" ] && echo match'`. Expected: `match`.
- [ ] **Step 3: Commit.** `git add .github/workflows/release.yml && git commit -m "ci: publish @pepperhorn/sound-module to npm on v* tags"`

Publishing is the user's step, not part of this plan: first release `0.1.0` is published manually (`npm login`, then `npm publish ./packages/sound-module --access public`), because npm trusted publishing can only be configured on a package that already exists. The user then adds the trusted publisher on npmjs.com (repo `pepperhorn/module`, workflow `release.yml`), and later releases go out by pushing a `v*` tag.

---

## Decisions made in this plan (spec left to builder)

- **Package layout:** a sub-package directory `packages/sound-module/` (not an npm workspace) whose build reads root `src/`. The root `package.json` keeps `name: "module"` and `private: true`.
- **Wiring extraction:** `useSoundEngine` lives in `src/state/useSoundEngine.ts`. The computer keyboard stays outside the hook because the app and the embed gate it differently.
- **Engine on unmount:** the engine is suspended and reused rather than closed. This is safe under StrictMode, and the singleton survives.
- **Letter labels:** the embed only. The app is unchanged.
- **Layout:** the header is `PatchStrip` plus a status row. The root has `min-h-[420px]`, overlays are `absolute inset-0`, and `MidiPanel` scrolls internally (`max-h-full`).
- **Store:** app-only state is loaded by `hydrateAppState()` from `main.tsx`, not at import. Embed writes go through `setPersistScope('embed')`.
- **Keys indicator copy:** `⌨ keys on` and `⌨ keys off`.
- **License:** MIT (user).
