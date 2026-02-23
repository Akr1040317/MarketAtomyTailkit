const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const { admin, db } = require("../utils/firebaseAdmin");
const { queueEmail } = require("../utils/emailQueue");
const { loadTemplate, renderTemplate } = require("../utils/templateLoader");
const {
  getAssessmentSections,
  getUserSectionResults,
  summarizeProgress,
} = require("../utils/assessmentProgress");
const { APP_BASE_URL, SUPPORT_EMAIL } = require("../config");

const completionTemplate = loadTemplate("completion.html");

function getReportUrl() {
  return `${APP_BASE_URL.value()}/dashboard`;
}

function formatHealthLevel(level) {
  if (!level) return "Unknown";
  const s = String(level).toLowerCase();
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  return level;
}

const onAssessmentComplete = onDocumentCreated(
  "sectionResults/{resultId}",
  async (event) => {
    const resultData = event.data?.data?.() || {};
    const userId = resultData.userId;
    if (!userId) return;

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return;

    const userData = userSnap.data() || {};
    const email = userData.email;
    if (!email) return;

    const prefs = userData.emailPreferences || {};
    if (prefs.unsubscribed) return;
    if (prefs.completionEmailSent) return;

    const sections = await getAssessmentSections();
    const sectionResults = await getUserSectionResults(userId);
    const progress = summarizeProgress({ sections, sectionResults });

    if (progress.totalSections === 0) return;
    if (progress.completedCount < progress.totalSections) return;

    const firstName = userData.firstName || "there";
    const overallHealthLevel = formatHealthLevel(
      userData.overallHealth?.healthLevel
    );

    const html = renderTemplate(completionTemplate, {
      firstName,
      overallHealthLevel,
      reportUrl: getReportUrl(),
      supportEmail: SUPPORT_EMAIL.value(),
    });

    await queueEmail({
      to: email,
      subject: "Congratulations! You've completed your assessment",
      html,
      text: `Congrats, ${firstName} — your assessment is complete.\n\nView your full report: ${getReportUrl()}\n\nSupport: ${SUPPORT_EMAIL.value()}`,
    });

    await userRef.set(
      {
        emailPreferences: {
          ...prefs,
          completionEmailSent: true,
          completionEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
          assessmentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
  }
);

module.exports = { onAssessmentComplete };

