const { admin, db } = require("../utils/firebaseAdmin");

async function grantAssessmentAccess(uid, extra = {}) {
  if (!uid) throw new Error("Missing user id");

  const payload = {
    assessmentPurchased: true,
    assessmentPurchasedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      payload[key] = value;
    }
  });

  await db.collection("users").doc(uid).set(payload, { merge: true });
}

function sessionUid(session) {
  return session?.metadata?.firebaseUid || session?.client_reference_id || "";
}

module.exports = {
  grantAssessmentAccess,
  sessionUid,
};
