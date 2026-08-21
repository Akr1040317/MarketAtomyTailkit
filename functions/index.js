const { setGlobalOptions } = require("firebase-functions/v2");

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

const { onUserCreated } = require("./src/emails/welcomeEmail");
const { checkIncompleteAssessments } = require("./src/emails/reminderEmail");
const { onAssessmentComplete } = require("./src/emails/completionEmail");
const { createCheckoutSession, confirmCheckoutSession } = require("./src/stripe/checkout");
const { stripeWebhook } = require("./src/stripe/webhook");

exports.onUserCreated = onUserCreated;
exports.checkIncompleteAssessments = checkIncompleteAssessments;
exports.onAssessmentComplete = onAssessmentComplete;
exports.createCheckoutSession = createCheckoutSession;
exports.confirmCheckoutSession = confirmCheckoutSession;
exports.stripeWebhook = stripeWebhook;

