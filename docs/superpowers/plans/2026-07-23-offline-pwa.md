# Offline-capable Installable PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MODULE an installable phone SPA that cold-launches and plays offline, with the app shell precached immediately, the 26 MB of vendored samples background-precached after first load, and CDN libraries left as user-chosen downloads.

**Architecture:** Add `vite-plugin-pwa` (Workbox) to the existing Vite/React app. The service worker owns **same-origin** only — precache the shell, runtime-cache `/smplr-samples/`, and fall back navigations to `index.html`. `loggedStorage.ts` is left untouched and remains the sole owner of cross-origin CDN caching; its existing same-origin `local` tier becomes offline-capable for free. Updates surface via a non-intrusive "New version — Reload" toast. A build-time virtual module lists the vendored sample URLs, which an idle-triggered warm loop fetches to populate the SW runtime cache.

**Tech Stack:** Vite 8, React 19, TypeScript 5.7, `vite-plugin-pwa` (Workbox), Vitest + jsdom + @testing-library/react (new, for pure-logic units), zustand 5.

## Global Constraints

- **Framework:** Stay Vite/React. No Astro. (spec: Stack decision)
- **Cache ownership is split:** the SW must NOT cache cross-origin CDN hosts `smpldsnds.github.io`, `gleitz.github.io`, `goldst.dev`. Those stay owned by `loggedStorage.ts`. (spec: §2)
- **`src/audio/loggedStorage.ts` MUST remain unchanged.** (spec: §2)
- **Vendored samples (`/smplr-samples/`, 26 MB / 473 files) MUST NOT be in the precache manifest** — they are runtime-cached and warmed lazily, never blocking install. (spec: §1)
- **Update behavior:** `registerType: 'prompt'` — never auto-reload mid-session. (spec: §4)
- **Semantic class names** alongside Tailwind utilities on every new element (user global instruction).
- **Node 22.22**, npm 10.9. Build command is `npm run build` (`tsc -b && vite build`). Type-check is `npm run typecheck`.
- **Cache names:** app-shell precache is Workbox-managed; vendored runtime cache is `module-vendored-v1`; CDN cache stays `module-cdn-v1` (owned by loggedStorage, do not touch).

---

### Task 0: Vitest test harness

**Files:**
- Modify: `package.json` (devDependencies + `test` script)
- Create: `vitest.config.ts`
- Modify: `tsconfig.json` (exclude test files from the production type-check build)
- Create: `src/testSmoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` (Vitest, jsdom env) that later tasks use for TDD.

- [ ] **Step 1: Install test dependencies**

Run:
```bash
npm install -D vitest@^3 jsdom@^25 @testing-library/react@^16 @testing-library/dom@^10
```
Expected: packages added under devDependencies, no peer-dep errors.

- [ ] **Step 2: Add the test script**

In `package.json` `scripts`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
  },
})
```

- [ ] **Step 4: Exclude test files from the build type-check**

In `tsconfig.json`, add a top-level `"exclude"` key (sibling of `"include"`):
```json
"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
```
Rationale: `npm run build` runs `tsc -b` over `include: ["src"]`; test files import from `vitest` and must not break the production type-check.

- [ ] **Step 5: Write a smoke test**

`src/testSmoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run the smoke test**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 7: Verify the build still type-checks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json src/testSmoke.test.ts
git commit -m "test: add vitest + jsdom harness"
```

---

### Task 1: vite-plugin-pwa base — service worker + shell precache

**Files:**
- Modify: `package.json` (add `vite-plugin-pwa`)
- Modify: `vite.config.ts`
- Modify: `tsconfig.json` (add PWA client types)
- Create: `src/pwa.d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a generated `sw.js` in the build that precaches the app shell (JS/CSS/HTML/svg/woff2); `registerType: 'prompt'`; `injectRegister: null` (registration wired manually in Task 7). Runtime caching / manifest added in later tasks.

- [ ] **Step 1: Install the plugin**

Run:
```bash
npm install -D vite-plugin-pwa@^1
```
Expected: added to devDependencies.

- [ ] **Step 2: Add PWA client types**

In `tsconfig.json`, change the `types` array to:
```json
"types": ["vite/client", "vite-plugin-pwa/client"]
```

- [ ] **Step 3: Declare the vendored-samples virtual module (placeholder for Task 4)**

`src/pwa.d.ts`:
```ts
declare module 'virtual:vendored-samples' {
  const urls: string[]
  export default urls
}
```

- [ ] **Step 4: Wire VitePWA into `vite.config.ts`**

Replace the file with:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      devOptions: { enabled: true, type: 'module' },
      workbox: {
        // Precache the app shell ONLY. Audio (ogg/m4a/wav) is intentionally
        // excluded so the 26 MB of vendored samples never bloat the install.
        globPatterns: ['**/*.{js,css,html,svg,woff2,ico}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
  },
})
```

- [ ] **Step 5: Build and confirm the service worker is generated**

Run: `npm run build`
Expected: build succeeds; `dist/sw.js` and `dist/workbox-*.js` exist, and the precache manifest inside `dist/sw.js` lists the hashed `assets/*.js`, `assets/*.css`, `index.html`, `favicon.svg`, and woff2 fonts — and does **NOT** list any `smplr-samples/*` audio files.

Verify no audio in precache:
```bash
grep -c "smplr-samples" dist/sw.js
```
Expected: `0`.

- [ ] **Step 6: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json src/pwa.d.ts
git commit -m "feat(pwa): add vite-plugin-pwa with shell-only precache"
```

---

### Task 2: Web app manifest + icons

**Files:**
- Create: `scripts/gen-icons.mjs`
- Modify: `package.json` (add `gen-icons` script + `sharp` devDep)
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png` (generated)
- Modify: `vite.config.ts` (add `manifest` block)

**Interfaces:**
- Consumes: `public/favicon.svg`.
- Produces: an installable web app manifest referencing 192/512/maskable icons.

- [ ] **Step 1: Install the icon generator**

Run:
```bash
npm install -D sharp@^0.33
```

- [ ] **Step 2: Write the icon generation script**

`scripts/gen-icons.mjs`:
```js
// Renders the app icons from public/favicon.svg into public/icons/.
// Run: node scripts/gen-icons.mjs
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(join(root, 'public', 'favicon.svg'))
const outDir = join(root, 'public', 'icons')
await mkdir(outDir, { recursive: true })

const BG = '#0F1024' // app boot background, used behind the maskable safe area

async function render(size, name, { maskable = false } = {}) {
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: maskable ? BG : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
  // For maskable, inset the glyph to ~80% so it survives platform masking.
  const glyph = maskable ? Math.round(size * 0.8) : size
  const resized = await sharp(svg).resize(glyph, glyph).png().toBuffer()
  const offset = Math.round((size - glyph) / 2)
  await canvas
    .composite([{ input: resized, top: offset, left: offset }])
    .png()
    .toFile(join(outDir, name))
  console.log('wrote', name)
}

await render(192, 'icon-192.png')
await render(512, 'icon-512.png')
await render(512, 'icon-512-maskable.png', { maskable: true })
```

- [ ] **Step 3: Add the npm script and generate the icons**

In `package.json` `scripts`, add:
```json
"gen-icons": "node scripts/gen-icons.mjs"
```
Run: `npm run gen-icons`
Expected: three PNGs written under `public/icons/`. Open `public/icons/icon-512.png` and confirm the glyph is centered and visible.

- [ ] **Step 4: Add the manifest block to VitePWA**

In `vite.config.ts`, add a `manifest` key to the `VitePWA({...})` options (sibling of `workbox`):
```ts
      manifest: {
        name: 'MODULE',
        short_name: 'MODULE',
        description: 'MODULE — playable sampler instrument',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        theme_color: '#FAFBFC',
        background_color: '#0F1024',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
```
Note: `orientation` is `portrait-primary`; if the instrument proves usable in landscape during QA, relax to omit `orientation`.

- [ ] **Step 5: Build and verify the manifest**

Run: `npm run build`
Expected: `dist/manifest.webmanifest` exists and lists all three icons; `dist/index.html` contains `<link rel="manifest" ...>`.
```bash
grep -o "manifest.webmanifest" dist/index.html
```
Expected: one match.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/gen-icons.mjs public/icons vite.config.ts
git commit -m "feat(pwa): add web app manifest and generated icons"
```

---

### Task 3: Runtime caching for vendored samples + explicit CDN passthrough

**Files:**
- Modify: `vite.config.ts` (add `workbox.runtimeCaching`)

**Interfaces:**
- Consumes: the VitePWA config from Task 1.
- Produces: a same-origin `CacheFirst` route for `/smplr-samples/` into cache `module-vendored-v1`; an explicit `NetworkOnly` route for the three CDN hosts documenting that the SW never caches them.

- [ ] **Step 1: Add runtimeCaching to the workbox block**

In `vite.config.ts`, inside `VitePWA({ workbox: { ... } })`, add a `runtimeCaching` array:
```ts
        runtimeCaching: [
          {
            // Same-origin vendored samples: cache on first fetch, serve from
            // cache forever after. This is what the idle warm loop populates.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/smplr-samples/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'module-vendored-v1',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cross-origin CDN sample hosts are owned entirely by
            // loggedStorage.ts (module-cdn-v1). The SW must NOT cache them.
            urlPattern: ({ url }) =>
              url.host === 'smpldsnds.github.io' ||
              url.host === 'gleitz.github.io' ||
              url.host === 'goldst.dev',
            handler: 'NetworkOnly',
          },
        ],
```

- [ ] **Step 2: Build and confirm the routes are present**

Run: `npm run build`
Expected: build succeeds.
```bash
grep -c "module-vendored-v1" dist/sw.js
```
Expected: at least `1`.

- [ ] **Step 3: Manual runtime verification (vendored offline mid-session)**

Run: `npm run build && npm run preview -- --host 0.0.0.0`
In a browser at the preview URL:
1. DevTools → Application → Service Workers: confirm the SW is activated.
2. Load a **vendored** patch (an e-piano / VCSL patch served from `/smplr-samples/`).
3. Application → Cache Storage: confirm `module-vendored-v1` now contains those sample URLs.
4. Load a **CDN** patch (a MusyngKite soundfont). Confirm its samples appear in `module-cdn-v1` (loggedStorage) and **NOT** in any Workbox cache.

Expected: vendored samples in `module-vendored-v1`; CDN samples only in `module-cdn-v1`.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat(pwa): runtime-cache vendored samples, passthrough CDN hosts"
```

---

### Task 4: Build-time vendored URL manifest (virtual module)

**Files:**
- Create: `src/pwa/vendoredUrls.ts` (pure helper `toVendoredUrls`)
- Create: `src/pwa/vendoredUrls.test.ts`
- Create: `plugins/vendoredSamplesPlugin.mjs` (Vite plugin exposing `virtual:vendored-samples`)
- Modify: `vite.config.ts` (register the plugin)

**Interfaces:**
- Consumes: files under `public/smplr-samples/`.
- Produces:
  - `toVendoredUrls(publicDir: string, absPaths: string[]): string[]` — pure; maps absolute file paths under `<publicDir>/smplr-samples` to encoded public URL paths like `/smplr-samples/smpldsnds/.../027-D%231-F.ogg`.
  - `virtual:vendored-samples` default export: `string[]` of those URL paths (consumed by Task 5).

- [ ] **Step 1: Write the failing test for `toVendoredUrls`**

`src/pwa/vendoredUrls.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { toVendoredUrls } from './vendoredUrls'

describe('toVendoredUrls', () => {
  const publicDir = '/repo/public'

  it('maps absolute paths to rooted /smplr-samples URLs', () => {
    const urls = toVendoredUrls(publicDir, [
      '/repo/public/smplr-samples/gleitz/piano/C4.ogg',
    ])
    expect(urls).toEqual(['/smplr-samples/gleitz/piano/C4.ogg'])
  })

  it('URL-encodes special characters in filenames', () => {
    const urls = toVendoredUrls(publicDir, [
      '/repo/public/smplr-samples/smpldsnds/cp80/samples/027-D#1-F.ogg',
    ])
    expect(urls).toEqual([
      '/smplr-samples/smpldsnds/cp80/samples/027-D%231-F.ogg',
    ])
  })

  it('ignores files outside smplr-samples', () => {
    const urls = toVendoredUrls(publicDir, [
      '/repo/public/favicon.svg',
      '/repo/public/smplr-samples/x/y.m4a',
    ])
    expect(urls).toEqual(['/smplr-samples/x/y.m4a'])
  })

  it('normalizes Windows separators', () => {
    const urls = toVendoredUrls('C:\\repo\\public', [
      'C:\\repo\\public\\smplr-samples\\a\\b.wav',
    ])
    expect(urls).toEqual(['/smplr-samples/a/b.wav'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- vendoredUrls`
Expected: FAIL ("Cannot find module './vendoredUrls'").

- [ ] **Step 3: Implement `toVendoredUrls`**

`src/pwa/vendoredUrls.ts`:
```ts
// Pure mapping from absolute sample file paths under <publicDir>/smplr-samples
// to their encoded, rooted public URL paths. Used by the Vite plugin that
// builds the `virtual:vendored-samples` list. Kept framework-free so it is
// unit-testable without Vite.
export function toVendoredUrls(publicDir: string, absPaths: string[]): string[] {
  const normDir = publicDir.replace(/\\/g, '/').replace(/\/+$/, '')
  const prefix = `${normDir}/smplr-samples/`
  const out: string[] = []
  for (const raw of absPaths) {
    const p = raw.replace(/\\/g, '/')
    if (!p.startsWith(prefix)) continue
    const rel = p.slice(prefix.length)
    const encoded = rel.split('/').map(encodeURIComponent).join('/')
    out.push(`/smplr-samples/${encoded}`)
  }
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- vendoredUrls`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the Vite plugin exposing the virtual module**

`plugins/vendoredSamplesPlugin.mjs`:
```js
// Vite plugin: exposes `virtual:vendored-samples` — a string[] of every
// vendored sample URL under public/smplr-samples. Read from disk at config
// time so it never drifts from what's actually shipped. `public/` files are
// not in the module graph, so import.meta.glob cannot see them; we walk fs.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { toVendoredUrls } from '../src/pwa/vendoredUrls.ts'

const VIRTUAL_ID = 'virtual:vendored-samples'
const RESOLVED_ID = '\0' + VIRTUAL_ID

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ogg|m4a|wav)$/i.test(entry)) out.push(full)
  }
  return out
}

export function vendoredSamplesPlugin() {
  return {
    name: 'vendored-samples-manifest',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      const publicDir = join(process.cwd(), 'public')
      let urls = []
      try {
        urls = toVendoredUrls(publicDir, walk(join(publicDir, 'smplr-samples')))
      } catch {
        urls = []
      }
      return `export default ${JSON.stringify(urls)}`
    },
  }
}
```
Note: importing a `.ts` helper into an `.mjs` Vite plugin works because Vite processes the config through esbuild; the `allowImportingTsExtensions` tsconfig option already permits the `.ts` specifier.

- [ ] **Step 6: Register the plugin in `vite.config.ts`**

Add the import at the top:
```ts
import { vendoredSamplesPlugin } from './plugins/vendoredSamplesPlugin.mjs'
```
Add `vendoredSamplesPlugin()` to the `plugins` array (before `VitePWA(...)`).

- [ ] **Step 7: Verify the virtual module resolves at build**

Run: `npm run build`
Expected: build succeeds (no "failed to resolve virtual:vendored-samples").

- [ ] **Step 8: Commit**

```bash
git add src/pwa/vendoredUrls.ts src/pwa/vendoredUrls.test.ts plugins/vendoredSamplesPlugin.mjs vite.config.ts
git commit -m "feat(pwa): build-time vendored-samples URL manifest"
```

---

### Task 5: Idle warm loop that precaches vendored samples

**Files:**
- Create: `src/pwa/warmVendored.ts`
- Create: `src/pwa/warmVendored.test.ts`

**Interfaces:**
- Consumes: `virtual:vendored-samples` (Task 4); a `fetch`-like function.
- Produces: `warmVendored(opts: { urls: string[]; fetchFn?: typeof fetch; concurrency?: number; onProgress?: (done: number, total: number) => void; signal?: AbortSignal }): Promise<{ done: number; total: number; failed: number }>` — fetches each URL (low-priority) with bounded concurrency, reporting progress; swallows individual failures.

- [ ] **Step 1: Write the failing test**

`src/pwa/warmVendored.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { warmVendored } from './warmVendored'

describe('warmVendored', () => {
  it('fetches every url and reports final progress', async () => {
    const urls = ['/a.ogg', '/b.ogg', '/c.ogg']
    const fetchFn = vi.fn(async () => new Response('x', { status: 200 }))
    const progress: Array<[number, number]> = []

    const result = await warmVendored({
      urls,
      fetchFn: fetchFn as unknown as typeof fetch,
      concurrency: 2,
      onProgress: (done, total) => progress.push([done, total]),
    })

    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ done: 3, total: 3, failed: 0 })
    expect(progress.at(-1)).toEqual([3, 3])
  })

  it('counts failures but still completes', async () => {
    const urls = ['/a.ogg', '/b.ogg']
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('x', { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'))

    const result = await warmVendored({
      urls,
      fetchFn: fetchFn as unknown as typeof fetch,
      concurrency: 1,
    })

    expect(result).toEqual({ done: 2, total: 2, failed: 1 })
  })

  it('does nothing for an empty list', async () => {
    const fetchFn = vi.fn()
    const result = await warmVendored({
      urls: [],
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(fetchFn).not.toHaveBeenCalled()
    expect(result).toEqual({ done: 0, total: 0, failed: 0 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- warmVendored`
Expected: FAIL ("Cannot find module './warmVendored'").

- [ ] **Step 3: Implement `warmVendored`**

`src/pwa/warmVendored.ts`:
```ts
// Idle-triggered warm loop: fetches every vendored sample URL so the service
// worker's CacheFirst route (module-vendored-v1) populates. Runs at low
// priority with bounded concurrency; individual failures are tolerated (a
// flaky/offline network just leaves some samples uncached for next time).
export interface WarmOptions {
  urls: string[]
  fetchFn?: typeof fetch
  concurrency?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface WarmResult {
  done: number
  total: number
  failed: number
}

export async function warmVendored(opts: WarmOptions): Promise<WarmResult> {
  const { urls, onProgress, signal } = opts
  const fetchFn = opts.fetchFn ?? fetch
  const concurrency = Math.max(1, opts.concurrency ?? 4)
  const total = urls.length
  let done = 0
  let failed = 0
  let cursor = 0

  onProgress?.(done, total)
  if (total === 0) return { done, total, failed }

  async function worker() {
    while (cursor < total) {
      if (signal?.aborted) return
      const url = urls[cursor++]
      try {
        // `low` priority keeps this from competing with active audio loads.
        await fetchFn(url, { priority: 'low' } as RequestInit)
      } catch {
        failed++
      }
      done++
      onProgress?.(done, total)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => worker()),
  )
  return { done, total, failed }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- warmVendored`
Expected: PASS, 3 tests.

- [ ] **Step 5: Type-check**

Run: `npm run typecheck`
Expected: no errors. (`priority` on RequestInit is cast; if `noUnusedLocals` complains, it will not — all bindings are used.)

- [ ] **Step 6: Commit**

```bash
git add src/pwa/warmVendored.ts src/pwa/warmVendored.test.ts
git commit -m "feat(pwa): idle warm loop for vendored samples"
```

---

### Task 6: Store warm-progress fields + online-status hook

**Files:**
- Modify: `src/state/useStore.ts`
- Create: `src/input/useOnlineStatus.ts`
- Create: `src/input/useOnlineStatus.test.tsx`

**Interfaces:**
- Consumes: the existing zustand store shape.
- Produces:
  - Store: `warmProgress: { done: number; total: number } | null` and `setWarmProgress: (p: { done: number; total: number } | null) => void`.
  - `useOnlineStatus(): boolean` — reactive `navigator.onLine`, updating on `online`/`offline` events.

- [ ] **Step 1: Write the failing test for `useOnlineStatus`**

`src/input/useOnlineStatus.test.tsx`:
```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from './useOnlineStatus'

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('useOnlineStatus', () => {
  it('reflects the initial navigator.onLine value', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('updates when offline/online events fire', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- useOnlineStatus`
Expected: FAIL ("Cannot find module './useOnlineStatus'").

- [ ] **Step 3: Implement the hook**

`src/input/useOnlineStatus.ts`:
```ts
import { useEffect, useState } from 'react'

// Reactive navigator.onLine. Note: `onLine === true` only means "has a network
// interface", not "the internet works" — good enough for a soft indicator.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- useOnlineStatus`
Expected: PASS, 2 tests.

- [ ] **Step 5: Add warm-progress state to the store**

In `src/state/useStore.ts`, add to the state type interface (near `downloadingPatchId: string | null` around line 131):
```ts
  warmProgress: { done: number; total: number } | null
```
Add to the actions type (near `setDownloadingPatchId`, around line 145):
```ts
  setWarmProgress: (p: { done: number; total: number } | null) => void
```
Add to the initial state object (near `downloadingPatchId: null`, around line 207):
```ts
  warmProgress: null,
```
Add the setter (near `setDownloadingPatchId`, around line 276):
```ts
  setWarmProgress: (p) => set({ warmProgress: p }),
```

- [ ] **Step 6: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/state/useStore.ts src/input/useOnlineStatus.ts src/input/useOnlineStatus.test.tsx
git commit -m "feat(pwa): store warm-progress + useOnlineStatus hook"
```

---

### Task 7: Register the SW, wire the update toast, kick off the warm loop

**Files:**
- Create: `src/components/UpdateToast.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `virtual:pwa-register` (from vite-plugin-pwa), `virtual:vendored-samples` (Task 4), `warmVendored` (Task 5), `useStore` (Task 6).
- Produces: SW registration with a prompt-style refresh; an `UpdateToast` shown when a new SW is waiting; the warm loop started on idle after first paint.

- [ ] **Step 1: Write the UpdateToast component**

`src/components/UpdateToast.tsx`:
```tsx
interface UpdateToastProps {
  onReload: () => void
  onDismiss: () => void
}

// Non-intrusive "new version" prompt. Never reloads on its own — the user taps
// Reload when they're ready (important for a live instrument mid-performance).
export function UpdateToast({ onReload, onDismiss }: UpdateToastProps) {
  return (
    <div
      className="update-toast fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[min(92%,26rem)] items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-lg"
      role="status"
      style={{ background: '#1A1A2E', color: '#FAFBFC' }}
    >
      <span className="update-toast-label font-display text-sm">
        New version available
      </span>
      <div className="update-toast-actions flex items-center gap-2">
        <button
          className="update-toast-reload rounded-full px-4 py-1.5 text-sm font-semibold"
          style={{ background: 'var(--color-lime)', color: '#0F1024' }}
          onClick={onReload}
        >
          Reload
        </button>
        <button
          className="update-toast-dismiss rounded-full px-3 py-1.5 text-sm"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#FAFBFC' }}
          onClick={onDismiss}
        >
          Later
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire registration, toast, and warm loop into `main.tsx`**

Replace `src/main.tsx` with:
```tsx
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import vendoredUrls from 'virtual:vendored-samples'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './index.css'
import App from './App'
import { UpdateToast } from './components/UpdateToast'
import { warmVendored } from './pwa/warmVendored'
import { useStore } from './state/useStore'

function Root() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [reload, setReload] = useState<(() => void) | null>(null)

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setReload(() => () => updateSW(true))
        setNeedRefresh(true)
      },
      onOfflineReady() {
        // First install cached the shell — the app can now cold-launch offline.
        // Kept silent by design; the warm loop handles built-in samples next.
      },
    })

    // After first paint, warm the vendored samples on idle so built-ins become
    // offline-ready without blocking startup or competing with audio loads.
    const setWarmProgress = useStore.getState().setWarmProgress
    const start = () => {
      void warmVendored({
        urls: vendoredUrls,
        onProgress: (done, total) =>
          setWarmProgress(done >= total ? null : { done, total }),
      })
    }
    const idle = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void) => number
      }
    ).requestIdleCallback
    if (idle) idle(start)
    else window.setTimeout(start, 2000)
  }, [])

  return (
    <>
      <App />
      {needRefresh && reload && (
        <UpdateToast onReload={reload} onDismiss={() => setNeedRefresh(false)} />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: no errors. (`virtual:pwa-register` and `virtual:vendored-samples` types come from `vite-plugin-pwa/client` and `src/pwa.d.ts` respectively.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification (warm loop + update prompt)**

Run: `npm run build && npm run preview -- --host 0.0.0.0`
1. Load the app. DevTools → Application → Cache Storage → `module-vendored-v1`: within a few seconds of load it should begin filling toward 473 entries (the warm loop). Network panel shows `/smplr-samples/...` requests at Low priority.
2. Update test: stop preview, run `npm run build` again after a trivial source edit, restart preview, reload once so the new SW is detected → the "New version available" toast appears. Tap **Reload** → page reloads and the new SW is active (Application → Service Workers shows no waiting worker).

- [ ] **Step 6: Commit**

```bash
git add src/components/UpdateToast.tsx src/main.tsx
git commit -m "feat(pwa): register SW, update toast, kick off warm loop"
```

---

### Task 8: Online/offline indicator + "downloading built-ins" label

**Files:**
- Create: `src/components/ConnectionStatus.tsx`
- Modify: `src/components/Rack.tsx`

**Interfaces:**
- Consumes: `useOnlineStatus` (Task 6), `useStore.warmProgress` (Task 6).
- Produces: a `<ConnectionStatus />` chip rendered in the Rack status row beside `<MidiStatus />`.

- [ ] **Step 1: Write the ConnectionStatus component**

`src/components/ConnectionStatus.tsx`:
```tsx
import { useOnlineStatus } from '../input/useOnlineStatus'
import { useStore } from '../state/useStore'

// Soft connection + built-ins-download indicator for the Rack status row.
export function ConnectionStatus() {
  const online = useOnlineStatus()
  const warm = useStore((s) => s.warmProgress)

  return (
    <div className="connection-status flex items-center gap-2">
      {warm && (
        <span className="connection-warm font-mono text-[10px] uppercase tracking-widest text-text/40">
          downloading built-ins {warm.done}/{warm.total}
        </span>
      )}
      <span
        className="connection-dot inline-block h-2.5 w-2.5 rounded-full"
        title={online ? 'Online' : 'Offline — cached content only'}
        aria-label={online ? 'Online' : 'Offline'}
        style={{
          background: online ? 'var(--color-lime)' : 'rgba(20,30,60,0.35)',
          boxShadow: online ? '0 0 8px rgba(181, 232, 83, 0.6)' : 'none',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Render it in the Rack status row**

In `src/components/Rack.tsx`, add the import near the top:
```tsx
import { ConnectionStatus } from './ConnectionStatus'
```
In the `rack-brand-status` div (currently containing `<MidiStatus />` and `<UserMenu />`), add `<ConnectionStatus />` before `<MidiStatus />`:
```tsx
          <div className="rack-brand-status flex items-center gap-2">
            <ConnectionStatus />
            <MidiStatus />
            <UserMenu />
          </div>
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev -- --host 0.0.0.0`
1. Confirm a green dot appears in the header status row when online.
2. DevTools → Network → set to Offline → the dot goes grey; hovering shows "Offline — cached content only".
3. On a fresh load, confirm the transient "downloading built-ins N/473" label appears while the warm loop runs, then disappears.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConnectionStatus.tsx src/components/Rack.tsx
git commit -m "feat(pwa): online/offline + built-ins-download indicator"
```

---

### Task 9: nginx sw.js no-cache + full offline cold-launch verification

**Files:**
- Modify: `nginx.conf`

**Interfaces:**
- Consumes: everything above.
- Produces: correct cache headers for `sw.js` and a verified offline cold launch.

- [ ] **Step 1: Add the no-cache header for the service worker**

In `nginx.conf`, add a location block (place it before the `location = /index.html` block):
```nginx
  location = /sw.js {
    add_header Cache-Control "no-cache";
  }

  location = /manifest.webmanifest {
    add_header Cache-Control "no-cache";
  }
```
Rationale: the SW file must not be cached by the browser/CDN, or update checks never see a new worker. Hashed `/assets/` stay `immutable`; `index.html` stays `no-cache` (already present).

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass (smoke + vendoredUrls + warmVendored + useOnlineStatus).

- [ ] **Step 3: Type-check and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed; `dist/sw.js`, `dist/manifest.webmanifest`, and `dist/icons/*.png` present.

- [ ] **Step 4: Offline cold-launch verification (the core goal)**

Run: `npm run preview -- --host 0.0.0.0`
1. Load the app fully online; wait for the warm loop to finish (`module-vendored-v1` reaches ~473 entries; the "downloading built-ins" label clears).
2. Load one vendored patch and one CDN patch so both caches are populated.
3. DevTools → Network → **Offline**.
4. **Hard-reload the page.**

Expected:
- The app boots (no white screen) — shell served from the Workbox precache.
- The previously-loaded vendored patch plays — samples from `module-vendored-v1`.
- The previously-loaded CDN patch plays — samples from `module-cdn-v1` (loggedStorage).
- A fresh vendored patch not yet warmed may fail; a warmed one succeeds.

- [ ] **Step 5: Installability check**

In the same preview, DevTools → Application → Manifest: confirm no errors, all three icons load, and the "installable" criteria are met (Chrome shows an install affordance). Optionally run Lighthouse → PWA category.

- [ ] **Step 6: Commit**

```bash
git add nginx.conf
git commit -m "feat(pwa): no-cache headers for sw.js and manifest"
```

---

## Self-review notes

- **Spec coverage:** §1 SW/precache → Tasks 1,3; lazy vendored precache → Tasks 3,4,5,7; navigation fallback → Task 1; CDN passthrough → Task 3 + Global Constraints; §2 loggedStorage unchanged → enforced by Global Constraints (no task modifies it); §3 manifest/icons → Task 2; §4 update toast → Task 7; §5 online/offline + downloading indicator → Tasks 6,8; §6 dev/prod/nginx → Tasks 1 (devOptions), 9 (nginx). Testing section → Tasks 3,7,8,9 manual steps + Vitest units.
- **loggedStorage.ts is never edited** in any task — matches the spec's hard requirement.
- **Type consistency:** `warmProgress: { done; total } | null` and `setWarmProgress` are defined in Task 6 and consumed identically in Tasks 7 and 8; `warmVendored` signature defined in Task 5 and called with `{ urls, onProgress }` in Task 7; `toVendoredUrls` defined in Task 4 and used by the Task 4 plugin.
- **Deferred spec item:** manifest `orientation` is set to `portrait-primary` with a QA note to relax if landscape proves usable (spec flagged this as implementation-time).
