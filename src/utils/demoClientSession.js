import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export function hasDemoSeededBackup(userData = {}) {
  return Array.isArray(userData?.demoSeededBackup?.results) && userData.demoSeededBackup.results.length > 0;
}

function clearLocalDemoState(uid) {
  if (!uid || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`bhcDraft:${uid}`);
    window.localStorage.removeItem(`bhcActionPlan:${uid}`);
  } catch {
    /* ignore */
  }
}

function serializeResult(data, uid) {
  return {
    userId: uid,
    userEmail: data.userEmail || "",
    sectionName: data.sectionName || "",
    answers: data.answers || {},
    sectionScore: data.sectionScore || 0,
    notApplicable: Boolean(data.notApplicable),
    submittedAt: data.submittedAt || null,
  };
}

export async function startDemoAsNewClient(uid) {
  if (!uid) throw new Error("Missing user.");

  const userRef = doc(db, "users", uid);
  const [userSnap, resultsSnap] = await Promise.all([
    getDoc(userRef),
    getDocs(query(collection(db, "sectionResults"), where("userId", "==", uid))),
  ]);
  const userData = userSnap.exists() ? userSnap.data() : {};

  if (!hasDemoSeededBackup(userData) && !resultsSnap.empty) {
    await updateDoc(userRef, {
      demoSeededBackup: {
        savedAt: serverTimestamp(),
        computedScores: userData.computedScores || null,
        overallHealth: userData.overallHealth || null,
        hideOnboarding: userData.hideOnboarding === true,
        results: resultsSnap.docs.map((docSnap) => serializeResult(docSnap.data(), uid)),
      },
    });
  }

  const batch = writeBatch(db);
  resultsSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  batch.update(userRef, {
    computedScores: deleteField(),
    overallHealth: deleteField(),
    hideOnboarding: false,
    demoFreshRun: true,
  });
  await batch.commit();
  clearLocalDemoState(uid);
}

export async function restoreDemoSeededClient(uid) {
  if (!uid) throw new Error("Missing user.");

  const userRef = doc(db, "users", uid);
  const [userSnap, resultsSnap] = await Promise.all([
    getDoc(userRef),
    getDocs(query(collection(db, "sectionResults"), where("userId", "==", uid))),
  ]);
  const backup = userSnap.exists() ? userSnap.data()?.demoSeededBackup : null;
  if (!Array.isArray(backup?.results) || backup.results.length === 0) {
    throw new Error("No seeded demo results to restore.");
  }

  const batch = writeBatch(db);
  resultsSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  backup.results.forEach((result) => {
    const resultRef = doc(collection(db, "sectionResults"));
    batch.set(resultRef, {
      ...serializeResult(result, uid),
      submittedAt: result.submittedAt || serverTimestamp(),
    });
  });
  batch.update(userRef, {
    computedScores: backup.computedScores || deleteField(),
    overallHealth: backup.overallHealth || deleteField(),
    hideOnboarding: backup.hideOnboarding === true,
    demoFreshRun: deleteField(),
  });
  await batch.commit();
  clearLocalDemoState(uid);
}
