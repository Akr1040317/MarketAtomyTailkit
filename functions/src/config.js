const { defineInt, defineString } = require("firebase-functions/params");

// Where emails should link users back into the app.
const APP_BASE_URL = defineString("APP_BASE_URL", {
  default: "https://businesshealthassessment.web.app",
});

const SUPPORT_EMAIL = defineString("SUPPORT_EMAIL", {
  default: "support@marketatomy.com",
});

const MAIL_COLLECTION = defineString("MAIL_COLLECTION", {
  default: "mail",
});

const FIRST_REMINDER_AFTER_DAYS = defineInt("FIRST_REMINDER_AFTER_DAYS", {
  default: 2,
});
const REMINDER_INTERVAL_DAYS = defineInt("REMINDER_INTERVAL_DAYS", {
  default: 3,
});
const MAX_REMINDERS = defineInt("MAX_REMINDERS", { default: 5 });

function stripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY || "").trim();
}

function stripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
}

module.exports = {
  APP_BASE_URL,
  SUPPORT_EMAIL,
  MAIL_COLLECTION,
  FIRST_REMINDER_AFTER_DAYS,
  REMINDER_INTERVAL_DAYS,
  MAX_REMINDERS,
  stripeSecretKey,
  stripeWebhookSecret,
};
