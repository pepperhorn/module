# Handoff: 0001-t5 — Review round 1 fixes (lead → impl)

- **Date:** 2026-11-27
- **Type:** dispatch (fix round)
- **Ledger:** 0001 · **Plan:** docs/plans/0001-keyboard.md (task T5)
- **Branch:** orch/0001-t5-drawers (continue from 65c2983) · **PR:** https://github.com/pepperhorn/module/pull/19
- **Review:** https://github.com/pepperhorn/module/pull/19#pullrequestreview-6084845714 (`gh pr view 19 --comments`)
- **Status:** open

## 1. Effects must be audible on the first action (blocking, AC7)
Today every effect starts off with its amount at 0. Turning it on does nothing, and raising the amount while it's off does nothing either.
- **Turning an effect on while its amount is 0** also sets a starting amount. You pick the value for each effect so it's clearly audible but tasteful (for example, around 0.3–0.4 mix), and record those values in your return handoff.
- **Raising the amount above 0 while the effect is off** turns it on.
- **Setting the amount to 0** leaves the on/off state alone.
- **One user action = one `setPrefs` call.** Don't make back-to-back `setEffect` calls that read the stale ref. Merge the `{ on, amount }` change into a single update.
- **Test in `Drawers.test.tsx`:** from fresh prefs, (a) toggling reverb on calls the engine with enabled=true and amount > 0 and writes a single pref update; (b) from fresh prefs, raising the delay amount enables delay; (c) both values survive a remount.

## 2. Playing the keys keeps the drawer open (Shaun's decision, 2026-11-27)
- Pointer, touch or keyboard input on the **playing surface** (the keys) doesn't close an open drawer, so a phone user can adjust an effect and play at the same time.
- Escape, the same bar button, and a tap or click elsewhere outside both the drawer and the keys still close it.
- Computer-key and MIDI playing never close it.
- **Tests:** a DOM test where a pointerdown on a key with Effects open leaves it open, and a pointerdown on the page outside the component closes it. Extend `widths.mjs` at 390 px: open Effects, tap a key, and assert the drawer is still visible.
- The spec has been updated to match (Sounds drawer / Layout, "Only one drawer is open at a time" bullet).

## Environment note
On this machine, `playwright-core` 1.65.1 needs a Chromium build that isn't cached. If `widths.mjs` or the smoke test fails to launch, run them with a playwright-core version that matches the cached Chromium (the reviewer used 1.65.0), installed outside the repo. Don't change the repo's dependencies. Say in the return handoff which version you used.

## Verify with
```bash
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build && npm run build:lib && npm run verify:lib && npm run build:keyboard && npm run verify:keyboard && node packages/keyboard/e2e/host-build.mjs && node packages/keyboard/e2e/widths.mjs
```
Run vitest under Node 22 and Node 26, and run the smoke test too.

Then run `orch-deslop` again, add a "Round 2" section to your return handoff, push to the same branch, refresh the PR screenshots if the UI changed, and reply on the PR with what changed.
