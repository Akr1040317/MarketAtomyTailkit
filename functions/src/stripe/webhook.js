const { onRequest } = require("firebase-functions/v2/https");
const Stripe = require("stripe");

const { stripeSecretKey, stripeWebhookSecret } = require("../config");
const { grantAssessmentAccess, sessionUid } = require("./grantAccess");

function getStripe() {
  const key = stripeSecretKey();
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing from functions/.env");
  return new Stripe(key, {
    apiVersion: "2026-07-29.dahlia",
  });
}

async function fulfillCheckoutSession(session) {
  if (!session || session.mode !== "payment") return;
  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (!paid) return;

  const uid = sessionUid(session);
  if (!uid) {
    console.error("Checkout session missing firebase uid", session.id);
    return;
  }

  await grantAssessmentAccess(uid, {
    assessmentPurchaseType: session.amount_total === 0 ? "promo" : "stripe",
    stripeCustomerId: session.customer || undefined,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    promoCodeUsed: session.metadata?.promoCode || undefined,
  });
}

const stripeWebhook = onRequest(
  {
    cors: false,
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const webhookSecret = stripeWebhookSecret();
    if (!stripeSecretKey() || !webhookSecret) {
      res.status(200).json({ received: true, configured: false });
      return;
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).send("Missing Stripe signature");
      return;
    }

    const stripe = getStripe();
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        webhookSecret
      );
    } catch (error) {
      console.error("Stripe webhook signature verification failed", error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    try {
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        await fulfillCheckoutSession(event.data.object);
      }
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Stripe webhook handler failed", error);
      res.status(500).send("Webhook handler failed");
    }
  }
);

module.exports = { stripeWebhook };
