// create-portal-session edge function (Epic 3, E3-8).
//
// Opens a Stripe Customer Portal session for the authenticated parent.
// The portal lets them:
//   - Cancel their Annual Family Pass subscription (E3-5)
//   - Update payment method
//   - View invoice / payment history
//   - Request a refund (via the portal, within Stripe's standard policy)
//
// The 14-day refund window for one-time passes (src/terms.html §4) is
// enforced by Stripe's dashboard refund tool; this function handles
// subscription management only.
//
// Required Supabase project secrets: STRIPE_SECRET_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  if (!STRIPE_SECRET) {
    return jsonResponse({ error: "STRIPE_SECRET_KEY not configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userRes.user) return jsonResponse({ error: "unauthorized" }, 401);

  const { data: fam } = await admin.from("families")
    .select("stripe_customer_id")
    .eq("owner_id", userRes.user.id)
    .maybeSingle();

  if (!fam || !fam.stripe_customer_id) {
    return jsonResponse({ error: "no_stripe_customer — no purchase history found for this account" }, 404);
  }

  let body: { returnUrl?: string };
  try { body = await req.json(); } catch { body = {}; }
  const returnUrl = body.returnUrl || "https://hicapprep.com/app.html";

  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2024-04-10" });

  // Ensure the Customer Portal is configured in the Stripe dashboard:
  // Stripe Dashboard → Settings → Billing → Customer Portal → Activate.
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: fam.stripe_customer_id,
    return_url: returnUrl,
  });

  return jsonResponse({ url: portalSession.url });
});
