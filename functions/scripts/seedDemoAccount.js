/**
 * Create or refresh the MarketAtomy demo account (Auth + Firestore + sectionResults).
 *
 * Requires Application Default Credentials, e.g.:
 *   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json"
 *   node functions/scripts/seedDemoAccount.js
 *
 * Optional env:
 *   DEMO_EMAIL, DEMO_PASSWORD, DEMO_FIRST_NAME, DEMO_LAST_NAME
 */

const path = require("path");
const { admin, db } = require("../src/utils/firebaseAdmin");

const DEMO_EMAIL = (process.env.DEMO_EMAIL || "demo@marketatomy.test").toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "BhcDemo2026!";
const DEMO_FIRST = process.env.DEMO_FIRST_NAME || "Demo";
const DEMO_LAST = process.env.DEMO_LAST_NAME || "Reviewer";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickBiasedChoice(options, bias = "medium") {
  if (!options || options.length === 0) return null;
  const sorted = [...options].sort((a, b) => (a.weight || 0) - (b.weight || 0));
  const n = sorted.length;
  const lowBucket = sorted.slice(0, Math.max(1, Math.ceil(n * 0.35)));
  const midBucket = sorted.slice(
    Math.floor(n * 0.35),
    Math.max(Math.floor(n * 0.35) + 1, Math.ceil(n * 0.75))
  );
  const highBucket = sorted.slice(Math.floor(n * 0.75));
  const r = Math.random();
  if (bias === "low") {
    if (r < 0.72) return lowBucket[Math.floor(Math.random() * lowBucket.length)];
    if (r < 0.95) return midBucket[Math.floor(Math.random() * midBucket.length)];
    return highBucket[Math.floor(Math.random() * highBucket.length)];
  }
  if (bias === "high") {
    if (r < 0.72) return highBucket[Math.floor(Math.random() * highBucket.length)];
    if (r < 0.95) return midBucket[Math.floor(Math.random() * midBucket.length)];
    return lowBucket[Math.floor(Math.random() * lowBucket.length)];
  }
  if (r < 0.62) return midBucket[Math.floor(Math.random() * midBucket.length)];
  if (r < 0.81) return lowBucket[Math.floor(Math.random() * lowBucket.length)];
  return highBucket[Math.floor(Math.random() * highBucket.length)];
}

function pickBiasedMulti(options, bias = "medium") {
  if (!options || options.length === 0) return [];
  const sorted = [...options].sort((a, b) => (a.weight || 0) - (b.weight || 0));
  const n = sorted.length;
  const lowPool = sorted.slice(0, Math.max(1, Math.ceil(n * 0.6)));
  const highPool = sorted.slice(Math.floor(n * 0.4));
  const count = clamp(1 + Math.floor(Math.random() * 2), 1, Math.min(2, n));
  const pool = bias === "low" ? lowPool : bias === "high" ? highPool : sorted;
  return shuffle(pool).slice(0, count);
}

function categoryBiasForSectionOrder(order) {
  if ([2, 3, 5, 6, 7].includes(order)) return "medium";
  if ([4, 8, 11, 12, 16, 17, 18].includes(order)) return "low";
  if ([10, 12, 13, 14, 15].includes(order)) return "medium";
  if ([8, 9, 19].includes(order)) return "medium";
  if ([20, 21].includes(order)) return "low";
  return "medium";
}

function synthesizeTextAnswer(question) {
  const prompt = (question?.question || question?.text || "").toLowerCase();
  if (prompt.includes("revenue") || prompt.includes("sales")) {
    return "Revenue is inconsistent; building predictable acquisition is the current focus.";
  }
  if (prompt.includes("cash") || prompt.includes("fund") || prompt.includes("credit")) {
    return "Cash flow is tight; tightening expenses and exploring financing options.";
  }
  return "Early-stage business with a lean team and improving weekly operating rhythm.";
}

function buildAnswersForSection(section) {
  const answers = {};
  let sectionScore = 0;
  const order = typeof section.order === "number" ? section.order : 0;
  const bias = categoryBiasForSectionOrder(order);

  (section.questions || []).forEach((q) => {
    if (q.type === "multipleChoice") {
      const choice = pickBiasedChoice(q.options || [], bias);
      if (choice) {
        answers[q.id] = { answer: choice.label, weight: choice.weight || 0 };
        sectionScore += choice.weight || 0;
      }
    } else if (q.type === "multipleSelect") {
      const selected = pickBiasedMulti(q.options || [], bias);
      answers[q.id] = selected.map((opt) => ({
        answer: opt.label,
        weight: opt.weight || 0,
      }));
      sectionScore += selected.reduce((sum, opt) => sum + (opt.weight || 0), 0);
    } else {
      answers[q.id] = { answer: synthesizeTextAnswer(q), weight: 0 };
    }
  });

  return { answers, sectionScore };
}

function randomRecentTimestamp() {
  const now = Date.now();
  const days = Math.floor(Math.random() * 10);
  const hours = Math.floor(Math.random() * 10) + 8;
  const minutes = Math.floor(Math.random() * 60);
  const d = new Date(now - days * 24 * 60 * 60 * 1000);
  d.setHours(hours, minutes, 0, 0);
  return admin.firestore.Timestamp.fromDate(d);
}

async function loadAnalytics() {
  const mod = await import(path.resolve(__dirname, "../../src/utils/analytics.js"));
  return mod.processComputedScores;
}

async function ensureAuthUser() {
  let user;
  try {
    user = await admin.auth().getUserByEmail(DEMO_EMAIL);
    await admin.auth().updateUser(user.uid, {
      password: DEMO_PASSWORD,
      displayName: `${DEMO_FIRST} ${DEMO_LAST}`,
      emailVerified: true,
      multiFactor: { enrolledFactors: [] },
    });
    console.log(`Updated Auth user: ${DEMO_EMAIL} (${user.uid})`);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    user = await admin.auth().createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: `${DEMO_FIRST} ${DEMO_LAST}`,
      emailVerified: true,
    });
    console.log(`Created Auth user: ${DEMO_EMAIL} (${user.uid})`);
  }
  return user;
}

async function upsertUserDoc(uid) {
  const username = "DemoReviewer";
  await db.collection("users").doc(uid).set(
    {
      userId: uid,
      email: DEMO_EMAIL,
      firstName: DEMO_FIRST,
      lastName: DEMO_LAST,
      username,
      verified: true,
      signupMethod: "seed",
      role: "admin",
      hideOnboarding: true,
      hideAdminOnboarding: true,
      assessmentPurchased: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoggedOn: null,
      lastLoggedOff: null,
    },
    { merge: true }
  );

  const usernameRef = db.collection("usernames").doc(username.toLowerCase());
  const usernameSnap = await usernameRef.get();
  if (!usernameSnap.exists || usernameSnap.data().uid === uid) {
    await usernameRef.set({ uid, username });
  }

  console.log(`Upserted users/${uid} with admin role`);
}

async function seedAssessment(uid) {
  const processComputedScores = await loadAnalytics();
  const sectionsSnap = await db.collection("BHC_Assessment").orderBy("order").get();
  const sections = sectionsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  if (sections.length === 0) {
    throw new Error("No BHC_Assessment sections found.");
  }

  const existingSnap = await db.collection("sectionResults").where("userId", "==", uid).get();
  const existingBySectionName = new Map();
  existingSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.sectionName) existingBySectionName.set(data.sectionName, { id: docSnap.id, ...data });
  });

  const orderToScore = new Map();
  for (const section of sections) {
    const sectionName = section.title;
    const { answers, sectionScore } = buildAnswersForSection(section);
    orderToScore.set(section.order, sectionScore);

    const payload = {
      userId: uid,
      userEmail: DEMO_EMAIL,
      sectionName,
      answers,
      sectionScore,
      submittedAt: randomRecentTimestamp(),
    };

    const existing = existingBySectionName.get(sectionName);
    if (existing) {
      await db.collection("sectionResults").doc(existing.id).update(payload);
    } else {
      await db.collection("sectionResults").add(payload);
    }
  }

  const categoryMapping = {
    foundationalStructure: [2, 3, 5, 6, 7],
    financialPosition: [4, 8, 11, 12, 16, 17, 18],
    salesMarketing: [10, 12, 13, 14, 15],
    productService: [8, 9, 19],
    general: [20, 21],
  };

  const computedScores = {
    foundationalStructure: { sections: {}, total: 0 },
    financialPosition: { sections: {}, total: 0 },
    salesMarketing: { sections: {}, total: 0 },
    productService: { sections: {}, total: 0 },
    general: { sections: {}, total: 0 },
  };

  for (const [order, score] of orderToScore.entries()) {
    Object.keys(categoryMapping).forEach((categoryKey) => {
      if (categoryMapping[categoryKey].includes(order)) {
        computedScores[categoryKey].sections[order] = score;
        computedScores[categoryKey].total = Object.values(computedScores[categoryKey].sections).reduce(
          (sum, val) => sum + (val || 0),
          0
        );
      }
    });
  }

  const enhancedScores = processComputedScores(computedScores);
  Object.keys(enhancedScores || {}).forEach((categoryKey) => {
    if (categoryKey !== "overallHealth" && computedScores[categoryKey]) {
      computedScores[categoryKey] = {
        ...computedScores[categoryKey],
        ...enhancedScores[categoryKey],
      };
    }
  });

  const updateData = { computedScores };
  if (enhancedScores?.overallHealth) updateData.overallHealth = enhancedScores.overallHealth;
  await db.collection("users").doc(uid).set(updateData, { merge: true });
  console.log(`Seeded ${sections.length} sectionResults and computedScores for ${uid}`);
}

async function seedMockClients() {
  const processComputedScores = await loadAnalytics();
  const sectionsSnap = await db.collection("BHC_Assessment").orderBy("order").get();
  const sections = sectionsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  const clients = [
    { firstName: "Avery", lastName: "Chen", email: "avery.chen@testuser.com", bias: "high" },
    { firstName: "Jordan", lastName: "Patel", email: "jordan.patel@testuser.com", bias: "medium" },
    { firstName: "Riley", lastName: "Brooks", email: "riley.brooks@testuser.com", bias: "low" },
  ];

  for (const client of clients) {
    let uid;
    try {
      uid = (await admin.auth().getUserByEmail(client.email)).uid;
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
      uid = (
        await admin.auth().createUser({
          email: client.email,
          password: "TestUser2026!",
          displayName: `${client.firstName} ${client.lastName}`,
          emailVerified: true,
        })
      ).uid;
    }

    await db.collection("users").doc(uid).set(
      {
        userId: uid,
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
        username: `${client.firstName}${client.lastName}`,
        verified: true,
        signupMethod: "seed",
        role: "tier1",
        hideOnboarding: true,
        assessmentPurchased: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const orderToScore = new Map();
    for (const section of sections) {
      const originalBias = categoryBiasForSectionOrder(section.order);
      const bias =
        client.bias === "high"
          ? "high"
          : client.bias === "low"
            ? "low"
            : originalBias;
      const answers = {};
      let sectionScore = 0;
      (section.questions || []).forEach((q) => {
        if (q.type === "multipleChoice") {
          const choice = pickBiasedChoice(q.options || [], bias);
          if (choice) {
            answers[q.id] = { answer: choice.label, weight: choice.weight || 0 };
            sectionScore += choice.weight || 0;
          }
        } else if (q.type === "multipleSelect") {
          const selected = pickBiasedMulti(q.options || [], bias);
          answers[q.id] = selected.map((opt) => ({
            answer: opt.label,
            weight: opt.weight || 0,
          }));
          sectionScore += selected.reduce((sum, val) => sum + (val.weight || 0), 0);
        } else {
          answers[q.id] = { answer: synthesizeTextAnswer(q), weight: 0 };
        }
      });
      orderToScore.set(section.order, sectionScore);

      const existingSnap = await db
        .collection("sectionResults")
        .where("userId", "==", uid)
        .where("sectionName", "==", section.title)
        .limit(1)
        .get();

      const payload = {
        userId: uid,
        userEmail: client.email,
        sectionName: section.title,
        answers,
        sectionScore,
        submittedAt: randomRecentTimestamp(),
      };

      if (existingSnap.empty) {
        await db.collection("sectionResults").add(payload);
      } else {
        await existingSnap.docs[0].ref.update(payload);
      }
    }

    const categoryMapping = {
      foundationalStructure: [2, 3, 5, 6, 7],
      financialPosition: [4, 8, 11, 12, 16, 17, 18],
      salesMarketing: [10, 12, 13, 14, 15],
      productService: [8, 9, 19],
      general: [20, 21],
    };
    const computedScores = {
      foundationalStructure: { sections: {}, total: 0 },
      financialPosition: { sections: {}, total: 0 },
      salesMarketing: { sections: {}, total: 0 },
      productService: { sections: {}, total: 0 },
      general: { sections: {}, total: 0 },
    };
    for (const [order, score] of orderToScore.entries()) {
      Object.keys(categoryMapping).forEach((categoryKey) => {
        if (categoryMapping[categoryKey].includes(order)) {
          computedScores[categoryKey].sections[order] = score;
          computedScores[categoryKey].total = Object.values(computedScores[categoryKey].sections).reduce(
            (sum, val) => sum + (val || 0),
            0
          );
        }
      });
    }
    const enhancedScores = processComputedScores(computedScores);
    Object.keys(enhancedScores || {}).forEach((categoryKey) => {
      if (categoryKey !== "overallHealth" && computedScores[categoryKey]) {
        computedScores[categoryKey] = {
          ...computedScores[categoryKey],
          ...enhancedScores[categoryKey],
        };
      }
    });
    const updateData = { computedScores };
    if (enhancedScores?.overallHealth) updateData.overallHealth = enhancedScores.overallHealth;
    await db.collection("users").doc(uid).set(updateData, { merge: true });
    console.log(`Seeded mock client: ${client.email}`);
  }
}

async function main() {
  console.log("Seeding MarketAtomy demo account...");
  const authUser = await ensureAuthUser();
  await upsertUserDoc(authUser.uid);
  await seedAssessment(authUser.uid);
  await seedMockClients();
  console.log("\nDone.");
  console.log(`Demo login: ${DEMO_EMAIL}`);
  console.log(`Demo password: ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
