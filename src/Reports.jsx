import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { getHealthLevelLabel, processComputedScores } from "./utils/analytics";
import { generateActionItems, getCategoryReport } from "./utils/reportContent";
import { toast } from "./components/Toast";

const CATEGORIES = {
  foundationalStructure: "Foundational Structure",
  financialPosition: "Financial Strength",
  salesMarketing: "Sales & Marketing",
  productService: "Product Viability",
};

const PILL = { high: "healthy", medium: "tweak", low: "attention" };
const BAR = { high: "var(--healthy)", medium: "#D4A70E", low: "var(--attention)" };

export default function Reports({ setActiveView }) {
  const [enhancedScores, setEnhancedScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = getAuth().currentUser;

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setEnhancedScores(processComputedScores(snap.data().computedScores || {}));
        }
      } catch (error) {
        console.error("Error fetching report:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const downloadPdf = async () => {
    if (!enhancedScores) return;
    const { downloadPDFReport } = await import("./utils/pdfGenerator");
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};
    await downloadPDFReport(enhancedScores, {
      firstName: data.firstName || "",
      email: user?.email || "",
    });
    toast("PDF export started.");
  };

  if (loading) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-icon">▤</div>
          <h3>Loading your report…</h3>
        </div>
      </div>
    );
  }

  const overall = enhancedScores?.overallHealth;
  const hasScores = overall && overall.categoryCount > 0;
  const actionItems = enhancedScores ? generateActionItems(enhancedScores) : [];

  if (!hasScores) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-icon">▤</div>
          <h3>No assessment data available</h3>
          <p>Complete assessment sections to generate your Business Health Report.</p>
          <button type="button" className="btn btn-primary" onClick={() => setActiveView?.("assessmentUser")}>
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  const overallPct = Math.round(overall.percentage || 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My Business Health Report</h1>
          <p>Your current executive summary, category health, priority areas, and recommended resources.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            Print Report
          </button>
          <button type="button" className="btn btn-primary" onClick={downloadPdf}>
            Download PDF
          </button>
        </div>
      </div>

      <section className="panel hero-panel" style={{ marginBottom: 20 }}>
        <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: `conic-gradient(var(--cyan) 0 ${overallPct}%, rgba(255,255,255,.09) ${overallPct}%)`,
            }}
          >
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: "#12223A", display: "grid", placeItems: "center", textAlign: "center" }}>
              <strong style={{ font: "800 26px Manrope" }}>{overallPct}%</strong>
            </div>
          </div>
          <div>
            <span className={`pill ${PILL[overall.healthLevel] || "tweak"}`}>
              {getHealthLevelLabel(overall.healthLevel).label}
            </span>
            <h2 style={{ fontFamily: "Manrope", margin: "9px 0 7px" }}>
              {actionItems.length > 0
                ? "Your business has a solid base with several important growth constraints."
                : overall.healthLevel === "high"
                  ? "Your business shows strong health across the major systems."
                  : "Your results are starting to show a clearer picture of the business."}
            </h2>
            <p className="category-copy" style={{ margin: 0, maxWidth: 770 }}>
              Current results are based on the sections you have completed. Use the category cards below and your action plan to decide where attention will create the most value.
            </p>
          </div>
        </div>
      </section>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {Object.entries(CATEGORIES).map(([key, label]) => {
          const analytics = enhancedScores?.[key];
          const level = analytics?.healthLevel || "medium";
          const report = analytics ? getCategoryReport(key, analytics.healthLevel) : null;
          const pct = Math.round(analytics?.percentage || 0);
          return (
            <section className="panel" key={key}>
              <div className="panel-head">
                <div>
                  <h2>{label}</h2>
                  <p>Current category result</p>
                </div>
                {analytics ? (
                  <span className={`pill ${PILL[level]}`}>{getHealthLevelLabel(level).label}</span>
                ) : (
                  <span className="pill info">Not scored</span>
                )}
              </div>
              <div className="panel-body">
                <div className="report-score">{analytics ? `${pct}%` : "—"}</div>
                <div className="progress" style={{ margin: "8px 0 14px" }}>
                  <span style={{ width: `${analytics ? pct : 0}%`, background: BAR[level] }} />
                </div>
                <p className="category-copy">
                  {report?.message || "Complete more sections to generate this category summary."}
                </p>
              </div>
            </section>
          );
        })}
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Priority Action Items</h2>
            <p>Focus first on the categories that need the most attention.</p>
          </div>
          <button type="button" className="panel-link" onClick={() => setActiveView?.("actionPlan")}>
            Open Action Plan →
          </button>
        </div>
        <div className="panel-body grid-3">
          {actionItems.length > 0 ? (
            actionItems.slice(0, 3).map((item, index) => (
              <div className="callout" key={item.category}>
                <strong>{index + 1}. {CATEGORIES[item.category] || item.category}</strong>
                <br />
                Review this system and the recommended resources in your action plan.
              </div>
            ))
          ) : (
            <div className="callout">
              <strong>Keep going</strong>
              <br />
              Finish remaining sections before treating the current report as final.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
