// Runtime Supabase bootstrap. Lives outside the main app script so it can
// be reused by src/auth.js and (later) the Supabase-backed Store.
//
// Design goals:
//   1. In local-only mode (no window.__HICAP_CONFIG.supabaseUrl set) this
//      file MUST be a no-op — the test suite runs without network access
//      and the CI-friendly localStorage fallback needs to keep working.
//   2. The @supabase/supabase-js CDN import happens lazily, the first time
//      something actually asks for a client, so unconfigured sessions never
//      hit the network at all.
//   3. Everything lives on window.__hicap so plain <script> tags (no build
//      step, per CLAUDE.md) can talk to each other.

(function () {
  const cfg = (typeof window !== "undefined" && window.__HICAP_CONFIG) || {};
  const isCloud = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

  // The pinned CDN version. Bump deliberately, not opportunistically — the
  // whole app runs on this and there's no lockfile for a CDN import.
  const CDN_URL = "https://esm.sh/@supabase/supabase-js@2.45.4";

  let clientPromise = null;

  async function getSupabase() {
    if (!isCloud) return null;
    // Test escape hatch: if a test has pre-registered a fake client, use it
    // instead of pulling supabase-js from the CDN. Never triggered in prod
    // because __HICAP_TEST_CLIENT is only set by test setup code.
    if (window.__HICAP_TEST_CLIENT) return window.__HICAP_TEST_CLIENT;
    if (!clientPromise) {
      clientPromise = (async () => {
        const mod = await import(CDN_URL);
        return mod.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: "hicap.auth.session",
          },
        });
      })();
    }
    return clientPromise;
  }

  window.__hicap = Object.assign(window.__hicap || {}, {
    config: cfg,
    isCloud,
    getSupabase,
  });
})();
