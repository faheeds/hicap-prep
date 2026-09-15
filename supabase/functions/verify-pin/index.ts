// verify-pin edge function (Epic 1, E1-6).
//
// The client POSTs { pin: "1234" }. This function:
//   1. Verifies the caller's Supabase JWT.
//   2. Loads the caller's families row (service role — bypasses RLS so we can
//      read the pin_hash + rate-limit columns even though the client can't).
//   3. If pin_locked_until is in the future, refuses with 429.
//   4. Constant-time-compares the hashed PIN. On success, clears the failed
//      counter. On failure, increments it and — after the 5th miss — sets
//      pin_locked_until = now() + 5 minutes.
//
// Never returns the hash or salt to the client. Only { ok, attemptsLeft?,
// lockedUntil? } — enough for the UI to render a helpful error.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { verifyPin, isValidPinShape } from "../_shared/pin.ts";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return jsonResponse({ error: "server_misconfigured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ error: "unauthorized" }, 401);

  const admin = createClient(url, serviceKey);
  const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userRes.user) return jsonResponse({ error: "unauthorized" }, 401);
  const userId = userRes.user.id;

  let payload: { pin?: unknown };
  try { payload = await req.json(); } catch { return jsonResponse({ error: "bad_json" }, 400); }
  if (!isValidPinShape(payload.pin)) return jsonResponse({ error: "bad_pin_shape" }, 400);

  const { data: fam, error: famErr } = await admin
    .from("families")
    .select("id, parent_pin_hash, pin_failed_attempts, pin_locked_until")
    .eq("owner_id", userId)
    .maybeSingle();
  if (famErr || !fam) return jsonResponse({ error: "family_not_found" }, 404);

  const now = new Date();
  if (fam.pin_locked_until && new Date(fam.pin_locked_until) > now) {
    return jsonResponse({
      ok: false,
      lockedUntil: fam.pin_locked_until,
      attemptsLeft: 0,
      reason: "locked",
    }, 429);
  }

  // First-time setup: no PIN hash yet -> tell the client to prompt for setup
  // rather than silently accepting anything. E1-6 pairs verify-pin with
  // set-pin (below), so the UI can call set-pin the first time.
  if (!fam.parent_pin_hash) return jsonResponse({ ok: false, reason: "no_pin_set" }, 400);

  const ok = await verifyPin(payload.pin as string, fam.parent_pin_hash);
  if (ok) {
    await admin.from("families").update({
      pin_failed_attempts: 0,
      pin_locked_until: null,
    }).eq("id", fam.id);
    return jsonResponse({ ok: true });
  }

  const newFails = (fam.pin_failed_attempts || 0) + 1;
  const patch: Record<string, unknown> = { pin_failed_attempts: newFails };
  let lockedUntil: string | null = null;
  if (newFails >= MAX_ATTEMPTS) {
    lockedUntil = new Date(now.getTime() + LOCKOUT_MS).toISOString();
    patch.pin_locked_until = lockedUntil;
    patch.pin_failed_attempts = 0; // reset the counter now that we've locked
  }
  await admin.from("families").update(patch).eq("id", fam.id);

  return jsonResponse({
    ok: false,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - newFails),
    lockedUntil,
    reason: lockedUntil ? "locked" : "bad_pin",
  }, lockedUntil ? 429 : 401);
});
