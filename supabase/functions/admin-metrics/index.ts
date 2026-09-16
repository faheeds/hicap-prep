// admin-metrics edge function (Epic 6, E6-1).
//
// Returns a JSON snapshot of the founder funnel metrics:
// signup → engagement → paid conversion, plus attempt-type breakdown.
//
// Protected by a static ADMIN_SECRET bearer token — this is an internal
// founder tool, not a user-facing API. Keep the secret out of browser bundles
// by calling this function server-side or from the admin.html page only.
//
// Required Supabase project secret:
//   ADMIN_SECRET  — any sufficiently long random string

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "GET") {
    return new Response("method_not_allowed", { status: 405 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (!ADMIN_SECRET || auth !== `Bearer ${ADMIN_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // All counts run in parallel for speed.
  const [
    familiesTotal,
    familiesPaid,
    familiesEngaged,
    signupsLast7,
    signupsLast30,
    studentsTotal,
    attemptsTotal,
    attemptsPractice,
    attemptsProgram,
    attemptsMock,
    attemptsReview,
  ] = await Promise.all([
    admin.from("families").select("*", { count: "exact", head: true }),
    admin.from("families").select("*", { count: "exact", head: true })
         .in("pass_type", ["individual", "family", "family_annual"]),
    // "Engaged" = has at least one attempt (approximate via distinct families
    // referenced in attempts; cheap because family_id is indexed).
    admin.from("attempts").select("family_id", { count: "exact", head: true }),
    admin.from("families").select("*", { count: "exact", head: true })
         .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    admin.from("families").select("*", { count: "exact", head: true })
         .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
    admin.from("students").select("*", { count: "exact", head: true }),
    admin.from("attempts").select("*", { count: "exact", head: true }),
    admin.from("attempts").select("*", { count: "exact", head: true }).eq("kind", "practice"),
    admin.from("attempts").select("*", { count: "exact", head: true }).eq("kind", "program"),
    admin.from("attempts").select("*", { count: "exact", head: true }).eq("kind", "mock"),
    admin.from("attempts").select("*", { count: "exact", head: true }).eq("kind", "review"),
  ]);

  const total   = familiesTotal.count  ?? 0;
  const paid    = familiesPaid.count   ?? 0;
  const convPct = total > 0 ? Number(((paid / total) * 100).toFixed(1)) : 0;

  const body = {
    generatedAt: new Date().toISOString(),
    families: {
      total,
      paid,
      free: total - paid,
      conversionPct: convPct,
      signupsLast7Days:  signupsLast7.count  ?? 0,
      signupsLast30Days: signupsLast30.count ?? 0,
    },
    students: {
      total: studentsTotal.count ?? 0,
    },
    attempts: {
      total:    attemptsTotal.count    ?? 0,
      practice: attemptsPractice.count ?? 0,
      program:  attemptsProgram.count  ?? 0,
      mock:     attemptsMock.count     ?? 0,
      review:   attemptsReview.count   ?? 0,
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
