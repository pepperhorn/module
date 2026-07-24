# Offline-capable installable PWA for MODULE — Design

**Date:** 2026-07-23
**Status:** Approved, pending implementation plan
**Stack decision:** Stay on Vite/React; add `vite-plugin-pwa` (Workbox). Astro was
considered and rejected — its island/MPA model buys nothing for a monolithic,
always-on audio SPA with a single persistent `AudioContext` and no content routes,
and its PWA story is the same `vite-plugin-pwa`/Workbox engine anyway.

## Goal

Make MODULE an installable phone SPA that launches and plays offline. Users download
the sound libraries they want while online and use them offline. Today the app cannot
cold-launch offline (no service worker → `index.html` + JS bundle + fonts + vendored
samples all come from the network → white screen), even though CDN samples already
persist in a hand-rolled Cache API layer within a live session.

## Current state (as-is)

- **App shell:** ~1.5–2 MB (JS 314 KB + CSS 81 KB + Fontsource woff2 + html + favicon).
  Not cached for offline; served fresh from the server every launch.
- **Vendored samples:** 26 MB across 473 files under `public/smplr-samples/`
  (18 MB e-pianos, 8 MB VCSL). Fetched from same-origin `/smplr-samples/...`.
  `loggedStorage.ts` only writes CDN-tier responses to its cache, so vendored samples
  currently rely on the server being reachable and would fail offline.
- **CDN soundfonts** (`smpldsnds.github.io`, `gleitz.github.io`, `goldst.dev`):
  fetched on demand by `smplr` through `loggedStorage.ts`, which caches them in the
  `module-cdn-v1` Cache API and feeds source-tier badges (local/cache/cdn/mixed) to the
  debug panel and LCD.
- **Existing offline-adjacent state:** `useStore.ts` already tracks
  `downloaded: Set<string>` (persisted at `module:downloaded:v1`), `markDownloaded`,
  `unmarkDownloaded`, `downloadingPatchId`. `App.tsx` marks a patch downloaded once a
  successful active load populates the cache.
- **No** service worker, **no** web app manifest, **no** online/offline indicator.

## Key decisions

| Decision | Choice |
|---|---|
| Framework | Stay Vite/React + `vite-plugin-pwa` |
| Precache scope | Shell precached immediately; 26 MB vendored samples background-precached after first load; CDN libraries stay user-chosen downloads |
| Cache ownership | **Split**: SW owns same-origin only; `loggedStorage.ts` unchanged, keeps owning cross-origin CDN caching |
| Update UX | `registerType: 'prompt'` — non-intrusive "New version — Reload" toast; reload only on user action |
| Installability | Full: manifest + 192/512 + maskable icons generated from `favicon.svg` |
| Offline UI | Light: online/offline indicator + transient "downloading built-ins…" state; reuse existing `downloaded` set / source-tier badges for per-patch status |

## Architecture

### 1. Service worker — same-origin only (Workbox via `vite-plugin-pwa`)

- `VitePWA({ registerType: 'prompt', injectRegister: null, ... })` in `vite.config.ts`.
  Manual registration so the app controls the update toast.
- **Precache (immediate):** the build's app shell — hashed `/assets/` JS/CSS, Fontsource
  woff2, `index.html`, `favicon.svg`, manifest and icons. This is what turns a cold
  offline launch from a white screen into a booting app.
- **Navigation fallback:** offline SPA navigations resolve to precached `index.html`.
- **Vendored samples (26 MB) — lazy background precache:** deliberately excluded from the
  precache manifest (would bloat and block install). Instead:
  - A **runtime `CacheFirst` route** matching same-origin `/smplr-samples/` requests,
    into a dedicated runtime cache (e.g. `module-vendored-v1`).
  - A **post-load warm loop** started on `window` idle (`requestIdleCallback`, fallback
    `setTimeout`) after first paint. It walks a build-time-generated manifest of the 473
    vendored file paths and fetches them at low priority so the SW route populates the
    cache. Reports progress to the store for the "downloading built-ins…" indicator.
  - The vendored file manifest is produced at build time (e.g. a Vite virtual module or a
    small generated JSON) so it never drifts from what's actually in `public/smplr-samples/`.
- **Cross-origin CDN: not handled / `NetworkOnly`.** The SW must not cache
  `smpldsnds.github.io`, `gleitz.github.io`, `goldst.dev`. That domain stays 100% owned by
  `loggedStorage.ts`, avoiding a double-cache and preserving the source-tier stats.

### 2. `loggedStorage.ts` — unchanged

Remains the sole owner of CDN download/caching (`module-cdn-v1`) and the source-tier stats
that feed the debug/LCD badges. Its existing `local` tier for `/smplr-samples/` becomes
truly offline-capable for free: the SW serves those same-origin requests from
`module-vendored-v1`. **No code change in this file** — this is the payoff of split
ownership.

### 3. Web app manifest + icons

- `vite-plugin-pwa` `manifest` block:
  - `name: "MODULE"`, `short_name: "MODULE"`
  - `display: "standalone"`
  - `theme_color: "#FAFBFC"` (matches existing `<meta name="theme-color">`)
  - `background_color` (dark, matching the app's `#0F1024` boot background)
  - `orientation` (portrait-primary; confirm during implementation whether the instrument
    is usable landscape)
  - `start_url: "/"`, `scope: "/"`
- **Icons** generated from `public/favicon.svg`: `192×192`, `512×512`, and a `512×512`
  **maskable** variant. Produced by a small build script (`scripts/gen-icons.mjs`) or
  committed PNGs referenced by the manifest.

### 4. Update UX — prompt toast

- Use `virtual:pwa-register`'s `registerSW({ onNeedRefresh, onOfflineReady })`.
- `onNeedRefresh` (a waiting SW exists) → show a small **"New version — Reload"** toast
  (new lightweight `src/components/UpdateToast.tsx`). Calling the update function reloads
  and activates the new SW. Reload happens **only on tap** — never mid-performance.
- `onOfflineReady` → optional one-time "Ready to work offline" confirmation.

### 5. Light offline UI

- **Online/offline indicator:** `src/input/useOnlineStatus.ts` (or `src/state/`) hook
  driven by `navigator.onLine` + `online`/`offline` window events. Small dot/label near the
  existing status row alongside `MidiStatus`.
- **"Downloading built-ins…" state:** the warm loop reports progress
  (`done`/`total`) to the store; UI shows a subtle transient label while vendored precache
  runs, then goes quiet. New store fields for warm-loop progress.
- **Per-patch offline status:** reuse the existing `downloaded` set and source-tier badges.
  No new persistence.

### 6. Dev / prod / deploy

- `VitePWA({ devOptions: { enabled: true } })` so the SW can be exercised in dev.
- Production build emits `sw.js` + the Workbox precache manifest.
- **nginx:** add `location = /sw.js { add_header Cache-Control "no-cache"; }` so update
  checks aren't defeated by caching. `/assets/` `immutable` and `/index.html` `no-cache`
  are already correct. `/smplr-samples/` `expires 30d` remains fine (SW caches on top).

## Component / file inventory

| File | Change |
|---|---|
| `vite.config.ts` | Add `VitePWA(...)` plugin config (manifest, runtime caching for `/smplr-samples/`, `NetworkOnly` guard for CDN hosts, devOptions) |
| `src/main.tsx` | Register SW via `virtual:pwa-register`, wire `onNeedRefresh`/`onOfflineReady` |
| `src/components/UpdateToast.tsx` | New — update-available toast |
| `src/input/useOnlineStatus.ts` | New — online/offline hook |
| status row (near `MidiStatus`) | Add online/offline indicator + "downloading built-ins…" label |
| `src/state/useStore.ts` | Add warm-loop progress fields (done/total) and setters |
| warm-loop module (new, e.g. `src/audio/warmVendored.ts`) | Idle-triggered precache of vendored files from build-time manifest |
| vendored-manifest source (new, generated) | Build-time list of `public/smplr-samples/**` paths |
| `scripts/gen-icons.mjs` (or committed PNGs) | New — 192/512/maskable icons from `favicon.svg` |
| `nginx.conf` | Add `location = /sw.js` no-cache block |
| `loggedStorage.ts` | **Unchanged** |
| `index.html` | `vite-plugin-pwa` injects manifest link; existing white-screen handler stays |

## Testing

- **Cold offline launch:** build, serve, load once online, go offline, hard-reload →
  app shell boots (no white screen). Playwright offline emulation.
- **Vendored offline:** after the warm loop completes, a vendored patch resolves fully
  offline (all samples from `module-vendored-v1`, none failed).
- **CDN split ownership:** a CDN patch resolves via `loggedStorage` online and from
  `module-cdn-v1` when offline mid-session; SW does **not** create a duplicate cache entry
  for CDN hosts.
- **Update flow:** bump the build → `onNeedRefresh` fires → toast appears → tap → new SW
  activates and page reloads.
- **Manifest/install:** manifest validates; 192/512/maskable icons present; installability
  criteria satisfied (Lighthouse PWA / devtools Application panel).
- **Indicators:** toggling network flips the online/offline indicator; warm-loop progress
  label appears then clears.

## Out of scope (explicit)

- Rich download-manager UI, storage-quota display, remove-downloads UX.
- Precaching CDN libraries inside the service worker (stays with `loggedStorage.ts`).
- Any Astro migration.
- Landscape-specific layout work (only confirm the manifest `orientation` value).
