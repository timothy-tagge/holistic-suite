# E2E Tests (Playwright)

## Running locally

```bash
npx playwright test             # run all e2e tests (starts dev server automatically)
npx playwright test --ui        # interactive UI mode
npx playwright show-report      # open last HTML report
```

## Authenticated tests

Tests that require a signed-in user need a saved auth state.
To set this up (one-time):

```bash
npx playwright codegen http://localhost:5173
```

Sign in through the UI, then save the storage state:

```js
// In a setup script:
await page.context().storageState({ path: "e2e/.auth/user.json" });
```

Then reference it in tests:

```js
test.use({ storageState: "e2e/.auth/user.json" });
```

The `.auth/` directory is gitignored — never commit real session tokens.

## CI

Playwright runs against the Firebase Hosting preview URL set via:

```
PLAYWRIGHT_BASE_URL=https://holistic-suite.web.app
```

Chromium only in CI to keep build times short.
Add Firefox/WebKit projects locally or in a nightly workflow when needed.
