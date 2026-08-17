import { useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "../Toast";

const STEPS = [
  [
    "User Management",
    "Search by name, email, or username. Filter roles and completion, inspect client scores and answers, export users, and change admin/tier1 roles.",
  ],
  [
    "Analytics",
    "Use the unified Analytics workspace to understand health distribution, section drop-off, question performance, completion time, engagement, and at-risk users.",
  ],
  [
    "Report Content",
    "Edit the report narrative and recommended resources for each category and health state. Firestore overrides preserve the existing fallback behavior.",
  ],
  [
    "Assessment Management",
    "This is the highest-risk admin tool. Changing weights changes future scores. Never recycle question IDs, and avoid renaming section titles without migrating existing results.",
  ],
  [
    "Monitoring",
    "Triage bug reports by status and severity, review product feedback, inspect details, and mark resolved issues without altering client data.",
  ],
];

export default function AdminOnboarding({ setActiveView }) {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const user = getAuth().currentUser;
  const [title, copy] = STEPS[step];

  const persistHide = async () => {
    if (!dontShowAgain || !user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { hideAdminOnboarding: true });
    } catch (error) {
      console.error("Error saving admin onboarding preference:", error);
    }
  };

  const finish = async () => {
    await persistHide();
    setActiveView("adminDashboard");
  };

  const next = async () => {
    if (step < STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    toast("Admin dashboard is ready.");
    await finish();
  };

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-head">
        <div>
          <h1>Admin Walkthrough</h1>
          <p>A guided introduction to the highest-impact administrative workflows.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={finish}>
          Skip
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
                  background: index <= step ? "#2E6BB0" : "#E1E6EB",
                }}
              />
            ))}
          </div>
          <span className="pill info">Step {step + 1} of {STEPS.length}</span>
          <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: "1.5rem", fontWeight: 800, margin: "13px 0 8px" }}>{title}</h2>
          <p className="muted" style={{ maxWidth: 700, lineHeight: 1.65 }}>{copy}</p>
          <div className="onboarding-footer">
            <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              Back
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
                <span className="muted">Don't show again</span>
              </label>
              <button type="button" className="btn btn-primary" onClick={next}>
                {step === STEPS.length - 1 ? "Open Admin Dashboard" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
