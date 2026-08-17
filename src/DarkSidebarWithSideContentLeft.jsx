import { useState, useEffect } from "react";
import { auth, db } from "./firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import FeedbackModal from "./components/FeedbackModal";

// Import your separate view components
import Dashboard from "./Dashboard.jsx";
import AssessmentUser from "./AssessmentUser.jsx";
import Reports from "./Reports.jsx";
import Resources from "./Resources.jsx";
import ActionPlan from "./ActionPlan.jsx";
import ClientWorkspace from "./components/ClientWorkspace.jsx";
import AdminWorkspace from "./components/AdminWorkspace.jsx";
import BugReportPage from "./components/BugReportPage.jsx";
import OnboardingPage from "./components/OnboardingPage.jsx";
import AdminOverview from "./components/AdminDashboard/AdminOverview.jsx";
import UserManagement from "./components/AdminDashboard/UserManagement.jsx";
import AnalyticsDashboard from "./components/AdminDashboard/AnalyticsDashboard.jsx";
import ContentManagement from "./components/AdminDashboard/ContentManagement.jsx";
import SystemMonitoring from "./components/AdminDashboard/SystemMonitoring.jsx";
import AssessmentManagement from "./components/AdminDashboard/AssessmentManagement.jsx";
import AdminOnboarding from "./components/AdminDashboard/AdminOnboarding.jsx";
import AdminFeedbackPage from "./components/AdminDashboard/AdminFeedbackPage.jsx";

export default function DarkSidebarWithSideContentLeft() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  // activeView will be "dashboard", "assessment" (admin) or "assessmentUser" (non-admin)
  const [activeView, setActiveView] = useState("dashboard");
  // State to hold the firstName from Firestore
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // State to hold the user's role (admin, tier1, tier2, tier3, etc.)
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [viewModeOverride, setViewModeOverride] = useState(null); // "admin" | "client" | null
  // Modal states
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [bugReportModalOpen, setBugReportModalOpen] = useState(false);

  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const isDanna = (userEmail || "").toLowerCase() === "dannaolivo@gmail.com";
  const canSwitchAdmin = userRole === "admin" || isDanna;
  const effectiveViewMode =
    viewModeOverride || (userRole === "admin" ? "admin" : "client");
  const effectiveUserRole = effectiveViewMode === "admin" ? "admin" : "tier1";
  const isAdminMode = effectiveViewMode === "admin" && (isDanna || userRole === "admin");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email || "");
        // Default Danna into Admin view for presentations.
        if ((user.email || "").toLowerCase() === "dannaolivo@gmail.com") {
          setViewModeOverride("admin");
          setActiveView("adminDashboard");
        }
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setFirstName(userData.firstName || "");
            setLastName(userData.lastName || "");
            setUserRole(userData.role || "");
            // Default home screen:
            // - Admin view: Admin Dashboard
            // - Client view: Dashboard
            const shouldGoAdminHome =
              (user.email || "").toLowerCase() === "dannaolivo@gmail.com" ||
              userData.role === "admin";
            if (shouldGoAdminHome) {
              setActiveView(userData.hideAdminOnboarding !== true ? "adminOnboarding" : "adminDashboard");
            } else {
              const resultsSnap = await getDocs(
                query(
                  collection(db, "sectionResults"),
                  where("userId", "==", user.uid),
                  limit(1)
                )
              );
              if (userData.hideOnboarding !== true && resultsSnap.empty) {
                setActiveView("onboarding");
              } else {
                setActiveView("dashboard");
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user data: ", error);
        }
      } else {
        setFirstName("");
        setLastName("");
        setUserRole("");
        setUserEmail("");
        setViewModeOverride(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Logout function with redirection to login page
  const handleLogout = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      await signOut(auth);
      navigate("/login"); // Redirect to loginpage.jsx after logout
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const clientView =
    activeView === "assessmentUser" ? (
      <AssessmentUser setActiveView={setActiveView} />
    ) : activeView === "reports" ? (
      <Reports setActiveView={setActiveView} />
    ) : activeView === "actionPlan" ? (
      <ActionPlan setActiveView={setActiveView} />
    ) : activeView === "resources" ? (
      <Resources />
    ) : activeView === "bugReport" ? (
      <BugReportPage />
    ) : activeView === "onboarding" ? (
      <OnboardingPage setActiveView={setActiveView} firstName={firstName} lastName={lastName} />
    ) : (
      <Dashboard setActiveView={setActiveView} viewMode="client" />
    );

  if (effectiveViewMode === "client") {
    return (
      <>
        <ClientWorkspace
          activeView={activeView}
          setActiveView={setActiveView}
          firstName={firstName}
          lastName={lastName}
          onLogout={handleLogout}
          onFeedback={() => setFeedbackModalOpen(true)}
          canSwitchAdmin={canSwitchAdmin}
          onSwitchAdmin={
            canSwitchAdmin
              ? () => {
                  setViewModeOverride("admin");
                  setActiveView("adminDashboard");
                }
              : undefined
          }
        >
          {reduceMotion ? (
            clientView
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                {clientView}
              </motion.div>
            </AnimatePresence>
          )}
        </ClientWorkspace>
        <FeedbackModal isOpen={feedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} />
      </>
    );
  }

  const adminView =
    activeView === "adminUsers" ? (
      <UserManagement />
    ) : activeView === "adminAnalytics" ? (
      <AnalyticsDashboard />
    ) : activeView === "adminContent" ? (
      <ContentManagement />
    ) : activeView === "adminMonitoring" ? (
      <SystemMonitoring />
    ) : activeView === "assessment" ? (
      <AssessmentManagement />
    ) : activeView === "adminFeedback" ? (
      <AdminFeedbackPage />
    ) : activeView === "adminBugReport" ? (
      <BugReportPage />
    ) : activeView === "adminOnboarding" ? (
      <AdminOnboarding setActiveView={setActiveView} />
    ) : (
      <AdminOverview setActiveView={setActiveView} />
    );

  return (
    <>
      <AdminWorkspace
        activeView={activeView}
        setActiveView={setActiveView}
        firstName={firstName}
        lastName={lastName}
        onLogout={handleLogout}
        onSwitchClient={() => {
          setViewModeOverride("client");
          setActiveView("dashboard");
        }}
      >
        {reduceMotion ? (
          adminView
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              {adminView}
            </motion.div>
          </AnimatePresence>
        )}
      </AdminWorkspace>
      <FeedbackModal isOpen={feedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} />
    </>
  );
}
