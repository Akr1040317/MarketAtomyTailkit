import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import ToastHost from "./Toast";
import WorkspaceChrome from "./WorkspaceChrome";
import WorkspaceTour from "./WorkspaceTour";
import { ADMIN_TOUR_STEPS } from "../utils/workspaceTourSteps";
import "../assets/admin-preview.css";

const ADMIN_NAV = [
  {
    id: "adminDashboard",
    label: "Overview",
    countKey: "users",
    isActive: (view) => view === "adminDashboard" || view === "adminOnboarding",
  },
  { id: "adminUsers", label: "Users", countKey: "users" },
  { id: "adminAnalytics", label: "Analytics" },
  { id: "adminContent", label: "Content" },
  { id: "adminMonitoring", label: "Monitoring", countKey: "bugs" },
  { id: "assessment", label: "Assessment CMS", countKey: "sections" },
];

export default function AdminWorkspace({
  activeView,
  setActiveView,
  firstName,
  lastName,
  onLogout,
  onSwitchClient,
  onStartAsNewClient,
  children,
}) {
  const [counts, setCounts] = useState({ users: 0, bugs: 0, sections: 0 });
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersSnap, bugsSnap, sectionsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "bugReports")),
          getDocs(collection(db, "BHC_Assessment")),
        ]);
        setCounts({
          users: usersSnap.size,
          bugs: bugsSnap.docs.filter((docSnap) => (docSnap.data().status || "open") !== "resolved").length,
          sections: sectionsSnap.size,
        });
      } catch (error) {
        console.error("Error loading admin nav counts:", error);
      }
    };
    load();
  }, [activeView]);

  const navItems = ADMIN_NAV.map((item) => ({
    id: item.id,
    label: item.label,
    isActive: item.isActive,
    count: item.countKey ? counts[item.countKey] || 0 : undefined,
  }));

  const menuActions = [
    { label: "Client Preview", onClick: onSwitchClient },
    ...(onStartAsNewClient
      ? [{ label: "Take assessment as new client", onClick: onStartAsNewClient }]
      : []),
    { label: "Give Feedback", onClick: () => setActiveView("adminFeedback") },
    { label: "Report a Bug", onClick: () => setActiveView("adminBugReport") },
    { label: "Sign out", onClick: onLogout, danger: true },
  ];

  return (
    <>
      <WorkspaceChrome
        scopeClass="ma-admin"
        tagline="Admin Portal"
        navItems={navItems}
        activeView={activeView}
        onNavigate={setActiveView}
        firstName={firstName}
        lastName={lastName}
        profileRole="Administrator"
        profileMeta={`${counts.users} users`}
        onStartWalkthrough={() => setTourOpen(true)}
        walkthroughLabel="Admin walkthrough"
        menuActions={menuActions}
      >
        {children}
      </WorkspaceChrome>
      <WorkspaceTour
        open={tourOpen}
        steps={ADMIN_TOUR_STEPS}
        onClose={() => setTourOpen(false)}
        onNavigate={setActiveView}
      />
      <ToastHost />
    </>
  );
}
