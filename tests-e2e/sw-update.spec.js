// Service-worker update-cycle test (automation of the manual DevTools check).
//
// Verifies the full SW update flow that previously required manual verification:
//   1. SW registers and installs a versioned cache on first load.
//   2. When a new SW version is deployed (simulated by intercepting sw.js and
//      injecting a new CACHE_NAME), the new SW installs, activates, and:
//        a. The new versioned cache is present.
//        b. All prior caches (old live cache + any stale caches) are purged.
//
// The simulation strategy: Playwright's context.route() intercepts the sw.js
// fetch triggered by registration.update(), replaces the CACHE_NAME with a
// far-future version, and then waits for the "controllerchange" event that
// fires when skipWaiting() + clients.claim() hand off to the new SW.
//
// Run: npx playwright test tests-e2e/sw-update.spec.js
// Requires: live https://hicapprep.com deployment (checked at runtime).

import { test, expect } from "@playwright/test";

const LIVE_URL = "https://hicapprep.com/app.html";

// Far-future CACHE_NAME used in the simulated "new deployment".
// The pattern must match what sw.js produces at build time: hicap-YYYYMMDDTHHMMSSz
const SIMULATED_NEW_CACHE = "hicap-29991231T120000Z";

test.describe("service worker update cycle", () => {
  test("first load: SW registers and creates a versioned hicap-* cache", async ({ page }) => {
    await page.goto(LIVE_URL, { waitUntil: "networkidle" });

    // SW must be registered and controlling the page.
    const isControlled = await page.evaluate(() =>
      navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller)
    );
    expect(isControlled).toBe(true);

    // The active SW's scriptURL must end with sw.js.
    const swUrl = await page.evaluate(() =>
      navigator.serviceWorker.ready.then(reg => reg.active ? reg.active.scriptURL : null)
    );
    expect(swUrl).toMatch(/sw\.js$/);

    // A cache with the hicap-* naming scheme must exist.
    const cacheKeys = await page.evaluate(() => caches.keys());
    const hivapCaches = cacheKeys.filter(k => /^hicap-\d{8}T\d{6}Z$/.test(k));
    expect(hivapCaches.length).toBeGreaterThanOrEqual(1);
  });

  test("update cycle: new SW purges old cache and takes control", async ({ browser }) => {
    // Use a fresh browser context so we start with a clean SW state.
    const context = await browser.newContext();
    const page = await context.newPage();

    // ── Step 1: initial load — SW installs with the live CACHE_NAME ──────────
    await page.goto(LIVE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => navigator.serviceWorker.ready);

    const liveCacheName = await page.evaluate(async () => {
      const keys = await caches.keys();
      return keys.find(k => /^hicap-\d{8}T\d{6}Z$/.test(k)) ?? null;
    });
    expect(liveCacheName).toMatch(/^hicap-\d{8}T\d{6}Z$/);

    // ── Step 2: plant stale caches that simulate a pre-update browser state ──
    // Two names: one that looks like a real old version, one arbitrary.
    const STALE_A = "hicap-19991231T120000Z";
    const STALE_B = "hicap-v1"; // the old static name from before versioning
    await page.evaluate(async ([a, b]) => {
      await caches.open(a);
      await caches.open(b);
    }, [STALE_A, STALE_B]);

    // Confirm stale caches are now present.
    const preUpdateCaches = await page.evaluate(() => caches.keys());
    expect(preUpdateCaches).toContain(STALE_A);
    expect(preUpdateCaches).toContain(STALE_B);

    // ── Step 3: intercept the sw.js fetch to simulate a new deployment ───────
    // When registration.update() causes the browser to re-fetch sw.js, our
    // route handler replaces the CACHE_NAME with SIMULATED_NEW_CACHE.
    // All other resources (precache files) are fetched from the real server.
    await context.route(/\/sw\.js(\?.*)?$/, async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      // Replace the build-time version string: matches both the __CACHE_VERSION__
      // placeholder (if somehow unpatched) and the actual hicap-* timestamp form.
      body = body.replace(
        /__CACHE_VERSION__|hicap-\d{8}T\d{6}Z/,
        SIMULATED_NEW_CACHE
      );
      await route.fulfill({
        response,
        body,
        headers: { ...response.headers(), "content-type": "application/javascript" },
      });
    });

    // ── Step 4: trigger SW update and wait for the new SW to take control ────
    // Set up the controllerchange listener BEFORE calling update() to avoid a race.
    const controllerChanged = page.evaluate(() =>
      new Promise((resolve) => {
        if (!navigator.serviceWorker.controller) { resolve(); return; }
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
      })
    );

    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    });

    // Wait for the new SW to call skipWaiting() and clients.claim().
    await controllerChanged;

    // Give the activate event a moment to finish deleting old caches.
    await page.waitForFunction(
      (newCache) => caches.keys().then(keys => keys.includes(newCache)),
      SIMULATED_NEW_CACHE,
      { timeout: 15_000 }
    );

    // ── Step 5: assert the cache state after the update ───────────────────────
    const finalCaches = await page.evaluate(() => caches.keys());

    // New cache must be present.
    expect(finalCaches).toContain(SIMULATED_NEW_CACHE);

    // Old live cache must be purged.
    expect(finalCaches).not.toContain(liveCacheName);

    // Stale caches must also be purged.
    expect(finalCaches).not.toContain(STALE_A);
    expect(finalCaches).not.toContain(STALE_B);

    await context.close();
  });
});
