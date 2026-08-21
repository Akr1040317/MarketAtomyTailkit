import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import ToastHost from "./Toast";
import WorkspaceChrome from "./WorkspaceChrome";
import WorkspaceTour from "./WorkspaceTour";
import { CLIENT_TOUR_STEPS } from "../utils/workspaceTourSteps";
import "../assets/dashboard-preview.css";

const CLIENT_NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "assessmentUser", label: "Assessment", badgeKey: "progress" },
  { id: "reports", label: "My Report" },
  { id: "actionPlan", label: "Action Plan" },
  { id: "resources", label: "Help Center" },
];

function readKey(uid) {
  return `ma-notif-read:${uid}`;
}

function loadReadIds(uid) {
  if (!uid || typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(readKey(uid));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(uid, ids) {
  if (!uid || typeof window === "undefined") return;
  window.localStorage.setItem(readKey(uid), JSON.stringify([...ids]));
}

export default function ClientWorkspace({
  activeView,
  setActiveView,
  firstName,
  lastName,
  onLogout,
  onFeedback,
  canSwitchAdmin,
  onSwitchAdmin,
  hasAssessmentAccess = true,
  children,
}) {
  const [completion, setCompletion] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => new Set());
  const user = getAuth().currentUser;

  useEffect(() => {
    setReadIds(loadReadIds(user?.uid));
  }, [user?.uid]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const [resultsSnap, sectionsSnap] = await Promise.all([
          getDocs(query(collection(db, "sectionResults"), where("userId", "==", user.uid))),
          getDocs(query(collection(db, "BHC_Assessment"))),
        ]);
        const done = new Set(resultsSnap.docs.map((docSnap) => docSnap.data().sectionName)).size;
        const total = sectionsSnap.size;
        setCompletion({
          done,
          total,
          percent: total > 0 ? Math.round((done / total) * 100) : 0,
        });
      } catch (error) {
        console.error("Error loading assessment progress:", error);
      }
    };
    load();
  }, [user, activeView]);

  const navItems = CLIENT_NAV.map((item) => ({
    ...item,
    locked: hasAssessmentAccess === false && ["dashboard", "assessmentUser", "reports", "actionPlan"].includes(item.id),
    badge:
      item.badgeKey === "progress" && completion && hasAssessmentAccess !== false
        ? `${completion.percent}%`
        : undefined,
  }));

  const notifications = useMemo(() => {
    const items = [];
    if (hasAssessmentAccess === false) {
      items.push({
        id: "unlock",
        title: "Unlock the assessment",
        body: "The Business Health Check is $297 one time. Help Center resources are free to browse now.",
        view: "dashboard",
      });
    } else if (completion?.percent === 100) {
      items.push({
        id: "report-ready",
        title: "Your report is ready",
        body: "All sections are complete. Review your scores and recommended next steps.",
        view: "reports",
      });
      items.push({
        id: "action-plan",
        title: "Review your action plan",
        body: "Turn your lowest-scoring areas into prioritized follow-up work.",
        view: "actionPlan",
      });
    } else if (completion) {
      const left = Math.max((completion.total || 0) - (completion.done || 0), 0);
      items.push({
        id: "continue",
        title: "Continue your assessment",
        body: left === 1 ? "One section left to finish your scores." : `${left} sections left to finish your full report.`,
        view: "assessmentUser",
      });
    }
    items.push({
      id: "help",
      title: "Help Center is open",
      body: "Guides, worksheets, and videos are available whenever you need them.",
      view: "resources",
    });
    return items.map((item) => ({ ...item, unread: !readIds.has(item.id) }));
  }, [completion, hasAssessmentAccess, readIds]);

  const markRead = (item) => {
    setReadIds((current) => {
      const next = new Set(current);
      next.add(item.id);
      saveReadIds(user?.uid, next);
      return next;
    });
  };

  const menuActions = [
    ...(canSwitchAdmin && onSwitchAdmin
      ? [{ label: "Admin View", onClick: onSwitchAdmin }]
      : []),
    { label: "Give Feedback", onClick: onFeedback },
    { label: "Report a Bug", onClick: () => setActiveView("bugReport") },
    { label: "Sign out", onClick: onLogout, danger: true },
  ];

  return (
    <>
      <WorkspaceChrome
        scopeClass="ma-dash"
        brandName="Business Health Check"
        navItems={navItems}
        activeView={activeView}
        onNavigate={setActiveView}
        firstName={firstName}
        lastName={lastName}
        profileRole="Client workspace"
        notifications={notifications}
        onNotificationClick={markRead}
        onStartWalkthrough={() => setTourOpen(true)}
        walkthroughLabel="Guided walkthrough"
        menuActions={menuActions}
      >
        {children}
      </WorkspaceChrome>
      <WorkspaceTour
        open={tourOpen}
        steps={CLIENT_TOUR_STEPS}
        onClose={() => setTourOpen(false)}
        onNavigate={setActiveView}
      />
      <ToastHost />
    </>
  );
}
