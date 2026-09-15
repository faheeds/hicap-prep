// delete-account edge function (Epic 1, E1-7).
//
// COPPA-compliant hard-delete: removes the caller's auth.users row, which
// cascades through the FK chain and drops families -> students -> attempts
// -> badges_earned. No soft-delete, no "keep for 30 days" grace — the
// parent asked for their data to be gone, so it goes.
//
// The caller confirms their own identity by presenting the session JWT.
// We do NOT accept a userId in the body — that would let a hijacked or
// spoofed request nuke someone else's family.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

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

  // Cascade the delete via auth.users -> families FK. Wrapping students /
  // attempts / badges in explicit deletes as belt-and-suspenders in case
  // something in a future migration accidentally drops the ON DELETE CASCADE.
  const { data: fam } = await admin.from("families").select("id").eq("owner_id", userId).maybeSingle();
  if (fam) {
    await admin.from("badges_earned").delete().eq("family_id", fam.id);
    await admin.from("attempts").delete().eq("family_id", fam.id);
    await admin.from("students").delete().eq("family_id", fam.id);
    await admin.from("families").delete().eq("id", fam.id);
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return jsonResponse({ error: "auth_delete_failed", detail: delErr.message }, 500);

  return jsonResponse({ ok: true });
});
