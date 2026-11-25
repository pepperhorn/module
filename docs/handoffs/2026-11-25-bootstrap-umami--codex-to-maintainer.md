# Handoff: orchestration bootstrap and Umami analytics

- Date: 2026-11-25
- Type: return
- Branch: `seo/umami`
- Base commit: `6596244011ca8d40e5cf579bbef993f19ec4e482`
- Status: draft PR for human review; no merge or watch authorized

## Goal

Add the requested Umami script to production HTML and initialize ph-orch with the user-approved routing defaults.

## Scope and files owned

The bootstrap owns `.ph-orch.json`, `AGENTS.md`, `CLAUDE.md`, `.claude/agents/`, the new documentation templates and index, and `.gitignore`. The analytics change owns `vite.config.ts`. Existing docs and application source are preserved.

## Acceptance criteria

Production HTML contains one deferred script from `https://analytics.pepperhorn.com/script.js` with website ID `821b35fa-4b42-4aec-b3ae-77546a1eabf5`. Development serving and development-mode builds omit it. The repository has no enforced CSP to extend. Open a draft PR against `main`; do not merge or watch it.

## Verify with

```bash
npm run typecheck
npm test
npm run build
```

Inspect `dist/index.html` for the script and verify development HTML omits it. Check the generated service worker and manifest are present.

## Decisions made

The user approved orch-init and routing: Codex gpt-6.2-sol/high for implementation and review of Claude work; Claude Sonnet 5.5/high for alternate implementation; Claude Opus 5.5/high for review of Codex work. Defaults allow future approved small merges up to 50 changed lines, with a seven-day suggestion scan. This task's explicit no-merge instruction takes precedence.

Keep initialization on the requested branch and include it in the draft PR rather than pushing to main. No secrets or deployment changes are required. The shared Vite HTML shell covers all SPA routes; the embeddable library does not inject analytics into host applications.

## GBrain and follow-ups

GBrain: unavailable (`Transport closed` on search and page read). When restored, record the routing and bootstrap decisions, linking this document, `AGENTS.md`, `docs/README.md`, and `docs/wip/LEDGER.md`. No live analytics request or deployment has been tested.

## Verification results

- `npm run typecheck`: passed.
- `npm test`: 26 files and 220 tests passed.
- `npm run build`: passed; generated service worker and manifest are nonempty.
- Parsed `dist/index.html`: exactly one matching Umami script, deferred, with the requested website ID.
- `vite build --mode development --outDir /tmp/module-umami-development`: passed; HTML omits analytics.
- Vite serve configuration in development and production modes excludes the analytics plugin.
- `git diff --check`, template substitution and managed-block checks: passed.
- Pre-push orch-deslop check: no cleanup changes needed.
