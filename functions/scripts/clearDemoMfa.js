/**
 * Unenroll SMS MFA from the MarketAtomy demo accounts.
 *
 * Uses the Firebase CLI login (run `firebase login` first). Example:
 *   NODE_PATH="$(npm root -g)" node functions/scripts/clearDemoMfa.js
 *
 * Optional env:
 *   DEMO_EMAILS=comma,separated,list
 */

const path = require("path");
const admin = require("firebase-admin");

const PROJECT_ID = "businesshealthassessment";
const DEFAULT_EMAILS = ["demo@marketatomy.test", "dannaolivo@gmail.com"];
const FIREBASE_TOOLS_ROOT = process.env.NODE_PATH
  ? process.env.NODE_PATH.split(path.delimiter)[0]
  : path.join(process.env.HOME || "", ".nvm/versions/node/v22.16.0/lib/node_modules");

function loadFirebaseTools(moduleName) {
  return require(require.resolve(moduleName, { paths: [FIREBASE_TOOLS_ROOT] }));
}

function emailsFromEnv() {
  if (!process.env.DEMO_EMAILS) return DEFAULT_EMAILS;
  return process.env.DEMO_EMAILS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function initAdminFromFirebaseCli() {
  const firebaseToolsAuth = loadFirebaseTools("firebase-tools/lib/auth");
  const { requireAuth } = loadFirebaseTools("firebase-tools/lib/requireAuth");
  const apiv2 = loadFirebaseTools("firebase-tools/lib/apiv2");

  const account = firebaseToolsAuth.getGlobalDefaultAccount();
  if (!account) {
    throw new Error("Firebase CLI is not logged in. Run `firebase login` and retry.");
  }

  await requireAuth({
    project: PROJECT_ID,
    projectId: PROJECT_ID,
    user: account.user,
    tokens: account.tokens,
  });

  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: PROJECT_ID,
      credential: {
        getAccessToken: async () => ({
          access_token: await apiv2.getAccessToken(),
          expires_in: 3600,
        }),
      },
    });
  }
}

async function clearMfaForEmail(email) {
  const user = await admin.auth().getUserByEmail(email);
  const enrolled = user.multiFactor?.enrolledFactors || [];
  if (enrolled.length === 0) {
    console.log(`${email}: no MFA factors enrolled`);
    return;
  }
  await admin.auth().updateUser(user.uid, {
    multiFactor: { enrolledFactors: [] },
  });
  console.log(`${email}: removed ${enrolled.length} MFA factor(s)`);
}

async function main() {
  await initAdminFromFirebaseCli();
  for (const email of emailsFromEnv()) {
    try {
      await clearMfaForEmail(email);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        console.log(`${email}: no Auth user found`);
        continue;
      }
      throw error;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
