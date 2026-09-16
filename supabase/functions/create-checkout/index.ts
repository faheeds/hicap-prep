// create-checkout edge function (Epic 3, E3-1 / E3-2 / E3-3 / E3-5).
//
// Creates a Stripe Checkout session for one of three pass types, then returns
// the hosted checkout URL. The browser redirects there; no card details ever
// touch our server (Stripe Checkout handles PCI scope).
//
// Body shape:
//   { priceType: 'individual' | 'family' | 'annual',
//     studentId?: string,      // required for 'individual'
//     successUrl: string,      // where Stripe redirects on success
//     cancelUrl: string }      // where Stripe redirects on cancel
//
// Required Supabase project secrets:
//   STRIPE_SECRET_KEY         — sk_test_... or sk_live_...
//   STRIPE_PRICE_INDIVIDUAL   — price_... for the $49 one-time product
//   STRIPE_PRICE_FAMILY       — price_... for the $79 one-time product
//   STRIPE_PRICE_ANNUAL       — price_... for the $129/yr subscription product

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET   = Deno.env.get("STRIPE_SECRET_KEY");
const PRICE_INDIVIDUAL = Deno.env.get("STRIPE_PRICE_INDIVIDUAL");
const PRICE_FAMILY     = Deno.env.get("STRIPE_PRICE_FAMILY");
const PRICE_ANNUAL     = Deno.env.get("STRIPE_PRICE_ANNUAL");

type PriceType = "individual" | "family" | "annual";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  if (!STRIPE_SECRET) {
    return jsonResponse({
      error: "STRIPE_SECRET_KEY not configured. See .env.example for setup instructions."
    }, 503);
  }

  // Authenticate the parent via their session JWT.
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userRes.user) return jsonResponse({ error: "unauthorized" }, 401);

  const userId = userRes.user.id;
  const parentEmail = userRes.user.email;

  // Load the family row to get the family_id (and reuse existing Stripe customer if present).
  const { data: fam } = await admin.from("families")
    .select("id, stripe_customer_id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!fam) return jsonResponse({ error: "family_not_found" }, 404);

  let body: { priceType: PriceType; studentId?: string; successUrl?: string; cancelUrl?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

  const { priceType, studentId, successUrl, cancelUrl } = body;
  if (!["individual", "family", "annual"].includes(priceType)) {
    return jsonResponse({ error: "invalid_price_type" }, 400);
  }
  if (priceType === "individual" && !studentId) {
    return jsonResponse({ error: "student_id_required_for_individual_pass" }, 400);
  }

  const priceId = priceType === "individual" ? PRICE_INDIVIDUAL
                : priceType === "family"     ? PRICE_FAMILY
                :                              PRICE_ANNUAL;

  if (!priceId) {
    return jsonResponse({
      error: `STRIPE_PRICE_${priceType.toUpperCase()} not configured. See .env.example.`
    }, 503);
  }

  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2024-04-10" });

  // Reuse existing Stripe customer when possible to keep purchase history together.
  let customerId = fam.stripe_customer_id || undefined;
  if (!customerId && parentEmail) {
    const customer = await stripe.customers.create({
      email: parentEmail,
      metadata: { family_id: fam.id },
    });
    customerId = customer.id;
    await admin.from("families").update({ stripe_customer_id: customerId }).eq("id", fam.id);
  }

  const mode = priceType === "annual" ? "subscription" : "payment";
  const appUrl = successUrl || "https://hicap-prep.vercel.app/app.html";

  const session = await stripe.checkout.sessions.create({
    mode,
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: (successUrl || appUrl) + "?stripe_success=1",
    cancel_url: cancelUrl || appUrl,
    allow_promotion_codes: true,   // E3-7: enables Stripe Coupons at checkout
    metadata: {
      family_id: fam.id,
      pass_type: priceType === "annual" ? "family_annual" : priceType,
      student_id: studentId || "",
    },
    ...(mode === "subscription" && {
      subscription_data: {
        metadata: {
          family_id: fam.id,
          pass_type: "family_annual",
        },
      },
    }),
  });

  return jsonResponse({ url: session.url });
});
