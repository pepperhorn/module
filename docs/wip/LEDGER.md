# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked
> Waiting on: `child <taskId>` · `review <taskId>` · `ci` · `human: <why>` · `lead: <next action>`. Set it on every status change. A row needs the lead when it starts with `lead`, or when it's empty and Status is dispatched, in-review, changes-requested, ready, or merged. The lead's Stop hook won't let the lead end its turn while any row needs it.
> Type: normal items have a spec and plan. Quick items have the title prefix `[quick]` (no spec or plan, a short handoff). PRs adopted by `orch-sweep` have the prefix `[pr]`.

Next ID: 0004

## Active

| K | Title | Status | Waiting on | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0003 | [quick] Keyboard release job (trusted publishing) | dispatched | child node:delegated-task:command%3Amcp%3A04e398fd-f9eb-4c8c-a6e1-0a49038d440b%3Adelegate-task%3A0003-impl-r1 | codex/gpt-6.2-sol | orch/0003-keyboard-release |  |  | node:delegated-task:command%3Amcp%3A04e398fd-f9eb-4c8c-a6e1-0a49038d440b%3Adelegate-task%3A0003-impl-r1 / thread:delegated-task:command%3Amcp%3A04e398fd-f9eb-4c8c-a6e1-0a49038d440b%3Adelegate-task%3A0003-impl-r1 |  |  | docs/handoffs/2026-11-28-0003-keyboard-release--lead-to-impl.md | 2026-11-28 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|
| 0002 | [quick] Bump @pepperhorn/keyboard to 0.1.1 | https://github.com/pepperhorn/module/pull/20 | 2026-11-28 8e46c96 | review r1 approve (opus) @ d9f7fa8; 0.1.0 was already live; Shaun chose to publish 0.1.1 anyway |
| 0001-t5 | Keyboard T5: drawers, MIDI, responsive | https://github.com/pepperhorn/module/pull/19 | 2026-11-27 68fa3cd | review r1 changes-requested, r2 approve (opus) @ 881d692; keys keep drawers open (Shaun) |
| 0001-t4 | Keyboard T4: package + Keyboard surface | https://github.com/pepperhorn/module/pull/18 | 2026-11-27 f79eda6 | review r1 changes-requested, r2 approve (opus) @ 3f90c73; keyboard-local engine/MIDI/keys; host prod build check |
| 0001-t6 | Keyboard T6: variant-B acoustic kit, codec-qualified probe | https://github.com/pepperhorn/module/pull/17 | 2026-11-27 b9de5bc | review r1 approve (opus) @ b41f265; ogg 335 KB / m4a 313 KB; WebKit decoded AAC, no Apple device tested |
| 0001-t3 | Keyboard T3: chord theory + spelling | https://github.com/pepperhorn/module/pull/14 | 2026-11-27 f5e6d85 | review r1 approve (codex gpt-6.2-sol) @ 19a6bb6 |
| 0001-t1 | Keyboard T1: sampler opt-ins | https://github.com/pepperhorn/module/pull/16 | 2026-11-27 c70aa6a | review r1 approve (opus) @ 6b692fd; Shaun approved merging all 0001 PRs |
| 0001-t2 | Keyboard T2: bundled piano + kit, GM drum map | https://github.com/pepperhorn/module/pull/15 | 2026-11-27 89fca9a | review r1 approve (opus) @ 5952fb1; piano 369 KB ogg / 470 KB m4a |

## Suggestions

> Lead-curated ideas: next steps, improvements, code efficiencies, stack changes, risks. Each needs evidence (file:line, a measurement, or a link). Status: `new` · `accepted → NNNN` · `declined: <why>` · `done`. Keep declined rows so they aren't suggested again. A PR mentioned here isn't tracked: only the PR column of Active or Done rows counts.

| S | Kind | Suggestion | Evidence | Effort (S/M/L) | Value | Source | Status |
|---|---|---|---|---|---|---|---|
| S7 | efficiency | Remove or fix the engine's `setEffect`/`setEffectEnabled`/`setEffectAmount`, which no drawer calls any more and which still use the stale-ref pattern | PR #19 review 6085513878; packages/keyboard/src/engine/useKeyboardEngine.ts:104-113 | S | low | reviewer | new |
| S8 | improvement | Dim an effect's amount slider while that effect is off | PR #19 reviews r1+r2 | S | low (UI polish; Shaun's call) | reviewer | new |
| S9 | risk | `useDrawer.ts:38` treats keys of any keyboard on the page as "keys"; only matters if two keyboards share a page, which the one-engine limit already rules out | PR #19 review 6085513878 | S | low | reviewer | new |
| S4 | risk | A host that raises Vite's `build.assetsInlineLimit` above about 6.7 KB gets `data:` URLs for the smallest drum samples, and the sampler's `joinUrl` doesn't treat `data:` as absolute, so those samples break | PR #18 review 6084684226 | S | low (default limit is 4 KB) | reviewer | new |
| S5 | improvement | Run the keyboard Chromium smoke test (`packages/keyboard/e2e/smoke.*`) and `host-build.mjs` in CI; today only local verify covers the overlay and the host build | PR #18 review 6084684226 | S | medium | reviewer | new |
| S6 | efficiency | `bundled.ts` repeats the sampler's audio-format detection; share one helper | PR #18 review 6084684226 | S | low | reviewer | new |
| S3 | efficiency | The piano patch hard-codes its formats in `bundled.ts`; derive them from its generated note index the way the drums now read `kit.json` | PR #17 review 6084444614, packages/keyboard/src/patches/bundled.ts:20 | S | low (consistency) | reviewer | new |
| S1 | risk | The app's instrument cache is keyed by sampler `baseUrl` only, so two sampler patches sharing a baseUrl but with different oneShot/exactOnly settings would share one instance | PR #16 review 6084145042 | S | low today (bundled patches use different baseUrls) | reviewer | new |
| S2 | fix | `new Audio()` in the sampler's format probe isn't guarded outside the browser; a patch with `formats` fails to load under SSR or Node | PR #16 review 6084145042 | S | low (the package is client-only) | reviewer | new |

Last health scan: never

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
2026-11-28 0003 →dispatched, codex gpt-6.2-sol (high) — Shaun asked for the keyboard trusted-publishing PR (CI change: merge needs his OK)
2026-11-28 0002 ready→merged→closed — #20 8e46c96; keyboard dist verify OK; npm publish of 0.1.1 needs Shaun's browser 2FA
2026-11-28 0002 in-review→ready — r1 approve (opus) @ d9f7fa8; but npm shows 0.1.0 published 05:09:38Z (shasum 219369cb = main build), so the bump may be moot; asked Shaun
2026-11-28 0002 dispatched→in-review — PR #20 @ d9f7fa8; review r1 claude-opus-5-5 (high)
2026-11-28 0002 delegated codex gpt-6.2-sol (high) — npm 409 on 0.1.0 (previously staged, none pending); Shaun approved bump to 0.1.1
2026-11-27 0001 complete — all six tasks merged; main @ 68fa3cd full verify green (285 tests, app, sound-module lib, keyboard dist, host prod build). Next: Shaun publishes @pepperhorn/keyboard 0.1.0; becreative integration is a follow-up there
2026-11-27 0001-t5 →merged→closed — #19 68fa3cd
2026-11-27 0001-t5 changes-requested→in-review — fixes @ 881d692 (285 tests Node 22+26); review r2 claude-opus-5-5
2026-11-27 0001-t5 implementer resumed for fix round 2 @ 48fbc5b
2026-11-27 0001-t5 in-review→changes-requested — review r1 (opus) @ 65c2983: effects inaudible on first action. Shaun: playing keys keeps drawers open (spec updated)
2026-11-27 0001-t5 dispatched→in-review — PR #19 @ 65c2983 (281 tests Node 22+26; widths 360/390/1280 clean); review r1 claude-opus-5-5
2026-11-27 0001-t5 delegated — codex gpt-6.2-sol impl r1
2026-11-27 0001-t5 planned→dispatched — base f79eda6
2026-11-27 0001-t4 →merged→closed — #18 f79eda6; main full verify green (277 tests, both libs, keyboard dist)
2026-11-27 0001-t4 changes-requested→in-review — fixes @ 3f90c73 (277 tests on Node 22+26, host prod build emits all 60 samples); review r2 claude-opus-5-5
2026-11-27 0001-t4 implementer resumed for fix round 2 @ b55eeb5
2026-11-27 0001-t4 in-review→changes-requested — review r1 (opus) @ 437de50: 5 blockers (host prod build drops samples; overlay unpositioned; Node≥25 storage tests; props persisted; useChordPlayer flats-only). Lead: fix assets properly, T4 now owns bundled.ts
2026-11-27 0001-t4 dispatched→in-review — PR #18 @ 437de50 (271 tests, Chromium smoke clean); review r1 claude-opus-5-5
2026-11-27 0001-t6 →merged→closed — #17 b9de5bc; main verify green (257 tests)
2026-11-27 0001-t6 dispatched→in-review — PR #17 @ b41f265 (ogg 335 KB / m4a 313 KB; WebKit decoded AAC); review r1 claude-opus-5-5
2026-11-27 0001-t4 blocked→dispatched — implementer resumed with answers @ 7afe88f
2026-11-27 0001-t4 dispatched→blocked — useSoundEngine/useComputerKeyboard/useWebMidi write module:state:v1 and bypass chord routing; lead decided keyboard-local engine adapter (answers handoff)
2026-11-27 0001-t4 delegated — codex gpt-6.2-sol impl r1
2026-11-27 0001-t4 planned→dispatched — base f5e6d85
2026-11-27 0001-t3 →merged→closed — #14 f5e6d85; main verify green (256 tests)
2026-11-27 0001-t6 delegated — codex gpt-6.2-sol impl r1
2026-11-27 0001-t6 planned→dispatched — variant-B kit + review follow-ups (codec probe, kit.json formats, stopgap type, NOTICE pin)
2026-11-27 0001-t1, 0001-t2 →merged→closed — #16 c70aa6a, #15 89fca9a; main verify green (231 tests); Shaun approved merging all 0001 PRs after review+CI
2026-11-27 0001-t1 dispatched→in-review — PR #16 @ 6b692fd; review r1 claude-opus-5-5
2026-11-27 0001-t2 dispatched→in-review — PR #15 @ 5952fb1; review r1 claude-opus-5-5
2026-11-27 0001-t6 blocked→planned — drumlet main has variant B (29 files, 650 KB ogg+m4a); waits only on T2 merge
2026-11-27 0001-t3 dispatched→in-review — PR #14 @ 19a6bb6; review r1 codex gpt-6.2-sol
2026-11-27 0001-t1..t3 delegated (impl r1 running)
2026-11-27 0001-t1..t3 planned→dispatched — Shaun said build; routes resolved: impl codex gpt-6.2-sol (t1,t2), alt claude-sonnet-5-5 (t3)
2026-11-27 0001 specced→planned — plan T1–T6 written; awaiting Shaun's review
2026-11-27 0001 proposed→specced — Shaun approved spec + approach A; host is becreative; spelling follows chord root
2026-11-27 0001 →proposed — keyboard spec drafted; builder check done; awaiting Shaun's approval
