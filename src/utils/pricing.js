export const ASSESSMENT_PRICE_USD = 297;
export const ASSESSMENT_PRICE_LABEL = "$297";
export const ASSESSMENT_PRODUCT_NAME = "Business Health Check Assessment";
export const BETA_PROMO_CODE = "beta2026!";

export function isBetaPromoCode(code) {
  const normalized = String(code || "").trim().toLowerCase();
  return normalized === "beta2026!" || normalized === "beta2026";
}

export function hasAssessmentEntitlement(userData = {}, hasResults = false) {
  if (userData.role === "admin") return true;
  if (userData.assessmentPurchased === true) return true;
  return Boolean(hasResults);
}
