import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { getHealthLevelLabel, processComputedScores } from "./utils/analytics";
import { generateActionItems, getFreeLibraryResources, getRecommendedResources } from "./utils/reportContent";

const CATEGORIES = {
  foundationalStructure: "Foundational Structure",
  financialPosition: "Financial Strength",
  salesMarketing: "Sales & Marketing",
  productService: "Product Viability",
  general: "Overall Health",
};

const PILL = { high: "healthy", medium: "tweak", low: "attention" };

function greeting(firstName) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${hello}, ${firstName || "there"}.`;
}

export default function Dashboard({ setActiveView, hasAssessmentAccess = true, onRequestPurchase }) {
  const [firstName, setFirstName] = useState("");
  const [enhancedScores, setEnhancedScores] = useState(null);
  const [completedSections, setCompletedSections] = useState([]);
  const [totalSections, setTotalSections] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const user = getAuth().currentUser;

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setFirstName(data.firstName || "");
          setEnhancedScores(processComputedScores(data.computedScores || {}));
          if (data.overallHealth?.lastCalculated?.toDate) {
            setLastUpdated(data.overallHealth.lastCalculated.toDate());
          }
        }
        const [resultsSnap, sectionsSnap] = await Promise.all([
          getDocs(query(collection(db, "sectionResults"), where("userId", "==", user.uid))),
          getDocs(query(collection(db, "BHC_Assessment"))),
        ]);
        setCompletedSections([...new Set(resultsSnap.docs.map((d) => d.data().sectionName))]);
        setTotalSections(sectionsSnap.size);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };
    load();
  }, [user]);

  const unpaid = hasAssessmentAccess === false;
  const analyticsFor = (key) =>
    key === "general" ? enhancedScores?.overallHealth || enhancedScores?.general : enhancedScores?.[key];

  const percent = totalSections > 0 ? Math.round((completedSections.length / totalSections) * 100) : 0;
  const complete = totalSections > 0 && completedSections.length === totalSections;
  const actionItems = enhancedScores ? generateActionItems(enhancedScores) : [];
  const resources = unpaid
    ? getFreeLibraryResources().slice(0, 3)
    : enhancedScores
      ? getRecommendedResources(enhancedScores).slice(0, 2)
      : [];
  const remaining = Math.max(totalSections - completedSections.length, 0);

  const nextSteps = unpaid
    ? [
        {
          title: "Browse free Help Center resources",
          body: "Read guides, worksheets, and videos while the assessment stays locked.",
          view: "resources",
        },
        {
          title: "Unlock the Business Health Check",
          body: "Purchase the one-time $297 assessment when you are ready to begin.",
          view: "purchase",
        },
      ]
    : [];
  if (!unpaid) {
    if (!complete) {
      nextSteps.push({
        title: remaining === 1 ? "Finish the last assessment section" : `Finish remaining ${remaining} assessment sections`,
        body: "Continue building your baseline so scores and recommendations become more complete.",
        view: "assessmentUser",
      });
    }
    actionItems.slice(0, 2).forEach((item) => {
      nextSteps.push({
        title: `Focus on ${CATEGORIES[item.category] || item.category}`,
        body: "This is currently one of your lowest health areas.",
        view: "actionPlan",
      });
    });
    if (nextSteps.length < 3) {
      nextSteps.push({
        title: "Review your Action Plan",
        body: "Turn current findings into prioritized follow-up work.",
        view: "actionPlan",
      });
    }
  }

  const checklist = unpaid
    ? [
        { label: "Create account", done: true },
        { label: "Browse free resources", done: false, current: true },
        { label: "Purchase assessment", done: false },
        { label: "Finish assessment", done: false },
        { label: "Read report", done: false },
      ]
    : [
        { label: "Create account", done: true },
        { label: "Complete intake", done: Boolean(firstName) },
        { label: "Finish assessment", done: complete, current: !complete },
        { label: "Read report", done: false, current: complete },
        { label: "Review action plan", done: false },
        { label: "Download a resource", done: false },
      ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{greeting(firstName)}</h1>
          <p>
            {unpaid
              ? "Your assessment is locked until you purchase. You can still read free Help Center resources anytime."
              : "Your business health snapshot, current assessment progress, and next recommended actions."}
          </p>
        </div>
        <span className="meta-soft">
          {lastUpdated
            ? `Last updated ${lastUpdated.toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}`
            : unpaid
              ? "Assessment locked · Help Center is open"
              : "Complete a section to start your baseline"}
        </span>
      </div>

      <section className="panel hero-panel">
        <div className="panel-body" style={{ padding: "25px 26px" }}>
          <span className="pill" style={{ background: "rgba(245,196,0,.12)", color: "#F5D33E" }}>
            {unpaid ? "Assessment locked" : complete ? "Assessment complete" : "Assessment in progress"}
          </span>
          <h2>
            {unpaid
              ? "Purchase to begin the Business Health Check"
              : `${completedSections.length} of ${totalSections || 21} sections complete`}
          </h2>
          <p>
            {unpaid
              ? "The assessment, report, and action plan stay locked until checkout. Free guides, worksheets, and videos in the Help Center are available now."
              : complete
                ? "Review your scores, open the full report, and use recommended resources to decide what deserves attention next."
                : "Continue building your baseline. Scores and recommendations become more complete as you finish additional sections."}
          </p>
          {!unpaid ? (
            <>
              <div className="meta-soft" style={{ display: "flex", justifyContent: "space-between", margin: "18px 0 6px" }}>
                <span>Overall progress</span>
                <strong style={{ color: "#fff" }}>{percent}%</strong>
              </div>
              <div className="progress" style={{ background: "rgba(255,255,255,.08)" }}>
                <span style={{ width: `${percent}%` }} />
              </div>
            </>
          ) : null}
          <div style={{ display: "flex", gap: 9, marginTop: 18, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (unpaid ? onRequestPurchase?.() : setActiveView("assessmentUser"))}
            >
              {unpaid ? "Purchase assessment — $297" : complete ? "Review Assessment" : "Continue Assessment"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setActiveView(unpaid ? "resources" : "reports")}
            >
              {unpaid ? "Browse free resources" : "View Current Report"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid-main">
        <div>
          <section className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <div>
                <h2>{unpaid ? "Locked until purchase" : "Your Business Health"}</h2>
                <p>{unpaid ? "Scores and the full report appear after you complete the assessment." : "Current category results."}</p>
              </div>
              {unpaid ? null : (
                <button type="button" className="panel-link" onClick={() => setActiveView("reports")}>
                  Full report →
                </button>
              )}
            </div>
            <div className="panel-body">
              {unpaid ? (
                <div className="callout">
                  <strong>Scores are part of the paid assessment</strong>
                  <br />
                  Until you purchase, you can still read free Help Center resources and come back to unlock the diagnostic anytime.
                </div>
              ) : (
              <div className="grid-3">
                {Object.keys(CATEGORIES).map((key) => {
                  const analytics = analyticsFor(key);
                  const level = analytics?.healthLevel;
                  return (
                    <div className="callout" key={key}>
                      <strong>{CATEGORIES[key]}</strong>
                      <div className="score-num">{analytics ? `${Math.round(analytics.percentage || 0)}%` : "—"}</div>
                      {level ? (
                        <span className={`pill ${PILL[level] || "tweak"}`}>{getHealthLevelLabel(level).label}</span>
                      ) : (
                        <span className="pill info">Not scored</span>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>What to Do Next</h2>
                <p>{unpaid ? "Use free resources now, or unlock the assessment when you are ready." : "Current priorities based on progress and results."}</p>
              </div>
            </div>
            <div className="panel-body">
              {nextSteps.slice(0, 3).map((step, index) => (
                <button
                  type="button"
                  className="callout"
                  key={step.title}
                  style={{ marginTop: index ? 9 : 0, display: "block", width: "100%", textAlign: "left" }}
                  onClick={() => (step.view === "purchase" ? onRequestPurchase?.() : setActiveView(step.view))}
                >
                  <strong>{index + 1}. {step.title}</strong>
                  <br />
                  {step.body}
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside>
          <section className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <div>
                <h2>BHC Checklist</h2>
                <p>Your progress through the full experience.</p>
              </div>
            </div>
            <div className="panel-body" style={{ display: "grid", gap: 9 }}>
              {checklist.map((row) => (
                <div className="checklist-row" key={row.label}>
                  {row.done ? "✓" : row.current ? "◉" : "○"} {row.label}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>{unpaid ? "Free to read now" : "Recommended for You"}</h2>
                <p>{unpaid ? "Guides and worksheets in the Help Center." : "Based on your current results."}</p>
              </div>
            </div>
            <div className="panel-body">
              {resources.length > 0 ? (
                resources.map((resource, index) => (
                  <button
                    type="button"
                    className="callout"
                    key={resource.title}
                    style={{ display: "block", width: "100%", textAlign: "left", marginTop: index ? 9 : 0 }}
                    onClick={() => setActiveView("resources")}
                  >
                    <strong>{resource.title}</strong>
                    <br />
                    {resource.description || resource.type || "Recommended resource"}
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  className="callout"
                  style={{ display: "block", width: "100%", textAlign: "left" }}
                  onClick={() => setActiveView("resources")}
                >
                  <strong>Browse the Help Center</strong>
                  <br />
                  Free guides, worksheets, and videos are available without purchasing.
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
