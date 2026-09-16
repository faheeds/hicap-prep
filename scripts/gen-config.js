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
