import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where, limit } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import FeedbackModal from "./components/FeedbackModal";
import WelcomePurchaseModal from "./components/WelcomePurchaseModal";
import { hasAssessmentEntitlement } from "./utils/pricing";
import { confirmAssessmentPurchase } from "./utils/stripeCheckout";
import { hasDemoSeededBackup, restoreDemoSeededClient, startDemoAsNewClient } from "./utils/demoClientSession";
import { needsMfaEnrollment } from "./utils/mfaAuth";
import { toast } from "./components/Toast";

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
  const [hasAssessmentAccess, setHasAssessmentAccess] = useState(null);
  const [showWelcomePurchase, setShowWelcomePurchase] = useState(false);
  const [welcomeStartAtPurchase, setWelcomeStartAtPurchase] = useState(false);
  const [hasSeededBackup, setHasSeededBackup] = useState(false);
  const [demoSessionBusy, setDemoSessionBusy] = useState(false);
  const [clientDataEpoch, setClientDataEpoch] = useState(0);
  const confirmingPurchase = useRef(false);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
        if (needsMfaEnrollment(user)) {
          toast("Add a phone number to finish signing in.");
          await signOut(auth);
          navigate("/login");
          return;
        }
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
            setHasSeededBackup(hasDemoSeededBackup(userData));
            // Default home screen:
            // - Admin view: Admin Dashboard
            // - Client view: Dashboard
            const shouldGoAdminHome =
              (user.email || "").toLowerCase() === "dannaolivo@gmail.com" ||
              userData.role === "admin";
            if (shouldGoAdminHome) {
              setHasAssessmentAccess(true);
              setShowWelcomePurchase(false);
              setActiveView(userData.hideAdminOnboarding !== true ? "adminOnboarding" : "adminDashboard");
            } else {
              const resultsSnap = await getDocs(
                query(
                  collection(db, "sectionResults"),
                  where("userId", "==", user.uid),
                  limit(1)
                )
              );
              const entitled = hasAssessmentEntitlement(userData, !resultsSnap.empty);
              const returningFromPurchase =
                typeof window !== "undefined" &&
                new URLSearchParams(window.location.search).get("purchase") === "success";
              setHasAssessmentAccess(entitled);
              if (returningFromPurchase) {
                setShowWelcomePurchase(false);
                if (entitled) setActiveView("assessmentUser");
              } else if (!entitled) {
                setWelcomeStartAtPurchase(false);
                setShowWelcomePurchase(true);
                setActiveView("dashboard");
              } else if (userData.hideOnboarding !== true && resultsSnap.empty) {
                setShowWelcomePurchase(false);
                setActiveView("onboarding");
              } else {
                setShowWelcomePurchase(false);
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
        setHasAssessmentAccess(null);
        setShowWelcomePurchase(false);
        setHasSeededBackup(false);
        setDemoSessionBusy(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const purchase = searchParams.get("purchase");
    const sessionId = searchParams.get("session_id");
    if (!purchase) return;
    if (purchase === "success" && !auth.currentUser) return;
    if (confirmingPurchase.current) return;

    const clearPurchaseParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("purchase");
      next.delete("session_id");
      setSearchParams(next, { replace: true });
    };

    const finish = async () => {
      if (purchase === "cancel") {
        setWelcomeStartAtPurchase(true);
        setShowWelcomePurchase(true);
        toast("Checkout was canceled. You can purchase when you're ready.");
        clearPurchaseParams();
        return;
      }

      if (purchase !== "success" || !sessionId || !auth.currentUser) return;

      confirmingPurchase.current = true;
      setShowWelcomePurchase(false);
      try {
        let purchased = false;
        for (let attempt = 0; attempt < 5 && !purchased; attempt += 1) {
          purchased = await confirmAssessmentPurchase(sessionId);
          if (!purchased) {
            await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
          }
        }
        if (purchased) {
          setHasAssessmentAccess(true);
          setShowWelcomePurchase(false);
          setActiveView("assessmentUser");
          toast("Purchase complete. You can begin the assessment.");
          clearPurchaseParams();
        } else {
          toast("We're still confirming your payment. Refresh in a moment if the assessment stays locked.");
        }
      } catch (error) {
        console.error("Error confirming purchase:", error);
        toast("We could not confirm the purchase yet. Refresh in a moment or contact support.");
      } finally {
        confirmingPurchase.current = false;
      }
    };

    finish();
  }, [searchParams, setSearchParams, userEmail]);

  const requestView = (view) => {
    const lockedViews = ["assessmentUser", "reports", "actionPlan"];
    if (hasAssessmentAccess === false && !isAdminMode && lockedViews.includes(view)) {
      setWelcomeStartAtPurchase(true);
      setActiveView(view);
      toast("This area is locked until you purchase the assessment.");
      return;
    }
    setActiveView(view);
  };

  const openPurchase = (atPurchase = true) => {
    setWelcomeStartAtPurchase(atPurchase);
    setShowWelcomePurchase(true);
  };

  const switchToClientPreview = () => {
    setViewModeOverride("client");
    setActiveView("dashboard");
  };

  const refreshAfterDemoSession = (userData) => {
    setHasSeededBackup(hasDemoSeededBackup(userData));
    setClientDataEpoch((value) => value + 1);
  };

  const handleStartAsNewClient = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || demoSessionBusy) return;
    const confirmed = window.confirm(
      "Start the Business Health Check from the beginning? Current answers will be cleared. Seeded demo results are saved and can be restored later."
    );
    if (!confirmed) return;

    setDemoSessionBusy(true);
    try {
      await startDemoAsNewClient(uid);
      const snap = await getDoc(doc(db, "users", uid));
      refreshAfterDemoSession(snap.exists() ? snap.data() : {});
      setViewModeOverride("client");
      setShowWelcomePurchase(false);
      setActiveView("onboarding");
      toast("Starting as a new client. Take the assessment from the beginning; your report will build as you finish sections.");
    } catch (error) {
      console.error("Error starting demo as new client:", error);
      toast("Could not reset the assessment. Try again or contact support.");
    } finally {
      setDemoSessionBusy(false);
    }
  };

  const handleRestoreSeededDemo = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || demoSessionBusy) return;
    const confirmed = window.confirm(
      "Restore the original seeded demo results? Answers from this new-client run will be replaced."
    );
    if (!confirmed) return;

    setDemoSessionBusy(true);
    try {
      await restoreDemoSeededClient(uid);
      const snap = await getDoc(doc(db, "users", uid));
      refreshAfterDemoSession(snap.exists() ? snap.data() : {});
      setViewModeOverride("client");
      setShowWelcomePurchase(false);
      setActiveView("dashboard");
      toast("Seeded demo results restored. Reports and action plan are ready to review.");
    } catch (error) {
      console.error("Error restoring seeded demo:", error);
      toast(error.message || "Could not restore the seeded demo results.");
    } finally {
      setDemoSessionBusy(false);
    }
  };

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
      <AssessmentUser
        setActiveView={requestView}
        hasAssessmentAccess={hasAssessmentAccess}
        onRequestPurchase={() => openPurchase(true)}
      />
    ) : activeView === "reports" ? (
      <Reports
        setActiveView={requestView}
        hasAssessmentAccess={hasAssessmentAccess}
        onRequestPurchase={() => openPurchase(true)}
      />
    ) : activeView === "actionPlan" ? (
      <ActionPlan
        setActiveView={requestView}
        hasAssessmentAccess={hasAssessmentAccess}
        onRequestPurchase={() => openPurchase(true)}
      />
    ) : activeView === "resources" ? (
      <Resources
        hasAssessmentAccess={hasAssessmentAccess}
        onRequestPurchase={() => openPurchase(true)}
      />
    ) : activeView === "bugReport" ? (
      <BugReportPage />
    ) : activeView === "onboarding" ? (
      <OnboardingPage
        setActiveView={requestView}
        firstName={firstName}
        lastName={lastName}
        hasAssessmentAccess={hasAssessmentAccess}
        onRequestPurchase={() => openPurchase(true)}
      />
    ) : (
      <Dashboard
        setActiveView={requestView}
        viewMode="client"
        hasAssessmentAccess={hasAssessmentAccess}
        onRequestPurchase={() => openPurchase(true)}
      />
    );

  if (effectiveViewMode === "client") {
    return (
      <>
        <ClientWorkspace
          activeView={activeView}
          setActiveView={requestView}
          firstName={firstName}
          lastName={lastName}
          onLogout={handleLogout}
          onFeedback={() => setFeedbackModalOpen(true)}
          canSwitchAdmin={canSwitchAdmin}
          hasAssessmentAccess={hasAssessmentAccess}
          demoSessionBusy={demoSessionBusy}
          refreshKey={clientDataEpoch}
          onStartAsNewClient={canSwitchAdmin ? handleStartAsNewClient : undefined}
          onRestoreSeededDemo={canSwitchAdmin && hasSeededBackup ? handleRestoreSeededDemo : undefined}
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
            <div key={`${clientDataEpoch}-${activeView}`}>{clientView}</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${clientDataEpoch}-${activeView}`}
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
        <WelcomePurchaseModal
          open={hasAssessmentAccess === false && showWelcomePurchase}
          firstName={firstName}
          startAtPurchase={welcomeStartAtPurchase}
          onClose={() => setShowWelcomePurchase(false)}
          onBrowseResources={() => {
            setShowWelcomePurchase(false);
            setActiveView("resources");
          }}
          onPurchased={() => {
            setHasAssessmentAccess(true);
            setShowWelcomePurchase(false);
            setActiveView("assessmentUser");
          }}
        />
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
        onSwitchClient={switchToClientPreview}
        onStartAsNewClient={handleStartAsNewClient}
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
