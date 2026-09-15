// set-pin edge function (Epic 1, E1-6).
//
// The client POSTs { pin: "1234", currentPin?: "9999" }.
//   - If the family already has a PIN, currentPin must be provided and must
//     verify against the stored hash. This blocks a session hijack from
//     silently changing the PIN.
//   - If no PIN is set yet (first-time setup), currentPin is not required.
//
// On success we also reset the rate-limit counters so a fresh PIN starts with
// a clean slate.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { hashPin, verifyPin, isValidPinShape } from "../_shared/pin.ts";

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

  let payload: { pin?: unknown; currentPin?: unknown };
  try { payload = await req.json(); } catch { return jsonResponse({ error: "bad_json" }, 400); }
  if (!isValidPinShape(payload.pin)) return jsonResponse({ error: "bad_pin_shape" }, 400);

  const { data: fam, error: famErr } = await admin
    .from("families")
    .select("id, parent_pin_hash")
    .eq("owner_id", userId)
    .maybeSingle();
  if (famErr || !fam) return jsonResponse({ error: "family_not_found" }, 404);

  if (fam.parent_pin_hash) {
    if (!isValidPinShape(payload.currentPin)) return jsonResponse({ error: "current_pin_required" }, 400);
    const ok = await verifyPin(payload.currentPin as string, fam.parent_pin_hash);
    if (!ok) return jsonResponse({ error: "current_pin_wrong" }, 401);
  }

  const newHash = await hashPin(payload.pin as string);
  const { error } = await admin.from("families").update({
    parent_pin_hash: newHash,
    pin_failed_attempts: 0,
    pin_locked_until: null,
  }).eq("id", fam.id);
  if (error) return jsonResponse({ error: "update_failed" }, 500);
  return jsonResponse({ ok: true });
});
