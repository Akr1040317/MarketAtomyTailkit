const { onCall, HttpsError } = require("firebase-functions/v2/https");
const Stripe = require("stripe");

const { db } = require("../utils/firebaseAdmin");
const { APP_BASE_URL, stripeSecretKey } = require("../config");
const { getStripeCatalog, isBetaPromoCode } = require("./catalog");
const { grantAssessmentAccess, sessionUid } = require("./grantAccess");

function randomSuffix() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += letters[Math.floor(Math.random() * letters.length)];
  }
  return out;
}

function fallbackAppUrl() {
  return `${APP_BASE_URL.value()}/dashboard`;
}

function safeReturnUrl(candidate, fallback) {
  try {
    const parsed = new URL(String(candidate || ""));
    const host = parsed.hostname.toLowerCase();
    const allowed =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".web.app") ||
      host.endsWith(".firebaseapp.com");
    if (!allowed || parsed.pathname !== "/dashboard") return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function getStripe() {
  const key = stripeSecretKey();
  if (!key) {
    throw new HttpsError(
      "failed-precondition",
      "Stripe is not configured. Add STRIPE_SECRET_KEY to functions/.env and redeploy."
    );
  }
  return new Stripe(key, {
    apiVersion: "2026-07-29.dahlia",
  });
}

const createCheckoutSession = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to purchase the assessment.");
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email || "";
    const promoCode = String(request.data?.promoCode || "").trim();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};

    if (userData.assessmentPurchased === true || userData.role === "admin") {
      return { alreadyPurchased: true, url: null };
    }

    if (promoCode && !isBetaPromoCode(promoCode)) {
      throw new HttpsError("invalid-argument", "That promo code is not valid.");
    }

    const applyBeta = Boolean(promoCode) && isBetaPromoCode(promoCode);
    if (applyBeta) {
      await grantAssessmentAccess(uid, {
        assessmentPurchaseType: "promo",
        promoCodeUsed: "beta2026!",
      });
      return { alreadyPurchased: true, granted: true, url: null };
    }

    const stripe = getStripe();
    const catalog = getStripeCatalog(stripeSecretKey());
    const returnOrigin = safeReturnUrl(request.data?.successUrl, `${fallbackAppUrl()}?purchase=success`);
    const parsedReturn = new URL(returnOrigin);
    const successUrl = `${parsedReturn.origin}/dashboard?purchase=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${parsedReturn.origin}/dashboard?purchase=cancel`;

    const sessionParams = {
      mode: "payment",
      line_items: [{ price: catalog.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: uid,
      metadata: {
        firebaseUid: uid,
        product: "bhc_assessment",
        promoCode: applyBeta ? "beta2026!" : "",
      },
      customer_creation: "always",
      payment_method_collection: "if_required",
      integration_identifier: `bhc-welcome-${randomSuffix()}`,
    };

    if (userData.stripeCustomerId) {
      sessionParams.customer = userData.stripeCustomerId;
      delete sessionParams.customer_creation;
    } else if (email) {
      sessionParams.customer_email = email;
    }

    sessionParams.allow_promotion_codes = true;

    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) {
      throw new HttpsError("internal", "Stripe did not return a checkout URL.");
    }

    return { url: session.url, alreadyPurchased: false };
  }
);

const confirmCheckoutSession = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in to confirm your purchase.");
    }

    const sessionId = String(request.data?.sessionId || "").trim();
    if (!sessionId) {
      throw new HttpsError("invalid-argument", "Missing checkout session.");
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const uid = sessionUid(session);

    if (!uid || uid !== request.auth.uid) {
      throw new HttpsError("permission-denied", "This checkout session does not belong to you.");
    }

    const paid = session.status === "complete" && (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    if (!paid) {
      return { purchased: false };
    }

    await grantAssessmentAccess(uid, {
      assessmentPurchaseType: session.amount_total === 0 ? "promo" : "stripe",
      stripeCustomerId: session.customer || undefined,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      promoCodeUsed: session.metadata?.promoCode || undefined,
    });

    return { purchased: true };
  }
);

module.exports = {
  createCheckoutSession,
  confirmCheckoutSession,
};
