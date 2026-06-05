# miso-playwright-tools

Playwright helper functions for Miso E2E testing.

These tools attach to a Playwright `page` and observe Miso behavior — API
traffic, navigation, and interaction beacons — so tests can assert against a
structured, session-oriented view instead of raw network events.

## Install

```sh
npm install --save-dev @miso.ai/playwright-tools
```

`@playwright/test` is a peer dependency.

## Usage

```js
import { test, expect as baseExpect } from '@playwright/test';
import {
  monitorNetwork,
  interceptNavigation,
  buildSessions,
  useLocalMisoScripts,
  fixtures,
} from '@miso.ai/playwright-tools';

const expect = baseExpect.extend(fixtures);

test.beforeEach(async ({ page }) => {
  // 1. (optional) serve local build files instead of the CDN
  await useLocalMisoScripts(page, {
    targetPath: 'https://distribution-cdn.askmiso.com/miso-***-script/',
    localDir: '/path/to/dist',
  });

  // 2. collect Miso API requests/responses and interaction beacons
  monitorNetwork(page, {
    api: {
      hostname: 'api.askmiso.com', // string | string[] | predicate
      filter: (request) => true,   // narrow which requests are tracked
    },
  });

  // 3. capture (and abort) top-level navigations so clicks don't leave the page
  await interceptNavigation(page);

  // 4. group requests/responses/interactions into sessions
  buildSessions(page);
});

test('example', async ({ page }) => {
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

  // observe a structured event stream
  page.events.subscribe((event) => console.log(event.type));

  // ...drive the page...

  const session = page.sessions[0];
  expect.soft(session.requests.length).toBe(1);
  expect.soft(session.related_questions.impressions.length).toBeGreaterThan(0);
  expect.soft(page.navigations.length).toBe(0);
});
```

## What it adds to `page`

| Property | Added by | Description |
| --- | --- | --- |
| `page.events` | `monitorNetwork` / `buildSessions` | Ordered event pool (`request`, `response`, `interaction`, `navigation`) with `subscribe(cb, { history })`. |
| `page.sessions` | `buildSessions` | Sessions grouping API calls and interaction beacons by `miso_id` / `question_id`. |
| `page.navigations` | `interceptNavigation` | Top-level navigation events (intercepted and aborted). |

## API

- **`monitorNetwork(page, options)`** — listens to Miso API requests/responses
  and `/v1/interactions` beacons, emitting them onto `page.events`. Options:
  `api.hostname` (string, array, or predicate), `api.filter` (request predicate).
- **`interceptNavigation(page, options)`** — routes top-level navigation requests,
  records them on `page.navigations`, and aborts them (closing popups) so a single
  test page can observe click-throughs. Options: `pattern` (route glob).
- **`buildSessions(page)`** — subscribes to `page.events` and assembles
  `page.sessions`. Each session exposes `requests`, `responses`, `interactions`,
  `cursor`, `offset(cursor)`, and proxied interaction views
  (e.g. `session.related_questions.impressions.itemCount`).
- **`useLocalMisoScripts(page, { targetPath, localDir })`** — intercepts Miso CDN
  script requests and fulfills them from a local build directory, falling through
  to the CDN when a file is missing.
- **`addEvents(page)` / `EventPool`** — the underlying ordered, promise-aware
  event pool used by the helpers above.
- **`fixtures`** — Playwright `expect` matchers for Miso events:
  `toHaveSite`, `toHaveUnitId`, `toHaveApiInfo`.

## License

MIT
