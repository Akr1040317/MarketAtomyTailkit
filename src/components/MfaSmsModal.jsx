import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import {
  RECAPTCHA_ID,
  clearRecaptcha,
  completeChallenge,
  completeEnrollment,
  formatAuthError,
  getPhoneHints,
  sendChallengeCode,
  sendEnrollmentCode,
  toE164,
} from "../utils/mfaAuth";
import "../assets/mfa-sms.css";

export default function MfaSmsModal({
  open,
  mode = "enroll",
  user,
  resolver,
  initialPhone = "",
  onComplete,
  onCancel,
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [step, setStep] = useState("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hints = getPhoneHints(resolver);
  const hintLabel = hints[0]?.displayName || hints[0]?.phoneNumber || "your phone";
  const prefill = toE164(initialPhone);

  useEffect(() => {
    if (!open) return;
    const nextPhone = mode === "enroll" ? toE164(initialPhone) : "";
    setPhone(nextPhone);
    setCode("");
    setVerificationId("");
    setError("");
    setBusy(false);
    setStep(mode === "challenge" ? "code" : "phone");
    clearRecaptcha();
  }, [open, mode, initialPhone]);

  useEffect(() => {
    if (!open || mode !== "challenge" || !resolver) return;
    let cancelled = false;
    const send = async () => {
      setBusy(true);
      setError("");
      try {
        const id = await sendChallengeCode(resolver, 0);
        if (!cancelled) {
          setVerificationId(id);
          setStep("code");
        }
      } catch (err) {
        if (!cancelled) setError(formatAuthError(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    const timer = window.setTimeout(send, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, mode, resolver]);

  useEffect(() => {
    if (!open || mode !== "enroll" || !user) return;
    const e164 = toE164(initialPhone);
    if (!e164) return;
    let cancelled = false;
    const send = async () => {
      setBusy(true);
      setError("");
      try {
        const id = await sendEnrollmentCode(user, e164);
        if (!cancelled) {
          setPhone(e164);
          setVerificationId(id);
          setStep("code");
        }
      } catch (err) {
        if (!cancelled) {
          setPhone(e164);
          setStep("phone");
          setError(formatAuthError(err));
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    const timer = window.setTimeout(send, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, mode, user, initialPhone]);

  if (!open) return null;

  const cancel = async () => {
    clearRecaptcha();
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
    onCancel?.();
  };

  const sendEnroll = async (event) => {
    event?.preventDefault();
    const e164 = toE164(phone);
    if (!e164) {
      setError("Enter a phone number with country code, like +15551234567.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = await sendEnrollmentCode(user, e164);
      setVerificationId(id);
      setStep("code");
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event) => {
    event?.preventDefault();
    if (!code.trim()) {
      setError("Enter the 6-digit code from the text message.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "enroll") {
        await completeEnrollment(user, verificationId, code.trim());
        onComplete?.(user, toE164(phone));
      } else {
        const result = await completeChallenge(resolver, verificationId, code.trim());
        onComplete?.(result.user);
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "enroll") {
        const e164 = toE164(phone);
        if (!e164) {
          setError("Enter a phone number with country code, like +15551234567.");
          return;
        }
        const id = await sendEnrollmentCode(user, e164);
        setVerificationId(id);
      } else {
        const id = await sendChallengeCode(resolver, 0);
        setVerificationId(id);
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mfa-sms">
      <div className="mfa-sms-backdrop" />
      <div className="mfa-sms-frame">
        <div className="mfa-sms-panel" role="dialog" aria-modal="true" aria-labelledby="mfa-title">
          <h2 id="mfa-title">
            {mode === "enroll" ? "Add SMS security" : "Enter your SMS code"}
          </h2>
          {mode === "enroll" && step === "phone" ? (
            <p>
              {prefill
                ? `We will text a verification code to ${prefill}. Standard messaging rates may apply.`
                : "Every account needs a phone number for two-step verification. You will receive a text message; standard messaging rates may apply."}
            </p>
          ) : (
            <p>
              {mode === "challenge"
                ? `We sent a code to ${hintLabel}. Enter it to finish signing in.`
                : `Enter the 6-digit code we texted to ${toE164(phone) || "your phone"}.`}
            </p>
          )}

          {error ? <p className="mfa-sms-error">{error}</p> : null}

          {mode === "enroll" && step === "phone" && busy && prefill ? (
            <>
              <p>Sending a code to {prefill}…</p>
              <div className="mfa-sms-actions">
                <button type="button" className="secondary" onClick={cancel} disabled={busy}>
                  Cancel
                </button>
              </div>
            </>
          ) : mode === "enroll" && step === "phone" ? (
            <form onSubmit={sendEnroll}>
              <label htmlFor="mfa-phone">Phone number</label>
              <input
                id="mfa-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+15551234567"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={busy}
              />
              <div className="mfa-sms-actions">
                <button type="submit" className="primary" disabled={busy}>
                  {busy ? "Sending…" : "Send code"}
                </button>
                <button type="button" className="secondary" onClick={cancel} disabled={busy}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={verify}>
              <label htmlFor="mfa-code">Verification code</label>
              <input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={busy}
              />
              <div className="mfa-sms-actions">
                <button type="submit" className="primary" disabled={busy || !verificationId}>
                  {busy ? "Verifying…" : "Verify"}
                </button>
                <button type="button" className="secondary" onClick={resend} disabled={busy}>
                  Resend
                </button>
                <button type="button" className="secondary" onClick={cancel} disabled={busy}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div id={RECAPTCHA_ID} className="mfa-recaptcha" />
        </div>
      </div>
    </div>
  );
}
