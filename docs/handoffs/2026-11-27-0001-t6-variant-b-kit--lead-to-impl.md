# Handoff: 0001-t6 — Swap in drumlet's variant-B kit (lead → impl)

- **Date:** 2026-11-27
- **Type:** dispatch
- **Ledger:** 0001 · **Spec:** docs/specs/0001-keyboard.md · **Plan:** docs/plans/0001-keyboard.md (task T6)
- **Branch:** orch/0001-t6-variant-b-kit · **Worktree:** created by T3
- **PR:** —
- **Base commit:** 89fca9a (T1 #16 and T2 #15 merged)
- **Port (if running a server):** —
- **Status:** open

## Goal
Replace the bundled `.ogg`-only acoustic kit with drumlet's approved variant-B kit (`.ogg` + `.m4a`, trimmed cymbal tails) so the Drums patch plays on Safari. Fold in three small review follow-ups that touch the same code. Done means the kit is swapped, the tests pass, the Verify command passes, and a draft PR is open.

## Context you need
- Plan task T6, plus its Global constraints, in docs/plans/0001-keyboard.md. Spec section "Drum asset" in docs/specs/0001-keyboard.md.
- The variant-B source is on drumlet `origin/main`: in `/home/shaun/drumlet`, run `git fetch origin` and read `public/samples/acoustic1/` at `origin/main`, which has 29 files (14 `.ogg`, 14 `.m4a` and `kit.json`, about 650 KB total). Don't edit the drumlet checkout: it holds other work. Use `git archive` or `git show origin/main:<path>` into a temp dir, then run `node packages/keyboard/scripts/copy-kit.mjs <tempdir>`.
- PR #15's review (https://github.com/pepperhorn/module/pull/15#pullrequestreview-6084149791) and PR #16's review (https://github.com/pepperhorn/module/pull/16#pullrequestreview-6084145042) are where the follow-ups below come from.

## Scope
- **In:**
  1. Swap `packages/keyboard/assets/drums/**` to variant B, both formats, using `copy-kit.mjs`.
  2. Read the drum formats from `kit.json` (its `formats` field) instead of hard-coding them in `bundled.ts`. If drumlet's `kit.json` has no such field, derive the formats from the files that are present.
  3. Delete the stopgap `BundledSamplerSource` type in `bundled.ts` and use the real sampler source type from `src/patches/types.ts` (T1 has merged).
  4. Pin the drumlet link in `packages/keyboard/assets/NOTICE` (or wherever the NOTICE lives) to the drumlet commit you copied from.
  5. In `src/audio/customSampler.ts`, codec-qualify the format probe: `FORMAT_TYPES` uses `audio/ogg; codecs="vorbis"` for ogg and `audio/mp4; codecs="mp4a.40.2"` for m4a, so a browser that knows the Ogg container but can't decode Vorbis falls back to `.m4a`. Add a test for it. Change nothing else in that file.
- **Out:** any other task's work; any other behaviour in `customSampler.ts`.
- **Files you own:** `packages/keyboard/assets/drums/**`, `packages/keyboard/assets/NOTICE*`, `packages/keyboard/src/patches/bundled.ts` and `bundled.test.ts`, `src/audio/customSampler.ts` (only the `FORMAT_TYPES` codec strings) and `src/audio/customSampler.test.ts`, plus your own handoff files for 0001-t6.
- **Do not touch:** everything else. In particular, T4 runs in parallel and owns the package scaffolding, `Keyboard*` and `TouchKeyboard`.

## Acceptance criteria
- [ ] Each format of the drum kit is about 330 KB or less; report the per-format totals
- [ ] The drums manifest lists both formats, read from `kit.json` or from the files present
- [ ] The existing drum map tests still pass, and every mapped sample exists in both formats
- [ ] The codec-qualified probe test passes
- [ ] If a cached Playwright WebKit is available, a WebKit smoke test decodes one `.m4a` drum sample. If it isn't, record "WebKit untested" in the return handoff.

## Verify with
```bash
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build
```

## Known gotchas / decisions already made
- Under host load, existing UI tests time out at 5 s, so use the timeout flags above.
- GBrain: `projects/drumlet` (variant B approved 2026-11-27), `projects/module`.

## Open questions
- None.

---
## Receiver ack

---
## Return
(write it in docs/handoffs/2026-11-27-0001-t6-variant-b-kit--<you>-to-lead.md)
