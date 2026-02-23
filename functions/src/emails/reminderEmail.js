const { onSchedule } = require("firebase-functions/v2/scheduler");

const { admin, db } = require("../utils/firebaseAdmin");
const { queueEmail } = require("../utils/emailQueue");
const { loadTemplate, renderTemplate } = require("../utils/templateLoader");
const { toDate, diffDays } = require("../utils/dateUtils");
const {
  getAssessmentSections,
  getUserSectionResults,
  summarizeProgress,
} = require("../utils/assessmentProgress");
const {
  APP_BASE_URL,
  SUPPORT_EMAIL,
  FIRST_REMINDER_AFTER_DAYS,
  REMINDER_INTERVAL_DAYS,
  MAX_REMINDERS,
} = require("../config");

const reminderTemplate = loadTemplate("reminder.html");

function getAssessmentUrl() {
  return `${APP_BASE_URL.value()}/dashboard`;
}

async function* iterateQuery(query) {
  let lastDoc = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = lastDoc ? query.startAfter(lastDoc) : query;
    const snap = await q.get();
    if (snap.empty) return;
    for (const doc of snap.docs) yield doc;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < 300) return;
  }
}

function shouldSendReminder({ now, userData }) {
  const prefs = userData.emailPreferences || {};
  const reminderCount = prefs.reminderCount || 0;
  if (prefs.unsubscribed) return { ok: false, reason: "unsubscribed" };
  if (prefs.completionEmailSent) return { ok: false, reason: "completed" };
  if (reminderCount >= MAX_REMINDERS.value()) {
    return { ok: false, reason: "max_reminders" };
  }

  const createdAt = toDate(userData.createdAt);
  if (!createdAt) return { ok: false, reason: "missing_createdAt" };

  const lastReminderSentAt = toDate(prefs.lastReminderSentAt);

  if (!lastReminderSentAt) {
    const daysSinceSignup = diffDays(now, createdAt);
    return {
      ok: daysSinceSignup >= FIRST_REMINDER_AFTER_DAYS.value(),
      reason: "first_reminder_check",
    };
  }

  const daysSinceLast = diffDays(now, lastReminderSentAt);
  return {
    ok: daysSinceLast >= REMINDER_INTERVAL_DAYS.value(),
    reason: "interval_check",
  };
}

const checkIncompleteAssessments = onSchedule("every day 09:00", async () => {
  const now = new Date();

  // Fetch assessment sections once.
  const sections = await getAssessmentSections();

  // Start from users who were onboarded (welcome email sent).
  const baseQuery = db
    .collection("users")
    .where("emailPreferences.welcomeEmailSent", "==", true)
    .orderBy("createdAt")
    .limit(300);

  for await (const userDoc of iterateQuery(baseQuery)) {
    const userId = userDoc.id;
    const userData = userDoc.data() || {};

    const email = userData.email;
    if (!email) continue;

    const gate = shouldSendReminder({ now, userData });
    if (!gate.ok) continue;

    const sectionResults = await getUserSectionResults(userId);
    const progress = summarizeProgress({ sections, sectionResults });

    // If complete (or no sections), do not remind.
    if (progress.totalSections === 0) continue;
    if (progress.completedCount >= progress.totalSections) continue;

    const firstName = userData.firstName || "there";

    const html = renderTemplate(reminderTemplate, {
      firstName,
      completionPercentage: progress.completionPercentage,
      completedCount: progress.completedCount,
      totalSections: progress.totalSections,
      remainingCount: progress.remainingCount,
      currentSectionTitle: progress.currentSectionTitle || "Next available section",
      assessmentUrl: getAssessmentUrl(),
      supportEmail: SUPPORT_EMAIL.value(),
    });

    await queueEmail({
      to: email,
      subject: `Continue Your Business Health Assessment — ${progress.completionPercentage}% complete`,
      html,
      text: `Hi ${firstName},\n\nYou're ${progress.completionPercentage}% done (${progress.completedCount}/${progress.totalSections}).\nNext section: ${progress.currentSectionTitle || "Next available section"}\n\nContinue here: ${getAssessmentUrl()}\n\nSupport: ${SUPPORT_EMAIL.value()}`,
    });

    const prefs = userData.emailPreferences || {};
    const reminderCount = (prefs.reminderCount || 0) + 1;

    await db
      .collection("users")
      .doc(userId)
      .set(
        {
          emailPreferences: {
            ...prefs,
            lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
            reminderCount,
          },
        },
        { merge: true }
      );
  }
});

module.exports = { checkIncompleteAssessments };

