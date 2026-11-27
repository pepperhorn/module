# Handoff 0001-t2 — Bundled assets (Codex → lead)

- Date: 2026-11-27
- Type: return
- Status: closed
- Ledger: 0001-t2 · [Spec](../specs/0001-keyboard.md) · [Plan, T2](../plans/0001-keyboard.md#t2--bundled-assets-piano-build-script-drum-kit-patch-manifests-gm-drum-map) · [Dispatch and acknowledgement](2026-11-27-0001-t2-bundled-assets--lead-to-impl.md)
- Branch: `orch/0001-t2-bundled-assets`
- Worktree: `/home/shaun/.t3/worktrees/module/t3-924f9388-a6e0394aae9b03aa`
- Dispatch base: `ea10cef` · Implementation: `43b20ea2dd41fa0116327172ce812df192e3356b`
- PR: draft against `main` to be opened after this commit
- Port: none

## Goal and outcome

T2 is done. The piano has 16 notes per format from C2 to C7. The acoustic kit has 14 Ogg samples, with 19 mapped MIDI notes between 35 and 59. The drum manifest opts into exact-note and one-shot playback. The asset NOTICE records sources and redistribution terms.

## Scope and acceptance

- [x] Both piano formats fit the 500,000-byte budget. A second build on FFmpeg n8.1.3 matched all 33 generated files by SHA-256.
- [x] The GM mapping matches the spec, including the gap at MIDI 39. Every mapped sample exists.
- [x] All six T2 tests and the existing suite pass.
- [x] Changes stay in `packages/keyboard/assets/**`, `packages/keyboard/scripts/{build-piano,copy-kit}.mjs`, `packages/keyboard/src/patches/**`, the two shared config include lines, and the T2 handoffs. The existing app, sound-module, and other tasks' files are out of scope.

## Verification

```sh
node packages/keyboard/scripts/build-piano.mjs --check && npm test
npm run typecheck && npm run build
```

```text
Piano .ogg: 16 samples, 369066 bytes (budget 500000)
Piano .m4a: 16 samples, 469579 bytes (budget 500000)
Test Files  28 passed (28)
     Tests  226 passed (226)
vite v8.0.8 building client environment for production...
✓ built in 1.73s
precache  102 entries (1629.56 KiB)
```

The piano check rejected an oversized temporary fixture. The kit copier reproduced the legacy assets, copied all 28 variant-B files into a temporary directory, and rejected a partial AAC set. Before the final passing run, the existing UI tests hit timeouts during concurrent verification. The exact command passed after the runs were serialized.

## Decisions made

- Four-semitone spacing keeps the nearest piano recording within two semitones across C2–C7. A fade from 2.25 to 2.40 seconds trims long tails. Full-length four-semitone AAC measured 608,333 bytes.
- The piano script checks the source SHA-256 and parses the note data without executing the upstream JavaScript. The NOTICE separates Frank Wen's MIT source from Gleitz's CC BY 3.0 label for the rendered samples.
- T2 uses Drumlet commit `8ac08789f766a63073b7c645d2ec94ebc6f7683f` for the Ogg-only kit specified in the dispatch. Drumlet main already has variant B in `f8c05d6`, so T6's upstream prerequisite is available.
- The generated piano note index and Drumlet kit JSON drive the manifests. An asset-base override can be root-relative.

GBrain: unavailable for verification. Search reported a database pool limit. The dispatch references `projects/module` and `projects/drumlet`. This handoff records the decisions for the lead to promote.

## Follow-ups and open questions

No open questions for T2. T4 owns bundled playback and offline browser verification. T6 owns the variant-B swap and WebKit playback check before release. No browser or hardware audio playback was tested here.
