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

function greeting(firstName) {
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${hello}, ${firstName || "there"}.`;
}

function gaugeColor(level) {
  if (level === "high") return "var(--cyan)";
  if (level === "medium") return "var(--yellow)";
  return "var(--orange)";
}

function statusClass(level) {
  if (level === "high") return "dash-status-good";
  if (level === "medium") return "dash-status-tweak";
  return "dash-status-attention";
}

function resourceIcon(resource) {
  const hay = `${resource.type || ""} ${resource.title || ""}`.toLowerCase();
  if (hay.includes("video") || hay.includes("webinar")) return { kind: "video", mark: "▶" };
  if (hay.includes("podcast")) return { kind: "guide", mark: "🎙" };
  return { kind: "guide", mark: "📘" };
}

function Gauge({ percent, tone }) {
  const value = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const color = gaugeColor(tone);
  return (
    <div className="dash-gauge" aria-hidden="true">
      <div
        className="dash-gauge-track"
        style={{ background: `conic-gradient(${color} 0% ${value}%, var(--gauge-rest) ${value}% 100%)` }}
      />
      <div className="dash-gauge-face">
        <span className="dash-gauge-num">{Number.isFinite(percent) ? `${Math.round(value)}%` : "—"}</span>
      </div>
    </div>
  );
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
  const overall = analyticsFor("general");
  const overallPct = overall?.percentage != null ? Math.round(overall.percentage) : null;
  const actionItems = enhancedScores ? generateActionItems(enhancedScores) : [];
  const resources = unpaid
    ? getFreeLibraryResources().slice(0, 2)
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
          cta: "Open",
        },
        {
          title: "Unlock the Business Health Check",
          body: "Purchase the one-time $297 assessment when you are ready to begin.",
          view: "purchase",
          cta: "Buy",
        },
      ]
    : [];
  if (!unpaid) {
    if (!complete) {
      nextSteps.push({
        title: remaining === 1 ? "Finish the last assessment section" : `Finish remaining ${remaining} assessment sections`,
        body: "Continue building your baseline so scores and recommendations become more complete.",
        view: "assessmentUser",
        cta: "Continue",
      });
    }
    actionItems.slice(0, 2).forEach((item) => {
      nextSteps.push({
        title: `Focus on ${CATEGORIES[item.category] || item.category}`,
        body: "This is currently one of your lowest health areas.",
        view: "actionPlan",
        cta: "Start",
      });
    });
    if (nextSteps.length < 3) {
      nextSteps.push({
        title: "Review your Action Plan",
        body: "Turn current findings into prioritized follow-up work.",
        view: "actionPlan",
        cta: "Open",
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
  const checklistDone = checklist.filter((row) => row.done).length;

  return (
    <div className="page dash-home">
      <div className="page-head">
        <div>
          <h1>{greeting(firstName)}</h1>
          <p>
            {unpaid
              ? "Your assessment is locked until you purchase. You can still read free Help Center resources anytime."
              : "Here's your business health snapshot, current assessment progress, and next recommended actions."}
          </p>
          {lastUpdated ? (
            <p className="dash-updated">
              Scores last updated {lastUpdated.toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
      </div>

      <section className="dash-hero">
        <div className="dash-hero-left">
          <div className="dash-hero-badge">
            {unpaid ? "Assessment locked" : complete ? "Assessment complete" : "Assessment in progress"}
          </div>
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
            <div className="dash-progress">
              <div className="dash-progress-label">
                <span>Overall progress</span>
                <span>{percent}%</span>
              </div>
              <div className="dash-progress-track">
                <span style={{ width: `${percent}%` }} />
              </div>
            </div>
          ) : null}
          <div className="dash-hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (unpaid ? onRequestPurchase?.() : setActiveView("assessmentUser"))}
            >
              {unpaid ? "Assessment locked" : complete ? "Review Assessment" : "Continue Assessment"}
            </button>
            <button
              type="button"
              className="dash-btn-ghost"
              onClick={() => setActiveView(unpaid ? "resources" : "reports")}
            >
              {unpaid ? "Browse free resources" : "View Current Report"}
            </button>
          </div>
        </div>
        <div className="dash-hero-right">
          <div
            className="dash-big-gauge"
            style={{
              background: `conic-gradient(var(--orange) 0% ${overallPct || 0}%, rgba(255,255,255,.12) ${overallPct || 0}% 100%)`,
            }}
          >
            <div className="dash-big-gauge-inner">
              <div className="num">{unpaid || overallPct == null ? "—" : `${overallPct}%`}</div>
              <div className="lbl">Overall Health</div>
            </div>
          </div>
        </div>
      </section>

      <div className="dash-layout">
        <div>
          <section className="panel dash-panel">
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
                <div className="dash-todo">
                  <div className="dash-todo-num">$</div>
                  <div>
                    <strong>Scores are part of the paid assessment</strong>
                    <span>Until you purchase, you can still read free Help Center resources and come back to unlock the diagnostic anytime.</span>
                  </div>
                </div>
              ) : (
                <div className="dash-cat-grid">
                  {Object.keys(CATEGORIES).map((key) => {
                    const analytics = analyticsFor(key);
                    const level = analytics?.healthLevel;
                    const value = analytics?.percentage != null ? Math.round(analytics.percentage) : null;
                    return (
                      <div className="dash-cat-card" key={key}>
                        <Gauge percent={value} tone={level} />
                        <div className="dash-cat-name">{CATEGORIES[key]}</div>
                        {level ? (
                          <span className={`dash-status ${statusClass(level)}`}>{getHealthLevelLabel(level).label}</span>
                        ) : (
                          <span className="dash-status dash-status-empty">Not scored</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="panel dash-panel">
            <div className="panel-head">
              <div>
                <h2>What to Do Next</h2>
                <p>{unpaid ? "Use free resources now, or unlock the assessment when you are ready." : "Current priorities based on progress and results."}</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="dash-todo-list">
                {nextSteps.slice(0, 3).map((step, index) => (
                  <button
                    type="button"
                    className="dash-todo"
                    key={step.title}
                    onClick={() => (step.view === "purchase" ? onRequestPurchase?.() : setActiveView(step.view))}
                  >
                    <div className="dash-todo-num">{index + 1}</div>
                    <div className="dash-todo-body">
                      <strong>{step.title}</strong>
                      <span>{step.body}</span>
                    </div>
                    <span className="dash-todo-cta">{step.cta || "Open"} →</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside>
          <section className="panel dash-panel">
            <div className="panel-head">
              <div>
                <h2>BHC Checklist</h2>
                <p>Your progress through the full experience.</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="dash-check-list">
                {checklist.map((row) => (
                  <div
                    className={`dash-check-item${row.done ? " done" : ""}${row.current ? " current" : ""}`}
                    key={row.label}
                  >
                    <div className="dash-check-dot">{row.done ? "✓" : ""}</div>
                    {row.label}
                  </div>
                ))}
              </div>
              <div className="dash-check-progress">
                <span style={{ width: `${Math.round((checklistDone / checklist.length) * 100)}%` }} />
              </div>
              <div className="dash-check-label">{checklistDone} of {checklist.length} steps done</div>
            </div>
          </section>

          <section className="panel dash-panel">
            <div className="panel-head">
              <div>
                <h2>{unpaid ? "Free to read now" : "Recommended for You"}</h2>
                <p>{unpaid ? "Guides and worksheets in the Help Center." : "Based on your current results."}</p>
              </div>
            </div>
            <div className="panel-body">
              {resources.length > 0 ? (
                resources.map((resource) => {
                  const icon = resourceIcon(resource);
                  return (
                    <button
                      type="button"
                      className="dash-rec"
                      key={resource.title}
                      onClick={() => setActiveView("resources")}
                    >
                      <div className={`dash-rec-icon ${icon.kind}`}>{icon.mark}</div>
                      <div className="dash-rec-body">
                        <strong>{resource.title}</strong>
                        <p>{resource.description || resource.type || "Recommended resource"}</p>
                        <span>Open →</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <button type="button" className="dash-rec" onClick={() => setActiveView("resources")}>
                  <div className="dash-rec-icon guide">📘</div>
                  <div className="dash-rec-body">
                    <strong>Browse the Help Center</strong>
                    <p>Free guides, worksheets, and videos are available without purchasing.</p>
                    <span>Open →</span>
                  </div>
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
