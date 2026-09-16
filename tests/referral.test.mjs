// Referral program tests (Epic 6, E6-2).
//
// Structural checks only — no Supabase or Stripe live calls.
// Covers: migration shape, landing.html ref capture, app.html ref capture,
// referral UI presence, and webhook increment logic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const MIGRATIONS_DIR = new URL("../supabase/migrations/", import.meta.url);
const LANDING = readFileSync(new URL("../src/landing.html", import.meta.url), "utf-8");
const APP     = readFileSync(new URL("../src/app.html",     import.meta.url), "utf-8");
const WEBHOOK = readFileSync(new URL("../supabase/functions/stripe-webhook/index.ts", import.meta.url), "utf-8");
const STORE   = readFileSync(new URL("../src/store.js",     import.meta.url), "utf-8");

function readAllMigrations() {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  return files.map((f) => readFileSync(new URL(f, MIGRATIONS_DIR), "utf-8")).join("\n\n");
}

test("referral migration: families table gets referral_code, referred_by, referred_count", () => {
  const sql = readAllMigrations();
  assert.match(sql, /add column if not exists referral_code\s+text/i);
  assert.match(sql, /add column if not exists referred_by\s+text/i);
  assert.match(sql, /add column if not exists referred_count\s+integer/i);
});

test("referral migration: referral_code has a unique index", () => {
  const sql = readAllMigrations();
  assert.match(sql, /create unique index if not exists families_referral_code_idx/i);
});

test("referral migration: handle_new_user trigger generates referral_code for new families", () => {
  const sql = readAllMigrations();
  // The trigger body must include referral_code in the insert so new families
  // get a code automatically without a separate backfill step.
  assert.match(sql, /insert into public\.families \(owner_id, referral_code\)/i);
  assert.match(sql, /upper\(substr\(replace\(gen_random_uuid/i);
});

test("referral migration: backfill sets referral_code for existing families with empty string", () => {
  const sql = readAllMigrations();
  assert.match(sql, /update public\.families\s+set referral_code.*where referral_code = ''/is);
});

test("store.js: selects referral_code, referred_by, referred_count from families", () => {
  assert.match(STORE, /referral_code/);
  assert.match(STORE, /referred_by/);
  assert.match(STORE, /referred_count/);
});

test("store.js: loadCloud returns referralCode, referredBy, referredCount in app snapshot", () => {
  assert.match(STORE, /referralCode:\s*fam\.referral_code/);
  assert.match(STORE, /referredBy:\s*fam\.referred_by/);
  assert.match(STORE, /referredCount:\s*fam\.referred_count/);
});

test("store.js: referral capture validates code format and guards against self-referral", () => {
  // Regex pattern [A-Z0-9]{8} must appear for format validation.
  assert.match(STORE, /\[A-Z0-9\]\{8\}/);
  // Self-referral guard: referred_by must not equal the family's own code.
  assert.match(STORE, /refCode !== .fam\.referral_code/);
  // Attribution: update families.referred_by with the captured code.
  assert.match(STORE, /update\(\s*\{\s*referred_by:\s*refCode\s*\}/);
  // Cleanup: localStorage key is removed after capture attempt.
  assert.match(STORE, /localStorage\.removeItem\(.hicap-referral.\)/);
});

test("landing.html: captures ?ref= param into localStorage on page load", () => {
  assert.match(LANDING, /hicap-referral/);
  assert.match(LANDING, /URLSearchParams/);
  assert.match(LANDING, /get\(.ref.\)/);
  assert.match(LANDING, /localStorage\.setItem/);
});

test("app.html: captures ?ref= param from URL in init and clears it from the address bar", () => {
  assert.match(APP, /hicap-referral/);
  // Must clean the URL after capture so the code doesn't persist across refreshes.
  assert.match(APP, /history\.replaceState/);
});

test("app.html: referralSectionHTML renders referral link and copy button", () => {
  assert.match(APP, /function referralSectionHTML/);
  assert.match(APP, /referral-link-input/);
  assert.match(APP, /copyReferralLink/);
});

test("app.html: referral section shown only in cloud mode when referralCode is present", () => {
  // The conditional must check both CLOUD and APP.referralCode.
  assert.match(APP, /CLOUD && APP\.referralCode\s*\?\s*referralSectionHTML/);
});

test("app.html: referred-by hint shown when APP.referredBy is set", () => {
  // Users who were referred see an actionable hint to claim a promo code.
  assert.match(APP, /APP\.referredBy/);
  assert.match(APP, /promo code/i);
});

test("stripe-webhook: increments referrer's referred_count on checkout.session.completed", () => {
  // Must look up the purchasing family's referred_by field after updating pass.
  assert.match(WEBHOOK, /referred_by/);
  // Must look up the referrer by referral_code.
  assert.match(WEBHOOK, /eq\("referral_code", purchasingFam\.referred_by\)/);
  // Must increment referred_count (read + write pattern).
  assert.match(WEBHOOK, /referred_count.*\+\s*1/);
});
