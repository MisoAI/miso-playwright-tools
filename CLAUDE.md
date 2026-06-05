# CLAUDE.md

Guidance for working in this repository.

## What this is

`@miso.ai/playwright-tools` — Playwright helper functions for Miso E2E testing.
The helpers attach to a Playwright `page` and observe Miso behavior (API traffic,
navigation, interaction beacons), exposing a structured, session-oriented view
for tests to assert against.

## Layout

- `lib/index.js` — public barrel; re-exports everything, plus `fixtures` namespace.
- `lib/events.js` — `EventPool` / `addEvents`: ordered, promise-aware event pool
  backing `page.events`.
- `lib/network.js` — `monitorNetwork`: captures Miso API requests/responses and
  `/v1/interactions` beacons onto `page.events`.
- `lib/navigation.js` — `interceptNavigation`: records and aborts top-level
  navigations onto `page.navigations`.
- `lib/sessions.js` — `buildSessions`: groups traffic into `page.sessions` keyed
  by `miso_id` / `question_id`.
- `lib/replace-scripts.js` — `useLocalMisoScripts`: serves local build files in
  place of the Miso CDN.
- `lib/fixtures.js` — Playwright `expect` matchers (`toHaveSite`, `toHaveUnitId`,
  `toHaveApiInfo`).
- `lib/internal.js` — `Resolution` and `trimObj`, inlined from `@miso.ai/commons`
  to keep the package dependency-free.

## Conventions

- ESM only (`"type": "module"`); use `.js` extensions in relative imports.
- Zero runtime dependencies — `@playwright/test` is a peer dependency only. Inline
  small utilities into `lib/internal.js` rather than adding dependencies.
- The helpers are additive and idempotent: each guards against double-install
  (e.g. `if (page.events) return;`) so they can be called in any order.

## Known Miso-specific assumptions (genericize if reused beyond answers)

- `sessions.js` recognizes only the `explore` workflow and maps the
  `/v1/ask/trending_questions` and `/v1/ask/related_questions` paths.
- Interaction view aliases (`impressions`, `viewables`, `clicks`, ...) in
  `sessions.js` and the matchers in `fixtures.js` assume Miso payload shapes.

## Checks

No test suite yet. After editing `lib/`:

```sh
for f in lib/*.js; do node --check "$f"; done
```
