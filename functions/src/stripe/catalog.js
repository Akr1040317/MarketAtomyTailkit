const TEST_CATALOG = {
  productId: "prod_V7AmzYAhYqpkqX",
  priceId: "price_1U6wRPQyQYrLwJEk1qIGXojz",
  couponId: "BETA2026",
};

function isLiveKey(secretKey) {
  return String(secretKey || "").startsWith("sk_live") || String(secretKey || "").startsWith("rk_live");
}

function getStripeCatalog(secretKey) {
  if (!isLiveKey(secretKey)) return TEST_CATALOG;

  const productId = process.env.STRIPE_LIVE_PRODUCT_ID || "";
  const priceId = process.env.STRIPE_LIVE_PRICE_ID || "";
  const couponId = process.env.STRIPE_LIVE_COUPON_ID || "BETA2026";

  if (!productId || !priceId) {
    throw new Error("Live Stripe catalog is not configured. Set STRIPE_LIVE_PRODUCT_ID and STRIPE_LIVE_PRICE_ID.");
  }

  return { productId, priceId, couponId };
}

function isBetaPromoCode(code) {
  const normalized = String(code || "").trim().toLowerCase();
  return normalized === "beta2026!" || normalized === "beta2026";
}

module.exports = {
  TEST_CATALOG,
  getStripeCatalog,
  isBetaPromoCode,
  isLiveKey,
};
