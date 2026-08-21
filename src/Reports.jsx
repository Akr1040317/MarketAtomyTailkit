import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { getHealthLevelLabel, processComputedScores } from "./utils/analytics";
import { generateActionItems, getCategoryReport } from "./utils/reportContent";
import { toast } from "./components/Toast";
import "./assets/client-pages.css";
import LockedFeature from "./components/LockedFeature";

const CATEGORIES = {
  foundationalStructure: "Foundational Structure",
  financialPosition: "Financial Strength",
  salesMarketing: "Sales & Marketing",
  productService: "Product Viability",
};

const CATEGORY_ICON = {
  foundationalStructure: "FS",
  financialPosition: "FIN",
  salesMarketing: "S&M",
  productService: "PV",
};

const PILL = { high: "healthy", medium: "tweak", low: "attention" };
const ICON_CLASS = { high: "healthy", medium: "tweak", low: "attention" };
const BAR = { high: "var(--healthy)", medium: "#D4A70E", low: "var(--attention)" };

export default function Reports({ setActiveView, hasAssessmentAccess = true, onRequestPurchase }) {
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

  if (hasAssessmentAccess === false) {
    return (
      <LockedFeature
        title="My Report"
        body="Your scores and written report stay locked until you purchase the assessment."
        onRequestPurchase={onRequestPurchase}
        onBrowseResources={() => setActiveView?.("resources")}
      />
    );
  }

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
  const overallLevel = overall.healthLevel || "medium";

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

      <section className="cp-hero" style={{ marginBottom: 22 }}>
        <div
          className="cp-gauge"
          style={{
            background: `conic-gradient(${BAR[overallLevel]} 0 ${overallPct}%, rgba(255,255,255,.12) ${overallPct}%)`,
          }}
        >
          <div className="cp-gauge-inner">
            <strong>{overallPct}%</strong>
            <span>Overall</span>
          </div>
        </div>
        <div className="cp-hero-body">
          <span className={`pill ${PILL[overallLevel] || "tweak"}`}>
            {getHealthLevelLabel(overallLevel).label}
          </span>
          <h2>
            {actionItems.length > 0
              ? "Your business has a solid base with several important growth constraints."
              : overallLevel === "high"
                ? "Your business shows strong health across the major systems."
                : "Your results are starting to show a clearer picture of the business."}
          </h2>
          <p>
            Current results are based on the sections you have completed. Use the category cards below and your
            action plan to decide where attention will create the most value.
          </p>
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
                <div className="cp-cat-head">
                  <div className={`cp-cat-icon ${analytics ? ICON_CLASS[level] : "info"}`}>
                    {CATEGORY_ICON[key]}
                  </div>
                  <div>
                    <h2 style={{ margin: 0 }}>{label}</h2>
                    <p style={{ margin: "2px 0 0" }}>Current category result</p>
                  </div>
                </div>
                {analytics ? (
                  <span className={`pill ${PILL[level]}`}>{getHealthLevelLabel(level).label}</span>
                ) : (
                  <span className="pill info">Not scored</span>
                )}
              </div>
              <div className="panel-body">
                <div className="cp-cat-score">{analytics ? `${pct}%` : "—"}</div>
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
        <div className="panel-body">
          {actionItems.length > 0 ? (
            actionItems.slice(0, 3).map((item, index) => (
              <div className="cp-priority attention" key={item.category}>
                <div className="cp-priority-num">{index + 1}</div>
                <div>
                  <h3>{CATEGORIES[item.category] || item.category}</h3>
                  <p>Review this system and the recommended resources in your action plan.</p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveView?.("actionPlan")}>
                  View
                </button>
              </div>
            ))
          ) : (
            <div className="cp-priority info">
              <div className="cp-priority-num">✓</div>
              <div>
                <h3>Keep going</h3>
                <p>Finish remaining sections before treating the current report as final.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
