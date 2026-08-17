import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { aggregateUserScores, getHealthLevelDistribution } from "../../utils/adminUtils";
import { healthMeta } from "../../utils/adminUi";

function toDate(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

function timeAgo(value) {
  const date = toDate(value);
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function AdminOverview({ setActiveView }) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionResults, setSectionResults] = useState([]);
  const [openBugs, setOpenBugs] = useState([]);
  const [feedbackCount, setFeedbackCount] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      const [usersSnap, sectionsSnap, resultsSnap, bugsSnap, feedbackSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "BHC_Assessment")),
        getDocs(collection(db, "sectionResults")),
        getDocs(collection(db, "bugReports")),
        getDocs(collection(db, "feedback")),
      ]);
      setUsers(usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setSections(sectionsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setSectionResults(resultsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setOpenBugs(
        bugsSnap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((bug) => (bug.status || "open") !== "resolved")
      );
      setFeedbackCount(feedbackSnap.size);
    } catch (error) {
      console.error("Error loading admin overview:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const totalSections = sections.length || 21;
    const completedUserIds = new Set();
    const startedUserIds = new Set();
    const halfwayUserIds = new Set();
    const resultsByUser = {};

    sectionResults.forEach((result) => {
      if (!result.userId) return;
      startedUserIds.add(result.userId);
      if (!resultsByUser[result.userId]) resultsByUser[result.userId] = new Set();
      if (result.sectionName) resultsByUser[result.userId].add(result.sectionName);
    });

    Object.entries(resultsByUser).forEach(([userId, names]) => {
      if (names.size >= Math.ceil(totalSections / 2)) halfwayUserIds.add(userId);
      if (names.size >= totalSections) completedUserIds.add(userId);
    });

    users.forEach((user) => {
      if (user.computedScores && Object.keys(user.computedScores).length >= 5) {
        completedUserIds.add(user.id);
      }
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeThisWeek = users.filter((user) => {
      const last = toDate(user.lastLoggedOn);
      return last && last >= weekAgo;
    }).length;

    const inactiveAssessments = users.filter((user) => {
      const hasScores = user.computedScores && Object.keys(user.computedScores).length >= 5;
      if (hasScores) return false;
      const last = toDate(user.lastLoggedOn) || toDate(user.createdAt);
      return last && last < weekAgo;
    }).length;

    const aggregated = aggregateUserScores(users);
    const distribution = getHealthLevelDistribution(aggregated.healthLevelDistribution);
    const highSeverity = openBugs.filter((bug) => bug.severity === "high" || bug.severity === "critical").length;

    const recent = [
      ...users.map((user) => ({
        kind: "user",
        at: toDate(user.createdAt),
        title: `New client: ${user.firstName || ""} ${user.lastName || ""}`.trim(),
        detail: `Account created with ${user.role || "tier1"} role`,
        pill: "neutral",
      })),
      ...sectionResults.map((result) => ({
        kind: "result",
        at: toDate(result.submittedAt),
        title: `${result.userEmail || "Client"} updated ${result.sectionName || "a section"}`,
        detail: result.notApplicable ? "Marked not applicable" : "Section result saved",
        pill: "info",
      })),
    ]
      .filter((item) => item.at)
      .sort((a, b) => b.at - a.at)
      .slice(0, 6);

    const maxFunnel = Math.max(users.length, 1);
    const funnel = [
      { label: "Signed up", value: users.length, cls: "" },
      { label: "Started", value: startedUserIds.size, cls: "" },
      { label: "50%+", value: halfwayUserIds.size, cls: "orange" },
      { label: "Completed", value: completedUserIds.size, cls: "orange" },
    ];

    return {
      totalClients: users.length,
      completed: completedUserIds.size,
      completionRate: users.length ? Math.round((completedUserIds.size / users.length) * 1000) / 10 : 0,
      activeThisWeek,
      openIssues: openBugs.length,
      highSeverity,
      inactiveAssessments,
      distribution,
      recent,
      funnel,
      maxFunnel,
      healthyPct: distribution.high.percentage,
      tweakPct: distribution.medium.percentage,
      attentionPct: distribution.low.percentage,
    };
  }, [users, sections, sectionResults, openBugs]);

  if (loading) {
    return (
      <div className="page">
        <p>Loading admin overview...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Admin Overview</h1>
          <p>A clear view of platform activity, assessment progress, business health distribution, and items that need administrative attention.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={load}>Refresh</button>
          <button type="button" className="btn btn-primary" onClick={() => setActiveView("adminUsers")}>View Users</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 18 }}>
        <div className="metric">
          <div className="metric-label">Total clients</div>
          <strong>{stats.totalClients}</strong>
          <span className="trend">{stats.activeThisWeek} active this week</span>
        </div>
        <div className="metric">
          <div className="metric-label">Completed assessments</div>
          <strong>{stats.completed}</strong>
          <span className="trend">{stats.completionRate}% completion</span>
        </div>
        <div className="metric">
          <div className="metric-label">Active this week</div>
          <strong>{stats.activeThisWeek}</strong>
          <small>Based on lastLoggedOn</small>
        </div>
        <div className="metric">
          <div className="metric-label">Open issues</div>
          <strong>{stats.openIssues}</strong>
          <span className={`trend${stats.highSeverity ? " down" : ""}`}>
            {stats.highSeverity} high severity
          </span>
        </div>
      </div>

      <div className="grid-main">
        <div>
          <section className="panel" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <div>
                <h2>Assessment Funnel</h2>
                <p>Where clients are currently moving or dropping off.</p>
              </div>
              <button type="button" className="link-btn" onClick={() => setActiveView("adminAnalytics")}>
                Open Analytics →
              </button>
            </div>
            <div className="panel-body">
              <div className="chart">
                <div className="bars">
                  {stats.funnel.map((bar) => (
                    <div
                      key={bar.label}
                      className={`bar ${bar.cls}`.trim()}
                      style={{ height: `${Math.max(12, Math.round((bar.value / stats.maxFunnel) * 90))}%` }}
                    >
                      <strong>{bar.value}</strong>
                      <span>{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Recent Client Activity</h2>
                <p>Latest account and assessment events.</p>
              </div>
            </div>
            <div className="panel-body list">
              {stats.recent.length === 0 ? (
                <div className="empty">
                  <h3>No recent activity</h3>
                  <p>New accounts and saved sections will appear here.</p>
                </div>
              ) : (
                stats.recent.map((item, index) => (
                  <div className="list-item" key={`${item.title}-${index}`}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <span className={`pill ${item.pill}`}>{timeAgo(item.at)}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside>
          <section className="panel" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <div>
                <h2>Health Distribution</h2>
                <p>Overall client health levels.</p>
              </div>
            </div>
            <div className="panel-body" style={{ display: "grid", placeItems: "center" }}>
              <div className="donut-wrap">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(var(--healthy) 0 ${stats.healthyPct}%, #D0A50F ${stats.healthyPct}% ${stats.healthyPct + stats.tweakPct}%, var(--attention) ${stats.healthyPct + stats.tweakPct}%)`,
                  }}
                />
                <div className="donut-center">
                  <strong>{stats.totalClients}</strong>
                  <span>clients</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 13, flexWrap: "wrap", justifyContent: "center" }}>
                <span className={`pill ${healthMeta("high").className}`}>{stats.healthyPct}% Healthy</span>
                <span className={`pill ${healthMeta("medium").className}`}>{stats.tweakPct}% Tweaking</span>
                <span className={`pill ${healthMeta("low").className}`}>{stats.attentionPct}% Attention</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Needs Attention</h2>
                <p>Administrative work queue.</p>
              </div>
            </div>
            <div className="panel-body list">
              <button type="button" className="list-item" onClick={() => setActiveView("adminMonitoring")}>
                <div>
                  <strong>{stats.highSeverity} high severity bugs</strong>
                  <span>Open and unresolved</span>
                </div>
                <span>→</span>
              </button>
              <button type="button" className="list-item" onClick={() => setActiveView("adminMonitoring")}>
                <div>
                  <strong>{feedbackCount} feedback submissions</strong>
                  <span>Awaiting review</span>
                </div>
                <span>→</span>
              </button>
              <button type="button" className="list-item" onClick={() => setActiveView("adminUsers")}>
                <div>
                  <strong>{stats.inactiveAssessments} inactive assessments</strong>
                  <span>No activity in 7+ days</span>
                </div>
                <span>→</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
