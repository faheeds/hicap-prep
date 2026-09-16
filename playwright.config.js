// Playwright config — only for e2e tests in tests-e2e/.
// These tests hit the live deployed URL (https://hicapprep.com) and are NOT
// included in the npm test suite (which runs tests/*.test.mjs via node --test).
// Run manually: npx playwright test
// Run single file: npx playwright test tests-e2e/sw-update.spec.js

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 60_000,
  retries: 1,           // one retry for flaky network conditions
  use: {
    channel: "chrome",  // uses the installed Chrome, no separate download needed
    headless: true,
    // Service workers need a persistent context to observe update cycles.
    // Individual tests create their own contexts via browser.newContext().
  },
  projects: [
    {
      name: "chromium",
      use: { channel: "chrome" },
    },
  ],
});
