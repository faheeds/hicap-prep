// HiCap Prep service worker — PWA / E8-1
// Strategy: cache-first for the app shell and static assets;
// network-first with cache fallback for everything else.
// The question bank lives inside app.html (inline JS), so caching
// app.html is sufficient for offline practice.

// __CACHE_VERSION__ is replaced by scripts/gen-config.js at Vercel build time
// with the UTC build timestamp (e.g. "hicap-20260916T045235Z").
// In local dev / test runs the placeholder string is the cache name, which
// is fine — the activate handler still purges anything that doesn't match.
const CACHE_NAME = "__CACHE_VERSION__";

// App shell: everything needed to run offline practice.
// config.local.js is intentionally excluded — it contains the Supabase
// anon key (public but sensitive) and the app degrades gracefully
// (localStorage fallback) when the network is unavailable anyway.
const PRECACHE = [
  "/app.html",
  "/landing.html",
  "/auth.js",
  "/store.js",
  "/supabase-client.js",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Skip Supabase API calls — always network; never cache auth/data.
  if (url.hostname.includes("supabase.co")) return;

  // config.local.js contains the injected Supabase keys — must always be
  // fetched fresh so a key rotation or redeployment takes effect immediately.
  if (url.pathname.endsWith("config.local.js")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        // Cache successful opaque/ok responses for static assets.
        if (response.ok || response.type === "opaque") {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        // Network failed and no cache — return a minimal offline notice
        // only for navigation requests (HTML pages).
        if (request.destination === "document") {
          const offlineHtml = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>HiCap Prep — Offline</title>
<style>body{font-family:Georgia,serif;padding:2rem;max-width:400px;margin:auto}</style>
</head><body>
<h1>You're offline</h1>
<p>HiCap Prep needs a connection to sync your progress. Open the app when you're back online.</p>
<p><a href="/app.html">Try the app</a></p>
</body></html>`;
          return new Response(offlineHtml, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        throw new Error("Network and cache both unavailable");
      }
    })
  );
});
