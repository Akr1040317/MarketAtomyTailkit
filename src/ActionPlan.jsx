import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { processComputedScores } from "./utils/analytics";
import { generateActionItems, getRecommendedResources } from "./utils/reportContent";
import { toast } from "./components/Toast";

const CATEGORIES = {
  foundationalStructure: "Foundational Structure",
  financialPosition: "Financial Strength",
  salesMarketing: "Sales & Marketing",
  productService: "Product Viability",
  general: "Overall Health",
};

export default function ActionPlan({ setActiveView }) {
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
        label: "Priority",
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
        label: "Priority",
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
            label: "Priority",
            title: `Strengthen ${CATEGORIES[row.key]}`,
            body: `${CATEGORIES[row.key]} currently needs tweaking.`,
          });
        });
    }
    return items.slice(0, 6).map((item, index) => ({ ...item, label: `Priority ${index + 1}` }));
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

  const roadmap = complete
    ? [
        ["✓ Assessment", "Build the baseline"],
        ["◉ Analysis", "Understand the gaps"],
        ["○ Strategy", "Choose priorities"],
        ["○ Implementation", "Put the plan to work"],
        ["○ Growth", "Measure and improve"],
      ]
    : [
        ["◉ Assessment", "Build the baseline"],
        ["○ Analysis", "Understand the gaps"],
        ["○ Strategy", "Choose priorities"],
        ["○ Implementation", "Put the plan to work"],
        ["○ Growth", "Measure and improve"],
      ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Action Plan</h1>
          <p>Turn assessment findings into an ordered list of practical follow-up work. This page translates your lowest health areas and report priorities into a working plan.</p>
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
                tasks.map((task) => {
                  const done = doneIds.includes(task.id);
                  return (
                    <div className="task callout" key={task.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
                        <div>
                          <span className={`pill ${done ? "healthy" : task.pill}`}>{done ? "Complete" : task.label}</span>
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
                            className={`btn ${done ? "btn-navy" : "btn-secondary"} complete-task`}
                            onClick={() => toggleDone(task.id)}
                          >
                            {done ? "Completed" : "Mark Complete"}
                          </button>
                        )}
                      </div>
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
              <div className="grid-3">
                {roadmap.map(([title, copy]) => (
                  <div className="callout" key={title}>
                    <strong>{title}</strong>
                    <br />
                    {copy}
                  </div>
                ))}
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
            <div className="panel-body">
              <div className="report-score">{progress}%</div>
              <div className="progress" style={{ marginTop: 8 }}>
                <span style={{ width: `${progress}%` }} />
              </div>
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
                    className="callout"
                    key={resource.title}
                    style={{ display: "block", width: "100%", textAlign: "left", marginTop: index ? 9 : 0 }}
                    onClick={() => setActiveView("resources")}
                  >
                    <strong>{resource.title}</strong>
                    <br />
                    {resource.type || "Recommended resource"}
                  </button>
                ))
              ) : (
                <button type="button" className="callout" style={{ display: "block", width: "100%", textAlign: "left" }} onClick={() => setActiveView("resources")}>
                  <strong>Open Help Center</strong>
                  <br />
                  Guides and consultations
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
