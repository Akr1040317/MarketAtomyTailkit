import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

export async function startAssessmentCheckout(promoCode = "") {
  const createCheckoutSession = httpsCallable(functions, "createCheckoutSession");
  const { data } = await createCheckoutSession({ promoCode });
  if (data?.alreadyPurchased) return { alreadyPurchased: true };
  if (!data?.url) throw new Error("Checkout did not return a URL.");
  window.location.assign(data.url);
  return { alreadyPurchased: false };
}

export async function confirmAssessmentPurchase(sessionId) {
  const confirmCheckoutSession = httpsCallable(functions, "confirmCheckoutSession");
  const { data } = await confirmCheckoutSession({ sessionId });
  return Boolean(data?.purchased);
}
