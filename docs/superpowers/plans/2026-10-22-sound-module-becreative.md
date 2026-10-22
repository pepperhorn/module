# Sound Module on becreative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put `@pepperhorn/sound-module` on becreative as a reusable island, first used on a new `/sound-module` page, with Web MIDI allowed on that page only.

**Architecture:** One React wrapper (`SoundModuleEmbed.tsx`) is the only file that imports the package; one Astro island (`SoundModuleIsland.astro`) is what pages drop in. A small Astro integration copies the package's CST patch audio into `public/patches/` on every `astro dev` / `astro build`, so it ships same-origin with `assetBaseUrl=""`. `security-headers.ts` gains an exported `MIDI_ENABLED_PATHS` list that switches `midi=()` to `midi=(self)`, and the report-only CSP gains the three sample CDNs.

**Tech Stack:** becreative: pnpm, Astro ^7.3.8 (`output: 'server'`, Node adapter), `@astrojs/react`, React 19, Tailwind v4, Vitest (node env, `tests/**/*.test.ts`).

**Spec:** `/home/shaun/module/docs/superpowers/specs/2026-10-22-embeddable-sound-module-design.md`, section "becreative integration" and "Release sequencing" milestone 2. The module package itself is built by a separate plan. This plan only consumes its contract (below).

## Global Constraints

- Repo: `/home/shaun/becreative`. Work in a **new worktree** on branch `feat/sound-module` off `master`: `git -C /home/shaun/becreative worktree add /home/shaun/becreative-sound-module -b feat/sound-module master`. The main checkout is on `feat/avatar-engine` with uncommitted work, so don't touch it. Don't base on the stale `feat/play-me` worktree (`/home/shaun/becreative-play-me`), which predates `security-headers.ts`. All paths below are relative to the new worktree.
- Package manager is **pnpm**. Tests: `pnpm run test:unit` (Vitest only) and `pnpm test` (Vitest + `node --test scripts/tests/*.test.ts`). Build: `pnpm run build`. Dev server: `pnpm exec astro dev --host 0.0.0.0` (user rule: always bind 0.0.0.0).
- Package contract (from the module plan, don't change it here):
  - npm package `@pepperhorn/sound-module`, named export `SoundModule` (and prop type `SoundModuleProps`) with props `{ assetBaseUrl?: string; theme?: 'dark' | 'light'; octaves?: number; className?: string }`. It's client-only.
  - CSS: `@pepperhorn/sound-module/styles.css` (required) and `@pepperhorn/sound-module/fonts.css` (opt-in; becreative imports it). **Load order matters:** the module's rules live in `sm-*` cascade layers, which only win if they are declared after becreative's `@layer ivories, theme, base, components, utilities;` in `global.css`. So `styles.css` must load after `global.css` on the page (importing it from the client-only island satisfies this; verify in the built page that `global.css` precedes it). Unlayered host element rules (e.g. `.s-scope h2`) still beat the module, hence the island sits outside `ContentPage`.
  - Host spacing/typography classes go on the island's wrapper `div`, not on `SoundModule`'s `className` (the module root sets its own typography and has no box reset).
  - CST audio ships at `node_modules/@pepperhorn/sound-module/dist/patches/**`. becreative serves it at `/patches/**` and passes `assetBaseUrl=""`.
- Until the package is on npm, the dependency is `"@pepperhorn/sound-module": "link:/home/shaun/module/packages/sound-module"` (the module plan builds the package in that subdirectory). The PR **merges only** once the dependency is a published npm version (`^0.1.0`). `master` never carries `link:`, because Docker builds can't resolve it.
- Permissions-Policy is `midi=(self)` **only** for canonical paths in `MIDI_ENABLED_PATHS`. Everywhere else stays `midi=()`. All other Permissions-Policy entries are unchanged on every path.
- Report-only CSP `connect-src` adds exactly `https://smpldsnds.github.io`, `https://gleitz.github.io`, `https://goldst.dev`. `media-src` is **not** changed: smplr loads samples with `fetch()` + `decodeAudioData` (connect-src), and CST patches are same-origin. The enforced CSP is unchanged.
- `/sound-module` must be rendered on demand, never `export const prerender = true`. Prerendered pages are served before middleware runs (`src/middleware.ts:296-303`), so they would get no security headers and no `midi=(self)`.
- becreative's styling rules (`CLAUDE.md`): no dark backgrounds, so the embed uses `theme="light"`. Page chrome uses `BaseLayout` fonts (Poppins headings, Geist body, already loaded). Poppins is not added inside the module, which keeps its own rack fonts via `fonts.css`.
- Every element gets a contextual class name alongside its Tailwind utilities, e.g. `class="sound-module-section mx-auto w-full ..."`.
- The patch copy step lives under `src/`, not `scripts/`, because `.dockerignore` excludes `scripts/` from the Docker build context.
- No nav link and no sitemap entry: `src/config/nav-links.ts` only lists Schedules and Sign In, there is no sitemap integration, and `/play-me` added neither.

## Review Focus

1. **Path variants:** `/sound-module/`, `//sound-module` and `/x/../sound-module` reach the page, and the middleware canonicalises them (`canonicalPath`, `src/lib/qc-mode.ts:143`), so they must get `midi=(self)`. Lookalikes (`/sound-module-x`, `/sound-module/extra`, `/play-me`) must stay `midi=()`. Test: Task 2.
2. **A MIDI path that skips middleware:** if `/sound-module`, or a future page added to `MIDI_ENABLED_PATHS`, is prerendered or doesn't exist, MIDI silently stays blocked. Test: Task 3 guard test.
3. **Host CSS leaking in:** `custom.css` `.s-scope :is(h1,h2,h3,h4,h5) { font-family: 'Poppins' }` (specificity 0,1,1) beats the module's scoped utilities (0,1,0), which would restyle `MidiPanel`'s `h2` and `PatchPicker`'s `h3`. So the island must sit outside `ContentPage` (which adds `.s-scope`). Test: Task 3 guard test (placement) and Task 4 computed-style check.
4. **Patch copy edge cases:** a package upgrade that drops or renames a patch must not leave stale files behind. A missing `dist/patches` (e.g. an unbuilt `link:` target) must fail the dev/build loudly rather than ship 404ing CST patches. Test: Task 1.
5. **Embed behaviour on the real page:** typing outside the module plays nothing. Host fonts and buttons elsewhere on the site are unchanged. No service worker is registered. The MIDI permission prompt appears on `/sound-module` and not on other pages. The Docker image serves `/patches/**`. Test: Task 4 checks.

---

### Task 1: Dependency and patch-audio sync

**Files:**
- Modify: `package.json` (add dependency next to `@pepperhorn/react-music-tools`, line 27), `pnpm-lock.yaml` (via `pnpm install`)
- Create: `src/integrations/sound-module-patches.ts`
- Modify: `astro.config.mjs` (import at top, add to `integrations` at line 82)
- Modify: `.gitignore` (add `public/patches/`)
- Test: `tests/sound-module-patches.test.ts`

**Interfaces:**
- Consumes: `node_modules/@pepperhorn/sound-module/dist/patches/**` (package contract).
- Produces:
  - `syncSoundModulePatches(sourceDir: string, destDir: string): number` copies the tree and returns the number of files copied. It throws `Error` (message includes `sourceDir` and `@pepperhorn/sound-module`) when `sourceDir` doesn't exist, and in that case doesn't touch `destDir`.
  - `soundModulePatches(): AstroIntegration` has name `'sound-module-patches'` and an `astro:config:setup` hook. Source: `path.join(fileURLToPath(config.root), 'node_modules/@pepperhorn/sound-module/dist/patches')`. Dest: `fileURLToPath(new URL('patches/', config.publicDir))`. It logs `copied N patch files` via the hook's `logger.info`.
  - At runtime, `/patches/<patch>/<file>` is served from becreative's own origin.

- [ ] **Step 1: Create the worktree and add the dependency**

Run: `git -C /home/shaun/becreative worktree add /home/shaun/becreative-sound-module -b feat/sound-module master && cd /home/shaun/becreative-sound-module && pnpm add @pepperhorn/sound-module@link:/home/shaun/module/packages/sound-module`
Expected: `package.json` has `"@pepperhorn/sound-module": "link:/home/shaun/module/packages/sound-module"`, and `ls node_modules/@pepperhorn/sound-module/dist/patches` lists `sine-key` and `poly-bass`. The module must be built first, so run its library build if `dist/` is missing.

- [ ] **Step 2: Write the failing tests** in `tests/sound-module-patches.test.ts` (use `fs.mkdtempSync(path.join(os.tmpdir(), 'smp-'))` per test)

```ts
it('copies the nested patch tree and returns the file count', () => {
  // source: sine-key/C4.wav, poly-bass/C2.wav, poly-bass/C3-a.wav
  expect(syncSoundModulePatches(src, dest)).toBe(3);
  expect(fs.readFileSync(path.join(dest, 'poly-bass/C3-a.wav'), 'utf8')).toBe('a');
});
it('removes files the package no longer ships', () => {
  // dest pre-seeded with old-patch/x.wav
  syncSoundModulePatches(src, dest);
  expect(fs.existsSync(path.join(dest, 'old-patch'))).toBe(false);
});
it('creates the destination when public/patches does not exist yet', () => {
  syncSoundModulePatches(src, path.join(tmp, 'public/patches'));
  expect(fs.existsSync(path.join(tmp, 'public/patches/sine-key/C4.wav'))).toBe(true);
});
it('throws, naming the package and path, when the source is missing, and leaves dest alone', () => {
  // dest pre-seeded with keep.wav
  expect(() => syncSoundModulePatches(path.join(tmp, 'nope'), dest)).toThrow(/@pepperhorn\/sound-module.*nope|nope.*@pepperhorn\/sound-module/s);
  expect(fs.existsSync(path.join(dest, 'keep.wav'))).toBe(true);
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm exec vitest run tests/sound-module-patches.test.ts`
Expected: FAIL. The module `../src/integrations/sound-module-patches` can't be resolved.

- [ ] **Step 4: Implement `src/integrations/sound-module-patches.ts`**

Check the source with `fs.existsSync` before touching anything. Then `fs.rmSync(destDir, { recursive: true, force: true })` and `fs.cpSync(sourceDir, destDir, { recursive: true, dereference: true })`. `dereference` matters because pnpm's `link:` makes `node_modules/@pepperhorn/sound-module` a symlink. Count files with `fs.readdirSync(destDir, { recursive: true, withFileTypes: true })`. The file header comment says: CST patch audio from the package is copied here on every dev/build, `public/patches/` is generated and gitignored, and it lives in `src/` because `.dockerignore` drops `scripts/`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm exec vitest run tests/sound-module-patches.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire it into Astro and ignore the output**

In `astro.config.mjs`, add `import { soundModulePatches } from './src/integrations/sound-module-patches.ts';` and change line 82 to `integrations: [devEnvFiles, soundModulePatches(), icon(), react()],`. Add `public/patches/` to `.gitignore` under `# build output`.
Run: `pnpm run build && ls dist/client/patches/sine-key && git status --short public`
Expected: the build log contains `copied 10 patch files` (or the package's current count), the `ls` lists `.wav` files, and `git status` shows nothing under `public/`.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs .gitignore src/integrations/sound-module-patches.ts tests/sound-module-patches.test.ts
git commit -m "feat(sound-module): add package (link) and copy its CST patches into public/patches"
```

---

### Task 2: Per-path MIDI permission and sample CDNs in the report-only CSP

**Files:**
- Modify: `src/lib/security-headers.ts`: `THIRD_PARTY` (lines 31-42), `connect-src` (line 116), `PERMISSIONS_POLICY` (lines 127-140), `securityHeadersFor` (line 168)
- Test: `tests/security-headers.test.ts` (extend; it already imports from `../src/lib/security-headers`)

**Interfaces:**
- Consumes: `canonicalPath(raw: string): string` from `src/lib/qc-mode.ts` (tests only; the middleware already passes the canonical path at `src/middleware.ts:301`).
- Produces:
  - `export const MIDI_ENABLED_PATHS: readonly string[] = ['/sound-module']` holds canonical paths (leading slash, no trailing slash), matched exactly.
  - `export function permissionsPolicyFor(pathname: string): string` returns `PERMISSIONS_POLICY` with `midi=()` replaced by `midi=(self)` when `MIDI_ENABLED_PATHS.includes(pathname)`. Otherwise it returns `PERMISSIONS_POLICY` unchanged.
  - `THIRD_PARTY.sampleCdns: ['https://smpldsnds.github.io', 'https://gleitz.github.io', 'https://goldst.dev']`.
  - `securityHeadersFor(...)['Permissions-Policy']` becomes `permissionsPolicyFor(pathname)`. `PERMISSIONS_POLICY` stays exported and unchanged.

- [ ] **Step 1: Write the failing tests** (add `permissionsPolicyFor` and `MIDI_ENABLED_PATHS` to the import, plus `import { canonicalPath } from '../src/lib/qc-mode'`)

```ts
describe('Permissions-Policy midi', () => {
  it('allows Web MIDI for self on /sound-module only', () => {
    const p = securityHeadersFor(req(), '/sound-module', prod)['Permissions-Policy'];
    expect(p).toContain('midi=(self)');
    expect(p).not.toContain('midi=()');
    expect(p).toContain('camera=()');
    expect(p).toContain('microphone=()');
    expect(MIDI_ENABLED_PATHS).toContain('/sound-module');
  });
  it('keeps midi=() everywhere else, including lookalike paths', () => {
    for (const path of ['/', '/family/info', '/play-me', '/sound-module-x', '/sound-module/extra', '/Sound-Module']) {
      expect(permissionsPolicyFor(path)).toContain('midi=()');
      expect(permissionsPolicyFor(path)).not.toContain('midi=(self)');
    }
  });
  it('matches the canonical path the middleware passes in', () => {
    for (const raw of ['/sound-module/', '//sound-module', '/x/../sound-module', '/sound%2Dmodule']) {
      expect(permissionsPolicyFor(canonicalPath(raw))).toContain('midi=(self)');
    }
  });
  it('changes nothing but midi', () => {
    expect(permissionsPolicyFor('/sound-module').replace('midi=(self)', 'midi=()')).toBe(permissionsPolicyFor('/'));
  });
});
```

In `describe('buildReportOnlyCsp')`, add:

```ts
it('lets the sound module fetch samples from its CDNs', () => {
  expect(directive(csp, 'connect-src')).toEqual(
    expect.arrayContaining(['https://smpldsnds.github.io', 'https://gleitz.github.io', 'https://goldst.dev']),
  );
  expect(directive(csp, 'media-src')).not.toContain('https://smpldsnds.github.io');
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm exec vitest run tests/security-headers.test.ts`
Expected: FAIL. `permissionsPolicyFor` isn't exported, and `connect-src` lacks the CDNs.

- [ ] **Step 3: Implement it in `src/lib/security-headers.ts`**

Add `sampleCdns` to `THIRD_PARTY` with the comment `/** @pepperhorn/sound-module (smplr) sample CDNs, fetched with fetch(). */`. Spread it into `connect-src` (line 116). Add `MIDI_ENABLED_PATHS` and `permissionsPolicyFor` directly below `PERMISSIONS_POLICY`, with this doc comment: `Pages that embed <SoundModuleIsland /> (src/components/sound-module/) and need Web MIDI. Canonical paths, exact match. Each must be an on-demand (not prerendered) page or middleware never sends this header.` Use `permissionsPolicyFor(pathname)` at line 168.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm run test:unit`
Expected: PASS, with the existing `securityHeadersFor` / `applySecurityHeaders` tests unchanged and green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/security-headers.ts tests/security-headers.test.ts
git commit -m "feat(security): midi=(self) on MIDI_ENABLED_PATHS; sample CDNs in report-only connect-src"
```

---

### Task 3: Reusable island and the /sound-module page

**Files:**
- Create: `src/components/sound-module/SoundModuleEmbed.tsx`
- Create: `src/components/sound-module/SoundModuleIsland.astro`
- Create: `src/pages/sound-module.astro`
- Test: `tests/sound-module-page.test.ts`

**Interfaces:**
- Consumes: `SoundModule`, `SoundModuleProps` from `@pepperhorn/sound-module`; `MIDI_ENABLED_PATHS` (Task 2); `cn` from `@/lib/utils`; `BaseLayout` (`@/layouts/BaseLayout.astro`, props `title`, `description`, `crumbs`); `ContentPage` (`accent`, `class`); `ContentHero` (`eyebrow`, `title`, `intro`, `class`); `/patches/**` served by Task 1.
- Produces:
  - `export default function SoundModuleEmbed(props: { octaves?: number; className?: string }): JSX.Element` renders `<SoundModule assetBaseUrl="" theme="light" octaves={octaves} className={cn('sound-module-embed', className)} />` (`className` here is a hook only — layout classes belong on the island wrapper). It imports `@pepperhorn/sound-module/styles.css` and `@pepperhorn/sound-module/fonts.css`. No other becreative file imports the package.
  - `SoundModuleIsland.astro` has props `{ octaves?: number; class?: string }`. It renders `<SoundModuleEmbed client:only="react" …>` with a `slot="fallback"` loading box and a `<noscript>`.

- [ ] **Step 1: Write the failing guard test** `tests/sound-module-page.test.ts` (reads source files with `fs`, paths relative to `process.cwd()`)

```ts
it('serves every MIDI-enabled path from an on-demand page that uses the island', () => {
  for (const p of MIDI_ENABLED_PATHS) {
    const file = [`src/pages${p}.astro`, `src/pages${p}/index.astro`].find((f) => fs.existsSync(f));
    expect(file, `no page for ${p}`).toBeDefined();
    const src = fs.readFileSync(file!, 'utf8');
    expect(src).not.toMatch(/export\s+const\s+prerender\s*=\s*true/);
    expect(src).toContain('<SoundModuleIsland');
  }
});
it('hydrates client-only with a fallback and a noscript', () => {
  const island = fs.readFileSync('src/components/sound-module/SoundModuleIsland.astro', 'utf8');
  expect(island).toContain('client:only="react"');
  expect(island).toContain('slot="fallback"');
  expect(island).toContain('<noscript>');
});
it('keeps the island outside ContentPage (.s-scope restyles headings)', () => {
  const page = fs.readFileSync('src/pages/sound-module.astro', 'utf8');
  expect(page.indexOf('<SoundModuleIsland')).toBeGreaterThan(page.indexOf('</ContentPage>'));
});
it('only SoundModuleEmbed imports the package', () => {
  // walk src/ recursively; collect files whose text contains "@pepperhorn/sound-module"
  expect(importers).toEqual(['src/components/sound-module/SoundModuleEmbed.tsx']);
});
```

The last test must skip `src/integrations/sound-module-patches.ts`, which names the package path but doesn't import it. Match `from '@pepperhorn/sound-module` and `import '@pepperhorn/sound-module` only.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm exec vitest run tests/sound-module-page.test.ts`
Expected: FAIL with `no page for /sound-module`.

- [ ] **Step 3: Implement `SoundModuleEmbed.tsx`**

Follow the `ScoreEmbed.tsx` pattern: CSS imports at the top and a doc comment. The comment says this is the only place becreative touches the package, it's mounted by `SoundModuleIsland.astro`, `theme="light"` follows becreative's no-dark-backgrounds rule, `assetBaseUrl=""` means CST patches load from `/patches/` (copied by `src/integrations/sound-module-patches.ts`), and new pages should use the island, not this file directly.

- [ ] **Step 4: Implement `SoundModuleIsland.astro`**

Base it on `/home/shaun/becreative-play-me/src/pages/play-me.astro` lines 25-32. Frontmatter doc comment (exact text):

```
/**
 * Drop-in sound module (computer keyboard, MIDI keyboard, wind controller):
 *   <SoundModuleIsland />
 * One per page: the package's engine and store are singletons.
 * Web MIDI is blocked site-wide by Permissions-Policy `midi=()`. To use this on
 * another page, add that page's path to MIDI_ENABLED_PATHS in
 * src/lib/security-headers.ts, keep the page on-demand (no `prerender = true`;
 * prerendered pages skip middleware and get no headers), and render it outside
 * <ContentPage> (its .s-scope heading font overrides the module's).
 */
```

Markup: `<div class:list={['sound-module-island w-full min-w-0', className]}>` containing `<SoundModuleEmbed client:only="react" octaves={octaves}>`, which wraps `<p slot="fallback" class="sound-module-loading flex min-h-48 items-center justify-center m-0 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500" role="status">Loading the sound module…</p>`. Follow it with `<noscript><p class="sound-module-noscript …">The sound module needs JavaScript. MIDI keyboards and wind controllers also need Chrome or Edge.</p></noscript>`.

- [ ] **Step 5: Implement `src/pages/sound-module.astro`**

No `prerender` export. `BaseLayout` props: `title="Sound module"`, `description="Play instrument sounds in your browser from your computer keyboard, a MIDI keyboard or a wind controller."`, `crumbs={[{ label: 'Home', href: '/' }, { label: 'Sound module' }]}`. Body:

```astro
<div class="sound-module-page w-full min-w-0">
  <ContentPage class="sound-module-intro" accent="blue">
    <ContentHero class="sound-module-hero s-stagger" style="--i: 0" eyebrow="Play" title="Sound module"
      intro="Pick a sound and play it from your computer keyboard, a MIDI keyboard or a wind controller. Click the module first, then press the letters shown on the piano keys." />
  </ContentPage>
  <section class="sound-module-section mx-auto w-full max-w-[1200px] pb-12">
    <SoundModuleIsland />
    <p class="sound-module-tip mt-6 max-w-[68ch] text-sm leading-relaxed text-slate-500">
      Z and X move up or down an octave, C and V play softer or harder, and Esc stops every note.
      MIDI keyboards and wind controllers work in Chrome and Edge: press the MIDI button and allow access when your browser asks.
    </p>
  </section>
</div>
```

`ContentPage` adds `padding-bottom: 3rem`. If the gap between the hero and the module looks too big, override it with `class="sound-module-intro pb-0"`.

- [ ] **Step 6: Run the tests and the build and confirm they pass**

Run: `pnpm run test:unit && pnpm run build`
Expected: all Vitest suites pass. The build succeeds with no type or resolve errors for `@pepperhorn/sound-module`, and `dist/server` contains a route for `/sound-module` (not under `dist/client/sound-module/index.html`).

- [ ] **Step 7: Commit**

```bash
git add src/components/sound-module src/pages/sound-module.astro tests/sound-module-page.test.ts
git commit -m "feat(sound-module): reusable SoundModuleIsland and /sound-module page"
```

---

### Task 4: Verify in the browser, switch to the npm release, open the PR

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (switch `link:` to the published version)

**Interfaces:**
- Consumes: everything above; published `@pepperhorn/sound-module@0.1.0` (milestone 1 of the spec).
- Produces: a PR from `feat/sound-module` to `master` that is mergeable without `link:`.

- [ ] **Step 1: Check headers on the running server**

Run: `pnpm run build && pnpm run start &` then `curl -sI http://localhost:4321/sound-module | grep -i permissions-policy` and `curl -sI http://localhost:4321/ | grep -i permissions-policy`
Expected: `midi=(self)` on the first and `midi=()` on the second. `curl -sI http://localhost:4321/patches/sine-key/<a file from dist/client/patches/sine-key>` returns `200`.

- [ ] **Step 2: Check behaviour in the browser** (`pnpm exec astro dev --host 0.0.0.0`, Chrome, `/sound-module`). Each item passes or fails:
  - The light-theme module renders under the hero. The fallback shows briefly. Disabling JS shows the noscript text.
  - Click the module, then `A`: a note plays and the "keys on" indicator shows. Click page text outside the module and type `A S D`: nothing plays. Click the header music-tools metronome and type in it: nothing plays.
  - `Z`/`X` move the letter labels on the piano by an octave.
  - Browse lists the CST patches. Selecting `sine-key` plays, and DevTools Network shows `/patches/sine-key/…` from the same origin with status 200.
  - The MIDI pill triggers Chrome's MIDI permission prompt. On `/` (or any other page), `navigator.requestMIDIAccess()` in the console rejects with a permissions-policy error.
  - In DevTools, the computed `font-family` of the MIDI panel `h2` (`.midi-panel-title`) is the module's display font, not Poppins.
  - Application → Service Workers shows none for the origin. On `/` and `/library`, header and button fonts look the same as on `master`.
  - The console shows no CSP report-only violations for `smpldsnds.github.io`, `gleitz.github.io` or `goldst.dev` while loading two built-in patches.

- [ ] **Step 3: Commit any fixes** from Step 2 to the file that owns them, with a test where one applies (e.g. a header case goes to Task 2's test file).

- [ ] **Step 4: Switch to the published package** (only after milestone 1 has published `v0.1.0` to npm)

Run: `pnpm add @pepperhorn/sound-module@^0.1.0 && grep sound-module package.json && pnpm test && pnpm run build`
Expected: `"@pepperhorn/sound-module": "^0.1.0"`, no `link:` in `package.json` or `pnpm-lock.yaml` (`grep -c "link:/home/shaun/module" pnpm-lock.yaml` prints `0`), tests pass, and the build logs `copied N patch files`.

- [ ] **Step 5: Docker build check**

Run: `docker build -t becreative-sound-module . && docker run --rm becreative-sound-module ls dist/client/patches`
Expected: lists `sine-key` and `poly-bass`. Run this without `DIRECTUS_ADMIN_TOKEN`. If prerendered library pages need the secret, pass `--secret id=DIRECTUS_ADMIN_TOKEN,env=DIRECTUS_ADMIN_TOKEN` as in the `Dockerfile` comment.

- [ ] **Step 6: Commit and open the PR**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(sound-module): depend on published @pepperhorn/sound-module ^0.1.0"
git push -u origin feat/sound-module
gh pr create --base master --title "feat: sound module island and /sound-module page" --body "<summary; header change: midi=(self) on MIDI_ENABLED_PATHS only; report-only connect-src + 3 sample CDNs; Step 2 checklist results>"
```
