// stripe-webhook edge function (Epic 3, E3-1 / E3-2 / E3-3 / E3-5).
//
// Receives Stripe webhook events and updates families.pass_type +
// related fields so the client entitlement gate reflects real purchase state.
//
// Events handled:
//   checkout.session.completed      — one-time purchase OR subscription first payment
//   customer.subscription.updated   — renewal billing date shift / plan change
//   customer.subscription.deleted   — cancelled subscription
//
// Register this endpoint in the Stripe dashboard:
//   Developers → Webhooks → Add endpoint
//   URL: <SUPABASE_URL>/functions/v1/stripe-webhook
//   Events to send: checkout.session.completed, customer.subscription.updated,
//                   customer.subscription.deleted
//
// Required Supabase project secrets:
//   STRIPE_SECRET_KEY         — sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET     — whsec_... from the Stripe webhook dashboard

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET     = Deno.env.get("STRIPE_SECRET_KEY")!;
const WEBHOOK_SECRET    = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// A pass purchased today and lasting one year. Used for one-time passes
// whose effective duration is tied to the school year (Individual + Family).
// If the customer purchases before July 31, expiry = July 31 of that year;
// otherwise expiry = July 31 of next year. This reflects the "one season"
// model in src/terms.html.
function seasonExpiry(): string {
  const now = new Date();
  const year = now.getFullYear();
  const jul31 = new Date(year, 6, 31, 23, 59, 59); // month is 0-indexed
  const expiry = now <= jul31 ? jul31 : new Date(year + 1, 6, 31, 23, 59, 59);
  return expiry.toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  if (!STRIPE_SECRET || !WEBHOOK_SECRET) {
    console.error("Stripe secrets not configured");
    return new Response("server_misconfigured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature") || "";
  const rawBody = await req.arrayBuffer();
  const payload = new TextDecoder().decode(rawBody);

  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: "2024-04-10" });
  const admin  = createClient(SUPABASE_URL, SERVICE_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("invalid_signature", { status: 400 });
  }

  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const familyId    = meta.family_id;
      const passType    = meta.pass_type as string;  // 'individual'|'family'|'family_annual'
      const studentId   = meta.student_id || null;
      const customerId  = typeof session.customer === "string" ? session.customer : null;
      const subId       = typeof session.subscription === "string" ? session.subscription : null;

      if (!familyId || !passType) {
        console.error("Missing metadata on checkout session", session.id);
        break;
      }

      let expiresAt: string | null = null;
      if (session.mode === "subscription" && subId) {
        // Subscription expiry is managed by customer.subscription.updated events.
        // Fetch the subscription to get the current_period_end.
        const sub = await stripe.subscriptions.retrieve(subId);
        expiresAt = new Date(sub.current_period_end * 1000).toISOString();
      } else {
        expiresAt = seasonExpiry();
      }

      await admin.from("families").update({
        pass_type:              passType,
        pass_student_id:        passType === "individual" ? studentId : null,
        pass_expires_at:        expiresAt,
        stripe_customer_id:     customerId,
        stripe_subscription_id: subId,
      }).eq("id", familyId);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (!customerId) break;
      const expiresAt = new Date(sub.current_period_end * 1000).toISOString();
      await admin.from("families")
        .update({ pass_expires_at: expiresAt })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (!customerId) break;
      // Subscription cancelled — revert to free tier.
      await admin.from("families")
        .update({
          pass_type:              "free",
          pass_expires_at:        null,
          stripe_subscription_id: null,
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    default:
      // Unhandled event type — log and return 200 so Stripe doesn't retry.
      console.log("Unhandled webhook event:", event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
