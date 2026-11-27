# Handoff: 0001-t4 — Review round 1 fixes (lead → impl)

- **Date:** 2026-11-27
- **Type:** dispatch (fix round)
- **Ledger:** 0001 · **Plan:** docs/plans/0001-keyboard.md (task T4)
- **Branch:** orch/0001-t4-keyboard-surface (continue from 437de50) · **PR:** https://github.com/pepperhorn/module/pull/18
- **Review:** https://github.com/pepperhorn/module/pull/18#pullrequestreview-6084571572 (`gh pr view 18 --comments`)
- **Status:** open

Address all five blocking findings.

## 1. Bundled samples in host production builds (lead decision: fix it properly)
- **Ownership grows.** T6 has merged, so you now own `packages/keyboard/src/patches/bundled.ts` and `bundled.test.ts`, plus `packages/keyboard/scripts/**` if you need a generator. Keep `bundled.ts`'s exported names and signatures.
- **Make every sample URL statically traceable.** Each sample file gets its own literal `new URL('<relative path to file>', import.meta.url)`, generated from the piano note index and `kit.json`. For example, generate `packages/keyboard/src/patches/assetUrls.generated.ts`, or emit it at lib build time. Host bundlers (Vite and Rollup, which Astro uses) then copy each file and rewrite its URL. A directory URL plus string concatenation can't be traced, and that's the bug. If `customSampler` only accepts `baseUrl` + relative names, give the sampler manifest absolute per-file URLs as the sample entries, with an empty `baseUrl`. Check `joinUrl` handles that. Don't edit `src/audio/customSampler.ts`; if it truly can't take absolute URLs, stop and report.
- **`assetBaseUrl` still overrides** everything for hosts that self-host the files.
- **Add a regression check:** `packages/keyboard/e2e/host-build.mjs`. It packs the built lib (`npm pack` or a file: dependency into a temp dir), builds a minimal Vite host app in **production** mode that imports `@pepperhorn/keyboard`, then asserts that every piano and drum sample in both formats appears in the host's output and that the URLs referenced in the built JS resolve to those emitted files. Add it to `verify:keyboard`, or document it as a separate script named in the PR, and paste its output.
- **If Vite can't trace the URLs from a dependency at all**, stop and report with evidence. The documented copy-plus-`assetBaseUrl` route becomes the fallback, and I'll decide.

## 2. Enable-audio overlay
- The power-on overlay must cover the keyboard (`position:absolute; inset:0` within a positioned `kb-root`). Don't rely on a Tailwind class the CSS build never generates: check `styles.css` contains it, or use scoped plain CSS.
- Add a test (DOM or Playwright) that the overlay's box covers the surface while `needsGesture` is true.

## 3. Storage tests on Node ≥ 25
- Replace the `localStorage` stubbing with the in-memory stub pattern from `src/state/useTheme.test.ts`. The tests must pass on Node 22 (CI) **and** on this machine's default Node 26.

## 4. Don't persist prop defaults
- Prefs are written only when the user changes something. A prop value such as `accidentals` or `showNoteNames` used as an initial default is never saved.
- Test: mount with `showNoteNames` and `accidentals="sharp"`, and assert nothing is written. Toggle names, and assert only that change is written. Remount with different props, and assert the saved user choice still wins and an unchanged pref follows the new props.

## 5. `useChordPlayer` accidentals
- `useChordPlayer` takes `accidentals: Accidentals` and uses it for `lit` names.
- `Keyboard` must use this same public hook. Delete the internal duplicate, so T5 and `Keyboard` share one path.
- Test: with sharps, C♯ maj gives `C♯ E♯ G♯`; with flats, D♭ maj gives `D♭ F A♭`.

## Verify with
```bash
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build && npm run build:lib && npm run verify:lib && npm run build:keyboard && npm run verify:keyboard && node packages/keyboard/e2e/host-build.mjs
```
Run the vitest step under Node 22 and the default Node 26.

Then run `orch-deslop` again, update your return handoff (add a "Round 2" section), push to the same branch, and reply on the PR with what changed.
