# Docs index

| Folder | Purpose |
|---|---|
| [specs/](specs/) | What and why: problem, goals, non-goals, acceptance criteria |
| [plans/](plans/) | How: a task breakdown with file ownership and dependencies |
| [handoffs/](handoffs/) | Shared understanding passed between agents ("hand over" / "handoff to") |
| [decisions/](decisions/) | ADRs: decisions that shouldn't be argued again |
| [wip/LEDGER.md](wip/LEDGER.md) | **The WIP ledger**: every in-flight item, its status, branch, and worktree |

Work-item IDs (`NNNN`) and task keys (`K` = `NNNN` or `NNNN-tN`) come from the ledger and appear in every related filename and branch. ADRs have their own numbering.

## Agent workflow

Describe a feature to the lead, who writes the spec and plan; start implementation with `orch-dispatch NNNN`. Small fixes use the quick lane. Implementers open PRs, the other model family reviews, and the lead merges within the configured limits. Everyone reads GBrain; the lead records decisions and outcomes. Say "hand over" or "handoff to" to produce a committed document in `handoffs/`.

Routing is configured in [`.ph-orch.json`](../.ph-orch.json): Codex gpt-6.2-sol/high implements and reviews Claude work, Claude Sonnet 5.5/high is the alternate implementer, and Claude Opus 5.5/high reviews Codex work.

The default permits approved small merges of at most 50 changed lines under the restrictions in [AGENTS.md](../AGENTS.md). Explicit task constraints take precedence. `orch-sweep` handles outstanding ledger rows and PRs and runs a read-only suggestion scan every seven days. Suggestions wait for approval except eligible quick fixes.

For machine-level hooks, run the ph-orch kit's `install.sh` once per machine; it installs `lead-guard`, `lead-post`, `lead-stop`, and the SessionStart summary. Codex asks you to trust new hooks. The kit used for this bootstrap is `/home/shaun/.t3/projects/ph-orch`. Repository opt-out is `.git/ph-orch-noguard`; session opt-out is `PH_ORCH_GUARD=0`. This bootstrap does not change machine-level hooks.
