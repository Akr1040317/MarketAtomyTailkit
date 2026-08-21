import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

export async function startAssessmentCheckout(promoCode = "") {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const createCheckoutSession = httpsCallable(functions, "createCheckoutSession");
  const { data } = await createCheckoutSession({
    promoCode,
    successUrl: origin
      ? `${origin}/dashboard?purchase=success&session_id={CHECKOUT_SESSION_ID}`
      : undefined,
    cancelUrl: origin ? `${origin}/dashboard?purchase=cancel` : undefined,
  });
  if (data?.alreadyPurchased || data?.granted) {
    return { alreadyPurchased: true, granted: Boolean(data?.granted) };
  }
  if (!data?.url) throw new Error("Checkout did not return a URL.");
  window.location.assign(data.url);
  return { alreadyPurchased: false, granted: false };
}

export async function confirmAssessmentPurchase(sessionId) {
  const confirmCheckoutSession = httpsCallable(functions, "confirmCheckoutSession");
  const { data } = await confirmCheckoutSession({ sessionId });
  return Boolean(data?.purchased);
}
