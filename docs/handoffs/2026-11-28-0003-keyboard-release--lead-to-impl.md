# Handoff: 0003 — Keyboard release job (trusted publishing) (lead → impl)

- **Date:** 2026-11-28
- **Type:** quick (CI change; Shaun approved the PR 2026-11-28, merge still needs his OK)
- **Ledger:** 0003 · **Spec:** none · **Plan:** none
- **Branch:** orch/0003-keyboard-release · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** 57d67a05b0b2ce08d2944e8417279534c68dd5fa
- **Status:** open

## Goal
Publish `@pepperhorn/keyboard` from GitHub Actions with npm trusted publishing (OIDC), triggered by `keyboard-v*` tags, the way `.github/workflows/release.yml` already publishes `@pepperhorn/sound-module` on `v*` tags. Shaun is registering the trusted publisher on npmjs.com as repo `pepperhorn/module`, workflow `release.yml`, no environment, so the job **must live in `release.yml`** (no new workflow file, no `environment:`).

## Files you own
- `.github/workflows/release.yml`
- `packages/keyboard/README.md` (only to add a short "Releasing" note, if the README has no release section)
- your own handoff files for key 0003

## Acceptance criteria
- [ ] `on.push.tags` is `['v*', 'keyboard-v*']`. The sound-module job runs only for `v*` tags (`if: startsWith(github.ref_name, 'v')`), the new keyboard job only for `keyboard-v*` (`if: startsWith(github.ref_name, 'keyboard-v')`). The sound-module job's steps are otherwise unchanged.
- [ ] Keyboard job: same setup as the sound-module job (checkout, setup-node 24 with registry-url, `npm install -g npm@latest`, `id-token: write`), then: fail unless `keyboard-v$(version of packages/keyboard/package.json)` equals `$GITHUB_REF_NAME`; `npm ci`; `npm run typecheck`; `npm test`; `npm run build:keyboard`; `npm run verify:keyboard`; `npm publish ./packages/keyboard --access public`. No `NODE_AUTH_TOKEN` or other secret.
- [ ] Workflow parses: `npx --yes @action-validator/cli .github/workflows/release.yml` or `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/release.yml'))"` (use actionlint if available).
- [ ] `git diff --stat main...HEAD` shows only owned files.

## Verify with
```bash
npm ci
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build
npm run build:keyboard && npm run verify:keyboard
python3 -c "import yaml;yaml.safe_load(open('.github/workflows/release.yml'))"
```
Never run `npm publish` (a `--dry-run` is fine) and never push a tag.

## Receiver ack

I’ll add a keyboard-only tag job to `release.yml` using npm trusted publishing. It will check the tag against the keyboard package version before running the release checks. I’ll leave the sound-module steps unchanged, verify locally, and open a draft PR without publishing, pushing a tag, merging, or watching. No open questions.
