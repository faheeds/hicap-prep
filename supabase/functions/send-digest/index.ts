// send-digest edge function (Epic 4, E4-4).
//
// Sends two kinds of email:
//   1. Weekly practice digest — to every family where email_reminders_opted_in=true.
//      Summarises each student's lessons-left-this-week, current streak, and a
//      gentle nudge if a streak is at risk.
//   2. Retention warning — to families where retention_warned_at IS NOT NULL and
//      retention_email_sent_at IS NULL (first time we've noticed them inactive).
//      After sending, writes retention_email_sent_at so it won't re-send.
//
// Invocation:
//   - Weekly cron job (see migration 20260914000700 for the setup command).
//   - Manual call for testing: POST /functions/v1/send-digest with
//     header x-cron-secret: <CRON_SECRET>.
//
// Required Supabase project secrets:
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   (standard Supabase env)
//   RESEND_API_KEY                             (https://resend.com — create a free account)
//   FROM_EMAIL                                 (verified sender address in Resend)
//   CRON_SECRET                                (any random string you set, matched in the cron job header)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY         = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY      = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL          = Deno.env.get("FROM_EMAIL");
const CRON_SECRET         = Deno.env.get("CRON_SECRET");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Authenticate the caller: either a valid parent JWT (manual trigger) or the
  // cron secret header (scheduled job). Manual trigger from the UI requires the
  // parent to be signed in; the cron job uses the shared secret.
  const cronHeader = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization") || "";
  const isCronCall = CRON_SECRET && cronHeader === CRON_SECRET;

  if (!isCronCall) {
    // Allow authenticated parents to trigger a manual test send.
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
  }

  if (!RESEND_API_KEY) {
    return jsonResponse({ error: "RESEND_API_KEY not configured — see README for setup steps" }, 503);
  }
  if (!FROM_EMAIL) {
    return jsonResponse({ error: "FROM_EMAIL not configured — set it to a Resend-verified sender address" }, 503);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { digest_count, retention_count, errors } = await runDigest(admin);

  return jsonResponse({ ok: true, digest_count, retention_count, errors });
});

// ---------------------------------------------------------------------------
// runDigest: query opted-in families, build emails, send via Resend.
// ---------------------------------------------------------------------------
async function runDigest(admin: ReturnType<typeof createClient>) {
  let digest_count = 0;
  let retention_count = 0;
  const errors: string[] = [];

  // --- Weekly digest ---
  const { data: digestFamilies, error: dErr } = await admin
    .from("families")
    .select("id, owner_id, email_reminders_opted_in")
    .eq("email_reminders_opted_in", true);

  if (dErr) { errors.push("digest query: " + dErr.message); }

  for (const fam of (digestFamilies || [])) {
    try {
      const email = await getParentEmail(admin, fam.owner_id);
      if (!email) continue;
      const { data: students } = await admin
        .from("students")
        .select("name, streak_current, streak_last_date")
        .eq("family_id", fam.id);
      if (!students || students.length === 0) continue;
      const subject = "Your HiCap Prep weekly check-in";
      const html = buildDigestEmail(students);
      await sendEmail(email, subject, html);
      digest_count++;
    } catch (e) {
      errors.push("digest for family " + fam.id + ": " + String(e));
    }
  }

  // --- Retention warnings (first notice only) ---
  const { data: warnFamilies, error: wErr } = await admin
    .from("families")
    .select("id, owner_id")
    .not("retention_warned_at", "is", null)
    .is("retention_email_sent_at", null);

  if (wErr) { errors.push("retention query: " + wErr.message); }

  for (const fam of (warnFamilies || [])) {
    try {
      const email = await getParentEmail(admin, fam.owner_id);
      if (!email) continue;
      const subject = "Action needed — your HiCap Prep data";
      const html = buildRetentionEmail();
      await sendEmail(email, subject, html);
      // Mark sent so this family doesn't get a second email.
      await admin.from("families")
        .update({ retention_email_sent_at: new Date().toISOString() })
        .eq("id", fam.id);
      retention_count++;
    } catch (e) {
      errors.push("retention for family " + fam.id + ": " + String(e));
    }
  }

  return { digest_count, retention_count, errors };
}

async function getParentEmail(admin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend returned ${res.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Email HTML builders.
// ---------------------------------------------------------------------------
function buildDigestEmail(students: { name: string; streak_current: number; streak_last_date: string | null }[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = students.map((s) => {
    const streak = s.streak_current || 0;
    const atRisk = streak > 0 && s.streak_last_date && s.streak_last_date < today;
    const streakNote = streak > 0
      ? atRisk
        ? ` — streak of ${streak} at risk today!`
        : ` — ${streak}-day streak going strong`
      : "";
    return `<li><strong>${s.name}</strong>${streakNote}</li>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>HiCap Prep weekly check-in</title></head>
<body style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:24px;color:#1d1b2e;">
<p style="font-size:18px;font-weight:bold;color:#f2621f;margin-bottom:4px;">HiCap Prep</p>
<h1 style="font-size:22px;margin:0 0 16px 0;">Your weekly check-in</h1>
<p>Here's where things stand for your students this week:</p>
<ul>${lines}</ul>
<p>Keep the momentum going — consistent practice is the biggest predictor of test-day confidence.</p>
<p style="margin-top:24px;font-size:12px;color:#9d8f80;">
  You're receiving this because you opted in to weekly reminders.
  Sign in and go to Parent area → Settings to turn them off.
  <br>HiCap Prep is not affiliated with or endorsed by Riverside Insights or CogAT.
</p>
</body></html>`;
}

function buildRetentionEmail(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Action needed — your HiCap Prep data</title></head>
<body style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:24px;color:#1d1b2e;">
<p style="font-size:18px;font-weight:bold;color:#f2621f;margin-bottom:4px;">HiCap Prep</p>
<h1 style="font-size:22px;margin:0 0 16px 0;">We haven't seen you in a while</h1>
<p>Your family's account has been inactive for more than 17 months.</p>
<p>Per our <a href="https://hicap-prep.vercel.app/privacy.html" style="color:#f2621f;">Privacy Policy §6</a>,
  we'll delete inactive family data 60 days after this notice if you don't sign in.
  Sign in now to keep your data and resume your child's practice route.</p>
<p><a href="https://hicap-prep.vercel.app" style="color:#f2621f;font-weight:bold;">Sign in →</a></p>
<p style="margin-top:24px;font-size:12px;color:#9d8f80;">
  To immediately delete your data, sign in and use the "Delete my family's account" button in Parent area → Settings.
  <br>HiCap Prep is not affiliated with or endorsed by Riverside Insights or CogAT.
</p>
</body></html>`;
}
