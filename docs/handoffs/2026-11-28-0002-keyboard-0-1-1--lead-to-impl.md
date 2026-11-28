# Handoff: 0002 — [quick] Bump @pepperhorn/keyboard to 0.1.1 (lead → impl)

- **Date:** 2026-11-28
- **Type:** quick
- **Ledger:** 0002 · **Spec:** none · **Plan:** none
- **Branch:** orch/0002-keyboard-0-1-1 · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** 5d2a9ec91dbede883aaf3c9743478862ae41b513
- **Status:** open

## Goal
npm refuses to publish `@pepperhorn/keyboard@0.1.0` (`409 Cannot publish over previously staged version "0.1.0"`; a staged 0.1.0 was rejected or expired, and npm keeps the number). Bump the package version to `0.1.1` so the lead can publish it. Nothing else changes. Shaun approved the bump (2026-11-28).

## Files you own
- `packages/keyboard/package.json` (the `version` field only)
- your own handoff files for key 0002

## Acceptance criteria
- [ ] `packages/keyboard/package.json` `version` is `0.1.1`; no other change in that file
- [ ] `git diff --stat main...HEAD` shows only that file plus your handoff files
- [ ] verify below passes

## Verify with
```bash
npm ci
npm run typecheck && npx vitest run --testTimeout=60000 --maxWorkers=2 && npm run build
npm run build:keyboard && npm run verify:keyboard
npm publish ./packages/keyboard --access public --dry-run   # must print + @pepperhorn/keyboard@0.1.1; never run without --dry-run
```
Do not publish. The lead publishes after merge.
