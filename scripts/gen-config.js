#!/usr/bin/env node
// Vercel build step: generates src/config.local.js from environment variables.
// Required env vars: SUPABASE_URL, SUPABASE_ANON_KEY
// Optional env vars: PLAUSIBLE_DOMAIN
const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";
const domain = process.env.PLAUSIBLE_DOMAIN || "";

if (!url || !key) {
  console.error("gen-config: SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  process.exit(1);
}

const content = `window.__HICAP_CONFIG = {
  supabaseUrl: ${JSON.stringify(url)},
  supabaseAnonKey: ${JSON.stringify(key)},
  plausibleDomain: ${JSON.stringify(domain)}
};
`;

const outPath = path.join(__dirname, "..", "src", "config.local.js");
fs.writeFileSync(outPath, content, "utf-8");
console.log("gen-config: wrote", outPath);

// Patch sw.js: replace the __CACHE_VERSION__ placeholder with a UTC build
// timestamp so each deploy gets a new cache name. The activate handler in
// sw.js then purges any cache that doesn't match the new name, which forces
// clients to re-fetch the updated app shell after they pick up the new SW.
const swPath = path.join(__dirname, "..", "src", "sw.js");
const buildVersion = "hicap-" + new Date().toISOString().replace(/[:.]/g, "").slice(0, 15) + "Z";
const swSrc = fs.readFileSync(swPath, "utf-8");
const swOut = swSrc.replace(/"__CACHE_VERSION__"/, JSON.stringify(buildVersion));
fs.writeFileSync(swPath, swOut, "utf-8");
console.log("gen-config: patched sw.js with CACHE_NAME =", buildVersion);
