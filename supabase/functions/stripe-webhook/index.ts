// stripe-webhook edge function (Epic 3, E3-1 / E3-2 / E3-3 / E3-5).
//
// Receives Stripe webhook events and updates families.pass_type +
// related fields so the client entitlement gate reflects real purchase state.
//
// Events handled:
//   checkout.session.completed      — one-time purchase OR subscription first payment
//   customer.subscription.updated   — renewal billing date shift / plan change
//   customer.subscription.deleted   — cancelled subscription (or exhausted Smart Retries)
//   invoice.payment_failed          — subscription renewal payment failed; extends
//                                     pass_expires_at by PAYMENT_FAILURE_GRACE_MS so
//                                     the family retains access while Stripe retries.
//                                     Access is ultimately revoked only if all retries
//                                     fail and customer.subscription.deleted fires.
//
// Register this endpoint in the Stripe dashboard:
//   Developers → Webhooks → Add endpoint
//   URL: <SUPABASE_URL>/functions/v1/stripe-webhook
//   Events to send: checkout.session.completed, customer.subscription.updated,
//                   customer.subscription.deleted, invoice.payment_failed
//
// Required Supabase project secrets:
//   STRIPE_SECRET_KEY         — sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET     — whsec_... from the Stripe webhook dashboard

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET  = Deno.env.get("STRIPE_SECRET_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Grace period given to Stripe's Smart Retries before access is revoked after a
// failed renewal payment. Stripe retries for up to ~8 days; 7 days ensures the
// family's access is still active if the card succeeds on the final attempt.
// If all retries fail, customer.subscription.deleted resets the pass to free.
const PAYMENT_FAILURE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

// A pass purchased today for the current testing season. One-time passes
// (Individual + Family) expire on July 31 of the current or next school year.
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

  // Signature verification must succeed before any DB access.
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("invalid_signature", { status: 400 });
  }

  // Idempotency guard — Stripe delivers events at-least-once; a delayed
  // duplicate checkout.session.completed could otherwise re-grant access that
  // was legitimately revoked by a later subscription.deleted. Skip any event
  // whose ID we've already recorded in stripe_processed_events.
  const { data: alreadyProcessed } = await admin
    .from("stripe_processed_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (alreadyProcessed) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const familyId   = meta.family_id;
      const passType   = meta.pass_type as string; // 'individual'|'family'|'family_annual'
      const studentId  = meta.student_id || null;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subId      = typeof session.subscription === "string" ? session.subscription : null;

      if (!familyId || !passType) {
        console.error("Missing metadata on checkout session", session.id);
        break;
      }

      let expiresAt: string | null = null;
      if (session.mode === "subscription" && subId) {
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

      // Referral attribution (E6-2): if this family was referred, increment
      // the referrer's referred_count so the founder can honor their reward.
      const { data: purchasingFam } = await admin
        .from("families").select("referred_by").eq("id", familyId).maybeSingle();
      if (purchasingFam?.referred_by) {
        const { data: referrerFam } = await admin
          .from("families")
          .select("id, referred_count")
          .eq("referral_code", purchasingFam.referred_by)
          .maybeSingle();
        if (referrerFam) {
          await admin.from("families")
            .update({ referred_count: (referrerFam.referred_count || 0) + 1 })
            .eq("id", referrerFam.id);
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (!customerId) break;
      // Only advance the expiry date when the subscription is active and in
      // good standing. Skipping past_due status prevents this event from
      // overwriting the grace-period window set by invoice.payment_failed —
      // on a failed renewal, Stripe fires subscription.updated with status
      // 'past_due' and current_period_end = the date payment was due (now
      // in the past), which would immediately revoke access before retries run.
      if (sub.status === "active") {
        const expiresAt = new Date(sub.current_period_end * 1000).toISOString();
        await admin.from("families")
          .update({ pass_expires_at: expiresAt })
          .eq("stripe_customer_id", customerId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (!customerId) break;
      // Subscription cancelled or Smart Retries exhausted — revert to free tier.
      await admin.from("families")
        .update({
          pass_type:              "free",
          pass_expires_at:        null,
          stripe_subscription_id: null,
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.payment_failed": {
      // Subscription renewal payment failed. Grant a grace period so the family
      // retains access while Stripe retries via Smart Retries (up to ~8 days).
      // The subscription.updated event that fires alongside this one carries
      // status 'past_due' — we skip that update to preserve this grace window.
      // If all retries are exhausted, customer.subscription.deleted fires and
      // reverts the pass to free.
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) break;
      const gracePeriodEnd = new Date(Date.now() + PAYMENT_FAILURE_GRACE_MS).toISOString();
      await admin.from("families")
        .update({ pass_expires_at: gracePeriodEnd })
        .eq("stripe_customer_id", customerId);
      break;
    }

    default:
      // Return 200 so Stripe doesn't retry unhandled event types.
      console.log("Unhandled webhook event:", event.type);
  }

  // Record this event as processed AFTER the business logic so that if the
  // handler throws mid-flight, Stripe's retry will attempt it again rather
  // than silently dropping it. Duplicate delivery is safe because of the
  // alreadyProcessed check above.
  await admin.from("stripe_processed_events").insert({ event_id: event.id });

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
