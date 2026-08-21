import { useEffect, useState } from "react";
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
  const user = getAuth().currentUser;

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
    locked: hasAssessmentAccess === false && ["assessmentUser", "reports", "actionPlan"].includes(item.id),
    badge:
      item.badgeKey === "progress" && completion && hasAssessmentAccess !== false
        ? `${completion.percent}%`
        : undefined,
  }));

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
        tagline="Business Health Check"
        navItems={navItems}
        activeView={activeView}
        onNavigate={setActiveView}
        firstName={firstName}
        lastName={lastName}
        profileRole="Client workspace"
        profileMeta={
          hasAssessmentAccess === false
            ? "Help Center open"
            : completion
              ? `${completion.percent}% complete`
              : null
        }
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
