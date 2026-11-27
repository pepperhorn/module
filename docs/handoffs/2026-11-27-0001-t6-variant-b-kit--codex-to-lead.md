# Handoff: 0001-t6 — Variant-B acoustic kit (Codex → lead)

- Date: 2026-11-27
- Type: return
- Ledger: 0001-t6 · [Spec](../specs/0001-keyboard.md) · [Plan](../plans/0001-keyboard.md#t6--swap-in-drumlets-variant-b-kit-ogg--m4a) · [Dispatch](2026-11-27-0001-t6-variant-b-kit--lead-to-impl.md)
- Branch: `orch/0001-t6-variant-b-kit`
- Worktree: `/home/shaun/.t3/worktrees/module/t3-79a44b62-3e2dec6aab2bd213`
- PR: [Draft by branch](https://github.com/pepperhorn/module/pulls?q=is%3Apr+head%3Aorch%2F0001-t6-variant-b-kit), created after this commit
- Base commit: `89fca9a` (required ancestor), dispatched from `9cd9db5`
- Commits: `b5e39bb` (ack), `204d988a0b676b29982168886e166946d1166ccd` (implementation)
- Outcome: done, ready for lead review

## Goal and scope

Replace the Ogg-only kit with Drumlet variant B and distinguish Vorbis from AAC in the sampler probe. The diff is limited to `packages/keyboard/assets/drums/**`, its `NOTICE`, `bundled.ts` and `bundled.test.ts`, `customSampler.ts` (two MIME strings) and `customSampler.test.ts`, and these two handoffs. The GM map, piano assets, and T4 scaffolding are unchanged.

## Acceptance

- `copy-kit.mjs` copied 14 Ogg files (334,932 bytes) and 14 M4A files (313,439 bytes). All 28 files match [Drumlet `cb8edd66`](https://github.com/pepperhorn/drumlet/tree/cb8edd66e5a56a66f347ea68ee2681ea49307a05/public/samples/acoustic1) byte for byte. The parsed `kit.json` also matches.
- Drums use the `kit.json` format order, Ogg then M4A, and the sampler variant of the shared `PatchSource` type. The existing GM map tests pass and the manifest test checks every mapped sample in both formats.
- The regression test models a browser that recognizes Ogg but cannot play Vorbis. It fetched `.ogg` before the change and `.m4a` after it.
- Cached Playwright WebKit 26.6 (Linux) decoded `acoustic-Kick.m4a` via `AudioContext.decodeAudioData` to 95,522 mono frames (2.166 s). This tests AAC decoding. The fallback branch is covered by the unit test, as this WebKit also reports Vorbis support. No Apple device was tested.

## Verification

```bash
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build
```

```text
> tsc --noEmit
 Test Files  29 passed (29)
      Tests  232 passed (232)
> tsc -b && vite build
✓ built in 516ms
PWA v1.3.0
mode      generateSW
precache  102 entries (1630.02 KiB)
files generated
  dist/sw.js
```

`orch-deslop` removed repeated MIME literals from the tests. The full verify command passed again and `git diff --check main...HEAD` passed.

## Decisions and follow-ups

- The source manifest already declares both formats, so the patch needs no discovery fallback. `NOTICE` pins the fetched Drumlet commit used for the copy.
- GBrain `[default:projects/drumlet]` confirmed the upstream repo and checkout. No Module project page was found. The approved spec and dispatch establish the variant choice.
- No open questions. The lead owns review and merge. Keep the codec-qualified probe lesson for GBrain if useful: container recognition alone does not establish codec support.
