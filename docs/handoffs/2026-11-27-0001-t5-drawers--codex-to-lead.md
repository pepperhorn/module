# Handoff: 0001-t5 — Keyboard drawers and MIDI settings (Codex → lead)

- **Date:** 2026-11-27
- **Type:** return
- **Ledger:** 0001 · **Spec:** [Keyboard](../specs/0001-keyboard.md) · **Plan:** [T5](../plans/0001-keyboard.md#t5--drawers-sounds-effects-settings-midi-and-responsive-layout)
- **Dispatch:** [Lead to implementer](2026-11-27-0001-t5-drawers--lead-to-impl.md)
- **Branch:** `orch/0001-t5-drawers` · **Worktree:** `/home/shaun/.t3/worktrees/module/t3-5e91bb0a-9975df0b7901330d`
- **PR:** [Draft PR #19](https://github.com/pepperhorn/module/pull/19)
- **Base:** `f79eda6`, with dispatch at `fca3873` · **Implementation:** `2f9c028` · **Port:** 5215
- **Status:** implementation complete

## Goal and scope

Add Sounds, Effects and Settings to the keyboard and verify MIDI routing and phone layout. The diff stays within the keyboard drawers, toolbar wiring, scoped CSS, E2E harness, README and the two T5 handoffs. It leaves the shared engine, existing app, sound-module, CI and publishing alone.

## Acceptance

- [x] AC7: One drawer opens at a time. Escape, an outside click and the active trigger close it. Sounds pins Piano and Drums, groups the rest by bank, and closes on selection. The existing loading status stays visible for streamed sounds. Effects exposes four toggles and four wet amount controls. Settings exposes volume, octave shift, accidentals and MIDI input.
- [x] AC8: Tests cover note on and off in Play and Chord mode with computer keys and simulated MIDI. Chromium starts three bundled piano sample sources for a simulated MIDI chord at each width. The saved input returns on remount.
- [x] AC9: Chromium checks the built package at 360, 390 and 1280 px. Every bar control and drawer is reachable and no state scrolls horizontally.
- [x] Drawer actions write only `pepperhorn-keyboard:` keys. The existing `module:state:v1` fixture stays intact.
- [x] AC10: The app and both library builds pass. Sound-module and keyboard package verification pass.

## Verification

Set `PLAYWRIGHT_MODULE` to the cached Playwright entry if it is not installed locally. Run the following from the root under Node 22.

```bash
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build && npm run build:lib && npm run verify:lib && npm run build:keyboard && npm run verify:keyboard && node packages/keyboard/e2e/host-build.mjs && node packages/keyboard/e2e/widths.mjs
node packages/keyboard/e2e/smoke.mjs
```

Ran the full Vitest command again under Node 26. The four drawer tests failed before implementation and passed after. The cleanup removed a redundant cast and unused classes, consolidated focus restoration, and kept Escape from intercepting the host's keyboard outside the module. Repeated the full verification after cleanup.

```text
Node 22.23.5 and Node 26.12.0: 39 test files, 281 tests passed on each
sound-module dist OK
keyboard dist OK (1 export, 60 sampler files, 66 scoped selectors)
Vite production host OK (60 packed piano and drum files, both codecs, all JS URLs resolved)
360px, 390px, 1280px: no horizontal scroll, bar and all drawers reachable, simulated MIDI plays a chord
Chromium smoke OK (React 19, 16 piano files, 12 drum files, clean console)
```

Screenshots from that run: [360 px Sounds](../../packages/keyboard/e2e/evidence/360-sounds.png), [390 px Settings](../../packages/keyboard/e2e/evidence/390-settings.png) and [1280 px Effects](../../packages/keyboard/e2e/evidence/1280-effects.png). The script generates all nine width and drawer combinations.

## Decisions made

- The gear opens Effects, alongside a Settings button. The shared drawer slot sits below the bar so it doesn't cover the triggers. It returns focus on Escape or patch selection, and leaves focus alone when the user clicks outside.
- Settings uses the keyboard's existing octave and MIDI state. It preserves a saved device ID when the device is unplugged. The Effects controls use the existing wet mix and default to 0%.
- The GBrain page `projects/crf-transcribe` (#12) informed the muted controls at rest. GBrain did not return `projects/module`. The repository spec was the source of truth.
- For GBrain, an engine test that fakes only the audio sink can verify settings end to end through the actual keyboard UI, preferences and MIDI adapters without writing to the host's store.

## Return

**Outcome:** done. Review is next. No open implementation questions. MIDI used a simulated Web MIDI device, not physical hardware. The streaming loading state uses a held engine promise in tests, not a live CDN request. No deploy or publish.

## Round 2

Addressed the [review of `65c2983`](https://github.com/pepperhorn/module/pull/19#pullrequestreview-6084845714) and the [fix-round handoff](https://github.com/pepperhorn/module/blob/48fbc5bca9592e6a27828b896fc6ce38966e5be3/docs/handoffs/2026-11-27-0001-t5-drawers--lead-to-impl-r2.md).

- Enabling an effect at zero sets its wet mix to 32% for reverb, 35% for delay, 40% for chorus or 30% for distortion. Raising the amount above zero enables the effect. Setting it to zero keeps the toggle state. Each action sends one complete effect update to `setPrefs`.
- Playing the keys keeps any open drawer visible. Escape, the opening button and presses outside the drawer and keys still dismiss it. The width check taps a key at 390 px and confirms that three piano sample sources start while Effects stays open. It also checks that simulated MIDI keeps Settings open.

Re-ran the verification above before and after `orch-deslop`. Cleanup split the first-action test into independent fresh-preference cases and isolated the zero-amount check. Both first-action cases verify one write and persistence after remount. Browser runs used Playwright Core 1.65.0 and cached Chromium 1254 without changing dependencies.

```text
Node 22.23.5 and Node 26.12.0: 39 test files, 285 tests passed on each
sound-module dist OK
keyboard dist OK (1 export, 60 sampler files, 66 scoped selectors)
Vite production host OK (60 packed piano and drum files, both codecs, all JS URLs resolved)
360px, 390px, 1280px: no horizontal scroll, bar and all drawers reachable
390px touch: key tap plays a chord and keeps Effects open
Chromium smoke OK (React 19, 16 piano files, 12 drum files, clean console)
```

Refreshed the PR screenshots, including [Effects after a key tap at 390 px](../../packages/keyboard/e2e/evidence/390-effects.png). Ready for re-review.
