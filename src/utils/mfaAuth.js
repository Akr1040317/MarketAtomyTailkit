import {
  RecaptchaVerifier,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  multiFactor,
  getMultiFactorResolver,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../firebaseConfig";

const RECAPTCHA_ID = "mfa-recaptcha";

let recaptchaVerifier = null;

export function isMfaRequiredError(error) {
  return error?.code === "auth/multi-factor-auth-required";
}

export function enrolledFactorCount(user) {
  if (!user) return 0;
  try {
    return multiFactor(user).enrolledFactors?.length || 0;
  } catch {
    return 0;
  }
}

export function hasEnrolledMfa(user) {
  return enrolledFactorCount(user) > 0;
}

export function isMfaExemptEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return value === "demo@marketatomy.test" || value === "dannaolivo@gmail.com";
}

export function isMfaExemptUser(user) {
  return isMfaExemptEmail(user?.email);
}

export function needsMfaEnrollment(user) {
  return Boolean(user) && enrolledFactorCount(user) === 0;
}

export function getMfaResolver(error) {
  return getMultiFactorResolver(auth, error);
}

export function getPhoneHints(resolver) {
  return (resolver?.hints || []).filter(
    (hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID
  );
}

export function formatPhoneHint(hint) {
  const number = hint?.phoneNumber || "";
  const digits = number.replace(/\D/g, "");
  if (digits.length >= 4) return `the number ending in ${digits.slice(-4)}`;
  if (number) return number;
  const name = String(hint?.displayName || "").trim();
  if (name && name.toLowerCase() !== "phone") return name;
  return "your phone";
}

export function enrollmentDisplayName(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  return digits.length >= 4 ? `Phone ••••${digits.slice(-4)}` : "Phone";
}

export function toE164(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

export function formatAuthError(error) {
  const code = error?.code || "";
  if (code === "auth/invalid-phone-number") {
    return "Enter a valid phone number with country code, like +15551234567.";
  }
  if (code === "auth/invalid-verification-code") return "That code is incorrect. Try again.";
  if (code === "auth/code-expired") return "That code expired. Send a new one.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a few minutes and try again.";
  if (code === "auth/invalid-app-credential" || code === "auth/captcha-check-failed") {
    const onLocalhost =
      typeof window !== "undefined" && window.location.hostname === "localhost";
    if (onLocalhost) {
      return "Phone verification does not work on localhost. Open http://127.0.0.1:5173, complete the checkbox, and try again.";
    }
    return "The security check failed. Complete the checkbox and try sending the code again.";
  }
  if (code === "auth/second-factor-already-in-use") return "That phone number is already enrolled.";
  if (code === "auth/requires-recent-login") return "Please sign in again before adding a phone number.";
  if (code === "auth/unverified-email" || code === "auth/email-not-verified") {
    return "Verify your email first to turn on two-step verification. We sent a link to your inbox. You can skip for now and add this later.";
  }
  if (code === "auth/popup-closed-by-user") return "Google sign-in was closed before it finished.";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "Incorrect email or password.";
  }
  return error?.message || "Something went wrong. Please try again.";
}

export function clearRecaptcha() {
  try {
    recaptchaVerifier?.clear();
  } catch {
    /* ignore */
  }
  recaptchaVerifier = null;
}

export async function getRecaptchaVerifier(containerId = RECAPTCHA_ID) {
  if (typeof document === "undefined" || !document.getElementById(containerId)) {
    throw new Error("Security check is not ready yet. Wait a moment and try again.");
  }
  if (recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "normal",
    callback: () => {},
    "expired-callback": () => {},
  });
  await recaptchaVerifier.render();
  return recaptchaVerifier;
}

export async function sendVerificationIfNeeded(user) {
  if (!user || user.emailVerified) return;
  try {
    await sendEmailVerification(user);
  } catch {
    /* signup should still continue signed in */
  }
}

export async function sendEnrollmentCode(user, phoneNumber) {
  const verifier = await getRecaptchaVerifier();
  const session = await multiFactor(user).getSession();
  const provider = new PhoneAuthProvider(auth);
  try {
    return await provider.verifyPhoneNumber({ phoneNumber, session }, verifier);
  } catch (error) {
    clearRecaptcha();
    throw error;
  }
}

export async function completeEnrollment(user, verificationId, code, phoneNumber = "") {
  const cred = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(cred);
  await multiFactor(user).enroll(assertion, enrollmentDisplayName(phoneNumber));
  clearRecaptcha();
}

export async function sendChallengeCode(resolver, hintIndex = 0) {
  const hints = getPhoneHints(resolver);
  if (!hints.length) {
    throw new Error("No phone number is enrolled on this account.");
  }
  const hint = hints[Math.min(hintIndex, hints.length - 1)];
  const verifier = await getRecaptchaVerifier();
  const provider = new PhoneAuthProvider(auth);
  try {
    return await provider.verifyPhoneNumber(
      { multiFactorHint: hint, session: resolver.session },
      verifier
    );
  } catch (error) {
    clearRecaptcha();
    throw error;
  }
}

export async function completeChallenge(resolver, verificationId, code) {
  const cred = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(cred);
  const result = await resolver.resolveSignIn(assertion);
  clearRecaptcha();
  return result;
}

export { RECAPTCHA_ID };
