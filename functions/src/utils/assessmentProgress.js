const { db } = require("./firebaseAdmin");

async function getAssessmentSections() {
  const snap = await db.collection("BHC_Assessment").orderBy("order").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getUserSectionResults(userId) {
  const snap = await db
    .collection("sectionResults")
    .where("userId", "==", userId)
    .get();
  return snap.docs.map((d) => d.data());
}

function summarizeProgress({ sections, sectionResults }) {
  const sectionTitleToOrder = new Map();
  const orderedTitles = [];

  sections.forEach((s) => {
    const title = s.title || "";
    const order = typeof s.order === "number" ? s.order : null;
    if (title) {
      sectionTitleToOrder.set(title, order);
      orderedTitles.push(title);
    }
  });

  const completedNames = new Set(
    sectionResults.map((r) => r.sectionName).filter(Boolean)
  );

  const totalSections = orderedTitles.length;
  const completedCount = [...completedNames].filter((t) =>
    sectionTitleToOrder.has(t)
  ).length;

  const remainingCount = Math.max(0, totalSections - completedCount);
  const completionPercentage =
    totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  // Next section = first in order not completed.
  const nextSectionTitle =
    orderedTitles.find((t) => !completedNames.has(t)) || null;

  // Last completed section = highest order among completed titles.
  let lastCompletedTitle = null;
  let lastCompletedOrder = -Infinity;
  completedNames.forEach((title) => {
    const order = sectionTitleToOrder.get(title);
    if (typeof order === "number" && order > lastCompletedOrder) {
      lastCompletedOrder = order;
      lastCompletedTitle = title;
    }
  });

  return {
    completionPercentage,
    totalSections,
    completedCount,
    remainingCount,
    nextSectionTitle,
    currentSectionTitle: nextSectionTitle,
    lastCompletedTitle,
  };
}

module.exports = {
  getAssessmentSections,
  getUserSectionResults,
  summarizeProgress,
};

