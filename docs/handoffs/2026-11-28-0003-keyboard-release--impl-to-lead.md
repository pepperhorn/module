# Handoff: 0003 — Keyboard release job (impl → lead)

- Date: 2026-11-28
- Type: return
- Ledger: 0003 · Spec and plan: none (quick item)
- Branch: `orch/0003-keyboard-release`
- Worktree: `/home/shaun/.t3/worktrees/module/t3-2704d1c1-c2b37bb5050bed07`
- PR: Draft against `main`, opened after this handoff is committed.
- Base commit: `57d67a05b0b2ce08d2944e8417279534c68dd5fa`
- Status: open for lead review

## Goal

Publish `@pepperhorn/keyboard` from matching `keyboard-v*` tags via npm trusted publishing. See the [dispatch handoff](2026-11-28-0003-keyboard-release--lead-to-impl.md).

## Scope

- In: separate tag routes in `.github/workflows/release.yml`, a release note in `packages/keyboard/README.md`, and the two 0003 handoff files.
- Out: package versions, lockfile, registry settings, sound-module steps, tag creation, publishing, and merging.

## Acceptance criteria

- [x] Route `v*` to the existing sound-module job and `keyboard-v*` to the keyboard job. Sound-module steps match `main`.
- [x] Check the keyboard tag before installing dependencies. Run typecheck, tests, keyboard build and dist verification before the publish step.
- [x] Use the existing workflow-level OIDC permission and the same Node and npm setup. No additional secret or GitHub environment.
- [x] Parse the workflow and confirm the diff against `main` includes only owned files.

## Verify with

```bash
npm ci
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build
npm run build:keyboard && npm run verify:keyboard
python3 -c "import yaml;yaml.safe_load(open('.github/workflows/release.yml'))"
git diff --check main...HEAD
git diff --stat main...HEAD
```

## Return

- Outcome: done. Implementation commit `bf1609a`.
- Verification passed twice. The second run followed orch-deslop, which shortened the README note and clarified which commit to tag.
- Verification output:

  ```text
  added 489 packages, and audited 490 packages in 41s
   Test Files  39 passed (39)
        Tests  285 passed (285)
  ✓ built in 397ms
  ✓ built in 66ms
  keyboard dist OK (1 export, 60 sampler files, 66 scoped selectors)
  Workflow YAML parsed
  ```

- Ran the exact keyboard guard script locally. `keyboard-v0.1.1` passed, `keyboard-v0.1.1-wrong` and `v0.1.1` exited 1. Parsed YAML also confirmed routing, command order, and parity of the sound-module steps.
- Decisions made: keep both jobs in `release.yml` to match the npm trusted publisher's workflow name. Each job checks the tag prefix before running and compares the full tag to its own package version.
- Out-of-scope issue: npm reported 12 audit findings (1 low, 5 moderate, 4 high, 2 critical) on the unchanged lockfile. No dependency changes.
- Follow-up: review and merge only with approval. Live OIDC was not tested. Confirm npm trusted publisher registration for `pepperhorn/module`, workflow `release.yml`, no environment, before the first release. The local `keyboard-v0.1.2` tag points at `57d67a0`, which predates the workflow change and has keyboard version `0.1.1`. The tag was not on `origin` at handback. Use a new, matching tag on a commit that contains the workflow.
- GBrain: searched for the repository and package. No relevant release record used.
