/**
 * Seed a fully completed assessment for a demo client view.
 *
 * - Targets a single existing user by email (default: dannaolivo@gmail.com)
 * - Upserts sectionResults for every section in BHC_Assessment
 * - Biases answers to resemble a newer business (more low/medium scoring)
 * - Recomputes users/{uid}.computedScores and users/{uid}.overallHealth
 *
 * Usage:
 *   node seedDemoClientAssessment.js
 *   node seedDemoClientAssessment.js dannaolivo@gmail.com
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { processComputedScores } from "./src/utils/analytics.js";

// Firebase config - matches src/firebaseConfig.js
const firebaseConfig = {
  apiKey: "AIzaSyA4AQ5-WmNSLR9v3tOahqehBMQVlpLMiTM",
  authDomain: "businesshealthassessment.firebaseapp.com",
  projectId: "businesshealthassessment",
  storageBucket: "businesshealthassessment.appspot.com",
  messagingSenderId: "792442986694",
  appId: "1:792442986694:web:487395ed4704271d8eb7c7",
  measurementId: "G-VZVWF2N9Y8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_EMAIL = "dannaolivo@gmail.com";

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

  const sorted = [...options].sort((a, b) => (a.weight || 0) - (b.weight || 0)); // low->high
  const n = sorted.length;

  const lowBucket = sorted.slice(0, Math.max(1, Math.ceil(n * 0.35)));
  const midBucket = sorted.slice(
    Math.floor(n * 0.35),
    Math.max(Math.floor(n * 0.35) + 1, Math.ceil(n * 0.75))
  );
  const highBucket = sorted.slice(Math.floor(n * 0.75));

  const r = Math.random();
  if (bias === "low") {
    // mostly low
    if (r < 0.72) return lowBucket[Math.floor(Math.random() * lowBucket.length)];
    if (r < 0.95) return midBucket[Math.floor(Math.random() * midBucket.length)];
    return highBucket[Math.floor(Math.random() * highBucket.length)];
  }
  if (bias === "high") {
    // mostly high
    if (r < 0.72) return highBucket[Math.floor(Math.random() * highBucket.length)];
    if (r < 0.95) return midBucket[Math.floor(Math.random() * midBucket.length)];
    return lowBucket[Math.floor(Math.random() * lowBucket.length)];
  }

  // medium
  if (r < 0.62) return midBucket[Math.floor(Math.random() * midBucket.length)];
  if (r < 0.81) return lowBucket[Math.floor(Math.random() * lowBucket.length)];
  return highBucket[Math.floor(Math.random() * highBucket.length)];
}

function pickBiasedMulti(options, bias = "medium") {
  if (!options || options.length === 0) return [];
  const sorted = [...options].sort((a, b) => (a.weight || 0) - (b.weight || 0)); // low->high
  const n = sorted.length;
  const lowPool = sorted.slice(0, Math.max(1, Math.ceil(n * 0.6)));
  const highPool = sorted.slice(Math.floor(n * 0.4));

  const count = clamp(1 + Math.floor(Math.random() * 2), 1, Math.min(2, n)); // 1-2
  const pool = bias === "low" ? lowPool : bias === "high" ? highPool : sorted;
  return shuffle(pool).slice(0, count);
}

function categoryBiasForSectionOrder(order) {
  // Roughly: new business tends to have weaker financial + ops maturity,
  // mixed marketing/product, and uneven overall habits.
  // (This is just for demo realism; not a scoring model.)
  if ([2, 3, 5, 6, 7].includes(order)) return "medium"; // foundation
  if ([4, 8, 11, 12, 16, 17, 18].includes(order)) return "low"; // financial
  if ([10, 12, 13, 14, 15].includes(order)) return "medium"; // marketing/sales
  if ([8, 9, 19].includes(order)) return "medium"; // product/service
  if ([20, 21].includes(order)) return "low"; // overall health habits
  return "medium";
}

function synthesizeTextAnswer(question) {
  const prompt = (question?.question || question?.text || "").toLowerCase();
  const samples = [
    "Launched 6 months ago; still validating demand and refining our offer.",
    "We have a small team (2–3 people) and wear multiple hats day-to-day.",
    "Cash flow is tight; focusing on consistent sales and improving margins.",
    "We’re building repeatable marketing systems and documenting processes.",
    "Tracking key numbers monthly; improving consistency week over week.",
  ];

  // Light keyword-based tailoring
  if (prompt.includes("revenue") || prompt.includes("sales")) {
    return "Revenue is inconsistent; currently relying on a small number of clients and referrals while building predictable acquisition.";
  }
  if (prompt.includes("cash") || prompt.includes("fund") || prompt.includes("credit")) {
    return "Cash flow is the biggest constraint right now; we’re tightening expenses and working on financing options.";
  }
  if (prompt.includes("marketing") || prompt.includes("lead")) {
    return "Marketing is still being systematized; we’re testing channels and messaging to find consistent lead flow.";
  }
  if (prompt.includes("team") || prompt.includes("employee") || prompt.includes("hire")) {
    return "Small lean team; planning to hire contractors once cash flow stabilizes and processes are documented.";
  }

  return samples[Math.floor(Math.random() * samples.length)];
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
      // text/other
      answers[q.id] = { answer: synthesizeTextAnswer(q), weight: 0 };
    }
  });

  return { answers, sectionScore };
}

function randomRecentTimestamp() {
  // Within last 10 days
  const now = Date.now();
  const days = Math.floor(Math.random() * 10);
  const hours = Math.floor(Math.random() * 10) + 8; // daytime-ish
  const minutes = Math.floor(Math.random() * 60);
  const d = new Date(now - days * 24 * 60 * 60 * 1000);
  d.setHours(hours, minutes, 0, 0);
  return Timestamp.fromDate(d);
}

async function main() {
  const email = (process.argv[2] || DEFAULT_EMAIL).toLowerCase();
  console.log(`Seeding demo assessment for: ${email}`);

  // Find user doc by email
  const usersSnap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  if (usersSnap.empty) {
    console.error(`No user found in users collection with email=${email}`);
    process.exit(1);
  }
  const userDoc = usersSnap.docs[0];
  const userId = userDoc.id;
  const userData = userDoc.data();

  // Backup current scoring fields (one-time)
  if (!userData.demoBackup) {
    await updateDoc(doc(db, "users", userId), {
      demoBackup: {
        computedScores: userData.computedScores || null,
        overallHealth: userData.overallHealth || null,
        backedUpAt: serverTimestamp(),
      },
    });
  }

  // Fetch sections (ordered)
  const sectionsSnap = await getDocs(query(collection(db, "BHC_Assessment"), orderBy("order")));
  const sections = sectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`Found ${sections.length} sections`);

  // Preload existing results for the user
  const existingResultsSnap = await getDocs(
    query(collection(db, "sectionResults"), where("userId", "==", userId))
  );
  const existingBySectionName = new Map();
  existingResultsSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.sectionName) existingBySectionName.set(data.sectionName, { id: d.id, ...data });
  });

  // Upsert results for each section
  const titleToOrder = new Map();
  const orderToScore = new Map();

  for (const section of sections) {
    const sectionName = section.title;
    titleToOrder.set(sectionName, section.order);

    const { answers, sectionScore } = buildAnswersForSection(section);
    orderToScore.set(section.order, sectionScore);

    const payload = {
      userId,
      sectionName,
      answers,
      sectionScore,
      submittedAt: randomRecentTimestamp(),
    };

    const existing = existingBySectionName.get(sectionName);
    if (existing) {
      await updateDoc(doc(db, "sectionResults", existing.id), payload);
      console.log(`Updated sectionResult: ${sectionName} (score=${sectionScore})`);
    } else {
      await addDoc(collection(db, "sectionResults"), payload);
      console.log(`Created sectionResult: ${sectionName} (score=${sectionScore})`);
    }
  }

  // Recompute computedScores similar to AssessmentUser.jsx
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
        computedScores[categoryKey].total = Object.values(
          computedScores[categoryKey].sections
        ).reduce((sum, val) => sum + (val || 0), 0);
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

  await updateDoc(doc(db, "users", userId), updateData);

  console.log("\n✅ Demo client assessment seeded successfully.");
  console.log(`UserId: ${userId}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

