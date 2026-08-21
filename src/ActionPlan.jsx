import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { processComputedScores } from "./utils/analytics";
import { generateActionItems, getRecommendedResources } from "./utils/reportContent";
import { toast } from "./components/Toast";
import "./assets/client-pages.css";
import LockedFeature from "./components/LockedFeature";

const CATEGORIES = {
  foundationalStructure: "Foundational Structure",
  financialPosition: "Financial Strength",
  salesMarketing: "Sales & Marketing",
  productService: "Product Viability",
  general: "Overall Health",
};

export default function ActionPlan({ setActiveView, hasAssessmentAccess = true, onRequestPurchase }) {
  const [enhancedScores, setEnhancedScores] = useState(null);
  const [complete, setComplete] = useState(false);
  const [doneIds, setDoneIds] = useState([]);
  const user = getAuth().currentUser;
  const storageKey = user ? `bhcActionPlan:${user.uid}` : null;

  useEffect(() => {
    if (storageKey) {
      try {
        setDoneIds(JSON.parse(localStorage.getItem(storageKey) || "[]"));
      } catch {
        setDoneIds([]);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setEnhancedScores(processComputedScores(snap.data().computedScores || {}));
      }
      const [resultsSnap, sectionsSnap] = await Promise.all([
        getDocs(query(collection(db, "sectionResults"), where("userId", "==", user.uid))),
        getDocs(query(collection(db, "BHC_Assessment"))),
      ]);
      const done = new Set(resultsSnap.docs.map((d) => d.data().sectionName)).size;
      setComplete(sectionsSnap.size > 0 && done === sectionsSnap.size);
    };
    load().catch((error) => console.error("Error loading action plan:", error));
  }, [user]);

  const tasks = useMemo(() => {
    const items = [];
    if (!complete) {
      items.push({
        id: "finish-assessment",
        pill: "info",
        title: "Finish remaining assessment sections",
        body: "Complete the baseline before finalizing strategy.",
        continueAssessment: true,
      });
    }
    const lows = generateActionItems(enhancedScores);
    lows.forEach((item) => {
      items.push({
        id: `cat:${item.category}`,
        pill: "attention",
        title: `Review ${CATEGORIES[item.category] || item.category}`,
        body: `${CATEGORIES[item.category] || item.category} is currently one of your lowest categories.`,
      });
    });
    if (enhancedScores) {
      Object.keys(CATEGORIES)
        .filter((key) => key !== "general")
        .map((key) => ({ key, analytics: enhancedScores[key] }))
        .filter((row) => row.analytics?.healthLevel === "medium" && !items.some((t) => t.id === `cat:${row.key}`))
        .sort((a, b) => (a.analytics.percentage || 0) - (b.analytics.percentage || 0))
        .forEach((row) => {
          items.push({
            id: `cat:${row.key}`,
            pill: "tweak",
            title: `Strengthen ${CATEGORIES[row.key]}`,
            body: `${CATEGORIES[row.key]} currently needs tweaking.`,
          });
        });
    }
    return items.slice(0, 6);
  }, [enhancedScores, complete]);

  const toggleDone = (id) => {
    const next = doneIds.includes(id) ? doneIds.filter((x) => x !== id) : [...doneIds, id];
    setDoneIds(next);
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
    toast(doneIds.includes(id) ? "Action reopened." : "Action marked complete.");
  };

  const doneCount = tasks.filter((task) => doneIds.includes(task.id)).length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const resources = enhancedScores ? getRecommendedResources(enhancedScores).slice(0, 2) : [];

  const exportPlan = () => {
    const lines = [
      "MarketAtomy Business Health Check — Action Plan",
      "",
      ...tasks.map((task, index) => `${index + 1}. ${task.title}${doneIds.includes(task.id) ? " (complete)" : ""}\n   ${task.body}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "marketatomy-action-plan.txt";
    link.click();
    URL.revokeObjectURL(url);
    toast("Action plan exported.");
  };

  const roadmap = [
    ["Assessment", "Build the baseline"],
    ["Analysis", "Understand the gaps"],
    ["Strategy", "Choose priorities"],
    ["Implementation", "Put the plan to work"],
    ["Growth", "Measure and improve"],
  ];
  const roadmapStage = complete ? 1 : 0;

  if (hasAssessmentAccess === false) {
    return (
      <LockedFeature
        title="Action Plan"
        body="Your action plan is created from assessment results, so this page stays locked until you purchase."
        onRequestPurchase={onRequestPurchase}
        onBrowseResources={() => setActiveView?.("resources")}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Action Plan</h1>
          <p>
            Turn assessment findings into an ordered list of practical follow-up work. This page translates your
            lowest health areas and report priorities into a working plan.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={exportPlan}>
          Export Plan
        </button>
      </div>

      <div className="grid-main">
        <div>
          <section className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <div>
                <h2>Priority Actions</h2>
                <p>Ordered by current business health need.</p>
              </div>
              <span className="pill tweak">{tasks.filter((t) => !doneIds.includes(t.id)).length} active</span>
            </div>
            <div className="panel-body">
              {tasks.length === 0 ? (
                <div className="callout">Complete more of the assessment to generate a prioritized plan.</div>
              ) : (
                tasks.map((task, index) => {
                  const done = doneIds.includes(task.id);
                  return (
                    <div className={`cp-priority ${done ? "done" : task.pill}`} key={task.id}>
                      <div className="cp-priority-num">{done ? "✓" : index + 1}</div>
                      <div>
                        <h3>{task.title}</h3>
                        <p>{task.body}</p>
                      </div>
                      {task.continueAssessment && !done ? (
                        <button type="button" className="btn btn-primary" onClick={() => setActiveView("assessmentUser")}>
                          Continue
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`btn ${done ? "btn-navy" : "btn-secondary"}`}
                          onClick={() => toggleDone(task.id)}
                        >
                          {done ? "Completed" : "Mark Complete"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Growth Roadmap</h2>
                <p>Assessment → Analysis → Strategy → Implementation → Growth</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="cp-roadmap">
                {roadmap.map(([title, copy], index) => {
                  const state = index < roadmapStage ? "done" : index === roadmapStage ? "current" : "todo";
                  return (
                    <div className={`cp-roadmap-step ${state}`} key={title}>
                      <div className="cp-roadmap-dot">{state === "done" ? "✓" : index + 1}</div>
                      <strong>{title}</strong>
                      <span>{copy}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside>
          <section className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-head">
              <div>
                <h2>Plan Progress</h2>
                <p>Current completion</p>
              </div>
            </div>
            <div className="panel-body" style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                className="cp-gauge"
                style={{
                  width: 78,
                  height: 78,
                  background: `conic-gradient(var(--cyan) 0 ${progress}%, #eef2f6 ${progress}%)`,
                }}
              >
                <div className="cp-gauge-inner" style={{ width: 60, height: 60, background: "#fff", border: "1px solid var(--line)" }}>
                  <strong style={{ color: "var(--text)" }}>{progress}%</strong>
                </div>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: "0.8125rem" }}>
                {doneCount} of {tasks.length} priority actions marked complete.
              </p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Helpful Resources</h2>
                <p>Matched to your priorities</p>
              </div>
            </div>
            <div className="panel-body">
              {resources.length > 0 ? (
                resources.map((resource, index) => (
                  <button
                    type="button"
                    className="cp-priority info"
                    key={resource.title}
                    style={{ display: "grid", width: "100%", textAlign: "left", cursor: "pointer", marginTop: index ? 10 : 0 }}
                    onClick={() => setActiveView("resources")}
                  >
                    <div className="cp-priority-num">▤</div>
                    <div>
                      <h3>{resource.title}</h3>
                      <p>{resource.type || "Recommended resource"}</p>
                    </div>
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  className="cp-priority info"
                  style={{ display: "grid", width: "100%", textAlign: "left", cursor: "pointer" }}
                  onClick={() => setActiveView("resources")}
                >
                  <div className="cp-priority-num">▤</div>
                  <div>
                    <h3>Open Help Center</h3>
                    <p>Guides and consultations</p>
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
