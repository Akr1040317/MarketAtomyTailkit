const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const { admin, db } = require("../utils/firebaseAdmin");
const { queueEmail } = require("../utils/emailQueue");
const { loadTemplate, renderTemplate } = require("../utils/templateLoader");
const { APP_BASE_URL, SUPPORT_EMAIL } = require("../config");

const welcomeTemplate = loadTemplate("welcome.html");

function getAssessmentUrl() {
  // The app is routed; users land in the dashboard and can continue assessment.
  return `${APP_BASE_URL.value()}/dashboard`;
}

const onUserCreated = onDocumentCreated("users/{userId}", async (event) => {
  const userId = event.params.userId;
  const userData = event.data?.data?.() || {};

  const email = userData.email;
  if (!email) return;

  const emailPreferences = userData.emailPreferences || {};
  if (emailPreferences.welcomeEmailSent) return;
  if (emailPreferences.unsubscribed) return;

  const firstName = userData.firstName || "there";

  const html = renderTemplate(welcomeTemplate, {
    firstName,
    assessmentUrl: getAssessmentUrl(),
    supportEmail: SUPPORT_EMAIL.value(),
  });

  await queueEmail({
    to: email,
    subject: "Welcome to MarketAtomy Business Health Assessment!",
    html,
    text: `Welcome, ${firstName}.\n\nStart or continue your assessment here: ${getAssessmentUrl()}\n\nNeed help? ${SUPPORT_EMAIL.value()}`,
  });

  await db
    .collection("users")
    .doc(userId)
    .set(
      {
        emailPreferences: {
          welcomeEmailSent: true,
          welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          reminderCount: emailPreferences.reminderCount || 0,
        },
      },
      { merge: true }
    );
});

module.exports = { onUserCreated };

