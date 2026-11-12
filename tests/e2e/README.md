# GhostLinks e2e tests

```sh
cd tests/e2e && npm ci && npx playwright install chromium
npm run test:local              # serves the repo root on 127.0.0.1:4317 (E2E_PORT) and tests it
npm test                        # tests the live site https://ghostfacemodz.github.io/ghostlinks/
BASE_URL=http://host/path/ npm test   # any other deployment
EXPECT_SHA=<sha> npm test       # first wait until the live site serves <sha> (wait-for-deploy.js)
```

- The app derives its base path from `location.pathname` (`siteBase()` in js/route.js),
  so the same specs work under `/ghostlinks/` on Pages and `/` locally.
- `phone` uses `devices['iPhone 13']` (on Chromium). Overflow is measured against
  `documentElement.clientWidth`, because `innerWidth` grows with overflow on mobile.
- Same-origin responses >= 400 fail a test. Third-party ones are logged as annotations.
- `specs/open-bugs.spec.js`: tests marked `knownBug(...)` (Playwright `test.fail`) are
  open bugs. They pass while the bug exists and fail ("expected to fail, but passed")
  once it is fixed. Then delete that `knownBug` line.
- No retries, so flaky tests show up.
