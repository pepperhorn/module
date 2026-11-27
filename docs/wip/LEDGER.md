# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked
> Waiting on: `child <taskId>` · `review <taskId>` · `ci` · `human: <why>` · `lead: <next action>`. Set it on every status change. A row needs the lead when it starts with `lead`, or when it's empty and Status is dispatched, in-review, changes-requested, ready, or merged. The lead's Stop hook won't let the lead end its turn while any row needs it.
> Type: normal items have a spec and plan. Quick items have the title prefix `[quick]` (no spec or plan, a short handoff). PRs adopted by `orch-sweep` have the prefix `[pr]`.

Next ID: 0002

## Active

| K | Title | Status | Waiting on | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0001-t1 | Keyboard T1: sampler opt-ins | dispatched | lead: delegate | codex/gpt-6.2-sol | orch/0001-t1-sampler-optins | — | — | — | docs/specs/0001-keyboard.md | docs/plans/0001-keyboard.md | docs/handoffs/2026-11-27-0001-t1-sampler-optins--lead-to-impl.md | 2026-11-27 |
| 0001-t2 | Keyboard T2: bundled piano + kit, GM drum map | dispatched | lead: delegate | codex/gpt-6.2-sol | orch/0001-t2-bundled-assets | — | — | — | docs/specs/0001-keyboard.md | docs/plans/0001-keyboard.md | docs/handoffs/2026-11-27-0001-t2-bundled-assets--lead-to-impl.md | 2026-11-27 |
| 0001-t3 | Keyboard T3: chord theory + spelling | dispatched | lead: delegate | claudeAgent/claude-sonnet-5-5 | orch/0001-t3-chord-theory | — | — | — | docs/specs/0001-keyboard.md | docs/plans/0001-keyboard.md | docs/handoffs/2026-11-27-0001-t3-chord-theory--lead-to-impl.md | 2026-11-27 |
| 0001-t4 | Keyboard T4: package + Keyboard surface | planned | child 0001-t1..t3 (deps) | — | — | — | — | — | docs/specs/0001-keyboard.md | docs/plans/0001-keyboard.md | — | 2026-11-27 |
| 0001-t5 | Keyboard T5: drawers, MIDI, responsive | planned | child 0001-t4 (dep) | — | — | — | — | — | docs/specs/0001-keyboard.md | docs/plans/0001-keyboard.md | — | 2026-11-27 |
| 0001-t6 | Keyboard T6: swap in drumlet variant-B kit | blocked | drumlet 0001-t1 merge | — | — | — | — | — | docs/specs/0001-keyboard.md | docs/plans/0001-keyboard.md | — | 2026-11-27 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|

## Suggestions

> Lead-curated ideas: next steps, improvements, code efficiencies, stack changes, risks. Each needs evidence (file:line, a measurement, or a link). Status: `new` · `accepted → NNNN` · `declined: <why>` · `done`. Keep declined rows so they aren't suggested again. A PR mentioned here isn't tracked: only the PR column of Active or Done rows counts.

| S | Kind | Suggestion | Evidence | Effort (S/M/L) | Value | Source | Status |
|---|---|---|---|---|---|---|---|

Last health scan: never

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
2026-11-27 0001-t1..t3 planned→dispatched — Shaun said build; routes resolved: impl codex gpt-6.2-sol (t1,t2), alt claude-sonnet-5-5 (t3)
2026-11-27 0001 specced→planned — plan T1–T6 written; awaiting Shaun's review
2026-11-27 0001 proposed→specced — Shaun approved spec + approach A; host is becreative; spelling follows chord root
2026-11-27 0001 →proposed — keyboard spec drafted; builder check done; awaiting Shaun's approval
