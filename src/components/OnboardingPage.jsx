import { useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { toast } from "./Toast";

const STEPS = [
  [
    "Diagnose 5 business systems",
    "The Business Health Check helps you build an honest baseline across the major systems that shape business health. You can complete it over multiple sessions.",
  ],
  [
    "How scoring works",
    "Answer honestly. Health is shown as Needs Attention, Needs Tweaking, or Healthy. These labels are guidance for where to focus, not a school grade.",
  ],
  [
    "How to take the assessment",
    "There are 21 sections. Save one section at a time, come back later, and review completed sections. Production is skipped when it does not apply.",
  ],
  [
    "What you get",
    "Your dashboard includes scores, a full report, PDF export, recommended resources, and an optional coach debrief.",
  ],
  [
    "Confirm your profile",
    "Before starting, confirm your name so your report reflects the right information.",
  ],
  [
    "You are ready",
    "Start the first assessment section now, or explore the dashboard first.",
  ],
];

export default function OnboardingPage({ setActiveView, firstName, lastName }) {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const user = getAuth().currentUser;
  const [title, copy] = STEPS[step];

  const persistHide = async () => {
    if (!dontShowAgain || !user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { hideOnboarding: true });
    } catch (error) {
      console.error("Error saving onboarding preference:", error);
    }
  };

  const skip = async () => {
    await persistHide();
    setActiveView("dashboard");
  };

  const next = async () => {
    if (step < STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    await persistHide();
    toast("Welcome. Your first assessment section is ready.");
    setActiveView("assessmentUser");
  };

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="page-head">
        <div>
          <h1>Welcome to the Business Health Check</h1>
          <p>A guided introduction before you begin your first assessment section.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={skip}>
          Skip Tour
        </button>
      </div>
      <section className="panel">
        <div className="panel-body" style={{ padding: 32 }}>
          <div style={{ display: "flex", gap: 7, marginBottom: 24 }}>
            {STEPS.map((_, index) => (
              <span
                key={index}
                style={{
                  width: index === step ? 28 : 8,
                  height: 7,
                  borderRadius: 99,
                  background: index <= step ? "#2E6BB0" : "#E2E7ED",
                }}
              />
            ))}
          </div>
          <span className="pill info">
            Step {step + 1} of {STEPS.length}
          </span>
          <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: "1.5rem", fontWeight: 800, margin: "13px 0 8px" }}>{title}</h2>
          <p className="muted" style={{ maxWidth: 680 }}>{copy}</p>
          {step === 4 ? (
            <div className="grid-2" style={{ marginTop: 18 }}>
              <div className="form-group">
                <label>First name</label>
                <input type="text" value={firstName || ""} readOnly />
              </div>
              <div className="form-group">
                <label>Last name</label>
                <input type="text" value={lastName || ""} readOnly />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Email</label>
                <input type="email" value={user?.email || ""} readOnly />
              </div>
            </div>
          ) : null}
          <div className="onboarding-footer">
            <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              Back
            </button>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, margin: 0 }}>
                <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
                <span className="muted">Don't show again</span>
              </label>
              <button type="button" className="btn btn-primary" onClick={next}>
                {step === STEPS.length - 1 ? "Start Assessment" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
