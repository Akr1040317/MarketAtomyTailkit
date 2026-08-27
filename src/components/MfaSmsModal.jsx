import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import {
  RECAPTCHA_ID,
  clearRecaptcha,
  completeChallenge,
  completeEnrollment,
  formatAuthError,
  formatPhoneHint,
  getPhoneHints,
  getRecaptchaVerifier,
  sendChallengeCode,
  sendEnrollmentCode,
  sendVerificationIfNeeded,
  toE164,
} from "../utils/mfaAuth";
import "../assets/mfa-sms.css";

export default function MfaSmsModal({
  open,
  mode = "enroll",
  user,
  resolver,
  initialPhone = "",
  skippable: skippableProp,
  onComplete,
  onSkip,
  onCancel,
}) {
  const skippable = skippableProp ?? (mode === "offer" || mode === "enroll");
  const [stage, setStage] = useState(mode === "challenge" ? "send" : mode === "offer" ? "offer" : "phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hints = getPhoneHints(resolver);
  const hintLabel = formatPhoneHint(hints[0]);

  useEffect(() => {
    if (!open) {
      clearRecaptcha();
      return;
    }
    setPhone(mode === "enroll" ? toE164(initialPhone) : "");
    setCode("");
    setVerificationId("");
    setError("");
    setBusy(false);
    setStage(mode === "challenge" ? "send" : mode === "offer" ? "offer" : "phone");
  }, [open, mode, initialPhone]);

  useEffect(() => {
    if (!open || (stage !== "send" && stage !== "phone")) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        await getRecaptchaVerifier();
      } catch {
        if (!cancelled) {
          /* Send/Resend will try again */
        }
      }
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, stage]);

  if (!open) return null;

  const skip = () => {
    clearRecaptcha();
    onSkip?.();
  };

  const abandonLogin = async () => {
    clearRecaptcha();
    try {
      await signOut(auth);
    } catch {
      /* ignore */
    }
    onCancel?.();
  };

  const dismiss = () => {
    if (skippable) skip();
    else void abandonLogin();
  };

  const startEnroll = async () => {
    setError("");
    try {
      await user?.reload?.();
    } catch {
      /* ignore */
    }
    if (user && !user.emailVerified) {
      await sendVerificationIfNeeded(user);
      setError(
        "Verify your email first to turn on two-step verification. We sent a link to your inbox. You can skip for now and add this later."
      );
      return;
    }
    setStage("phone");
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
      setStage("code");
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const sendChallenge = async (event) => {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const id = await sendChallengeCode(resolver, 0);
      setVerificationId(id);
      setStage("code");
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
      if (mode === "challenge") {
        const result = await completeChallenge(resolver, verificationId, code.trim());
        onComplete?.(result.user);
      } else {
        await completeEnrollment(user, verificationId, code.trim(), toE164(phone));
        onComplete?.(user, toE164(phone));
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
      if (mode === "challenge") {
        const id = await sendChallengeCode(resolver, 0);
        setVerificationId(id);
      } else {
        const e164 = toE164(phone);
        if (!e164) {
          setError("Enter a phone number with country code, like +15551234567.");
          return;
        }
        const id = await sendEnrollmentCode(user, e164);
        setVerificationId(id);
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const title =
    stage === "offer"
      ? "Protect your account"
      : stage === "send"
        ? "Confirm it is you"
        : stage === "phone"
          ? "Add your phone number"
          : "Enter your verification code";

  const recaptcha = <div id={RECAPTCHA_ID} className="mfa-recaptcha" />;

  return (
    <div className="mfa-sms">
      <div className="mfa-sms-backdrop" />
      <div className="mfa-sms-frame">
        <div className="mfa-sms-panel" role="dialog" aria-modal="true" aria-labelledby="mfa-title">
          {stage === "offer" ? <div className="mfa-sms-badge">Recommended</div> : null}
          <h2 id="mfa-title">{title}</h2>
          {stage === "offer" ? (
            <p>
              We suggest turning on two-step verification. After you sign in with your password or
              Google, we text a code to your phone so only you can get into the account. You can
              skip this and still use MarketAtomy.
            </p>
          ) : stage === "send" ? (
            <p>
              Complete the security check, then we will text a code to {hintLabel}.
            </p>
          ) : stage === "phone" ? (
            <p>
              Enter the number you want to use, then complete the security check. We will text a
              code to confirm it. Standard messaging rates may apply.
            </p>
          ) : (
            <p>
              {mode === "challenge"
                ? `We sent a code to ${hintLabel}. Enter it to finish signing in.`
                : `Enter the 6-digit code we texted to ${toE164(phone) || "your phone"}.`}
            </p>
          )}

          {error ? <p className="mfa-sms-error">{error}</p> : null}

          {stage === "offer" ? (
            <div className="mfa-sms-actions mfa-sms-actions-stack">
              <button type="button" className="primary" onClick={startEnroll} disabled={busy}>
                Turn on two-step verification
              </button>
              <button type="button" className="secondary" onClick={skip} disabled={busy}>
                Not now
              </button>
            </div>
          ) : stage === "send" ? (
            <form onSubmit={sendChallenge}>
              <div className="mfa-sms-actions">
                <button type="submit" className="primary" disabled={busy}>
                  {busy ? "Sending…" : "Send code"}
                </button>
                <button type="button" className="secondary" onClick={dismiss} disabled={busy}>
                  Cancel
                </button>
              </div>
            </form>
          ) : stage === "phone" ? (
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
                <button type="button" className="secondary" onClick={dismiss} disabled={busy}>
                  {skippable ? "Not now" : "Cancel"}
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
                <button type="button" className="secondary" onClick={dismiss} disabled={busy}>
                  {skippable ? "Not now" : "Cancel"}
                </button>
              </div>
            </form>
          )}
          {stage !== "offer" ? recaptcha : null}
        </div>
      </div>
    </div>
  );
}
