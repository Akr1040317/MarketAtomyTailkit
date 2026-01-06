import { useState, useEffect } from "react";
import { auth, db } from "./firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import companyLogo from "./assets/companyLogo.png";
import { Menu, MenuButton, MenuItems, MenuItem, Transition } from "@headlessui/react";

// Import your separate view components
import Dashboard from "./Dashboard.jsx";
import Assessment from "./Assessment.jsx";
import AssessmentUser from "./AssessmentUser.jsx";

export default function DarkSidebarWithSideContentLeft() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  // activeView will be "dashboard", "assessment" (admin) or "assessmentUser" (non-admin)
  const [activeView, setActiveView] = useState("assessment");
  // State to hold the firstName from Firestore
  const [firstName, setFirstName] = useState("");
  // State to hold the user's role (admin, tier1, tier2, tier3, etc.)
  const [userRole, setUserRole] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setFirstName(userData.firstName || "");
            setUserRole(userData.role || "");
            // Update activeView based on role:
            if (userData.role !== "admin") {
              setActiveView("assessmentUser");
            } else {
              setActiveView("assessment");
            }
          }
        } catch (error) {
          console.error("Error fetching user data: ", error);
        }
      } else {
        setFirstName("");
      }
    });
    return () => unsubscribe();
  }, []);

  // Logout function with redirection to login page
  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      navigate("/login"); // Redirect to loginpage.jsx after logout
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      {/* Page Container */}
      <div
        id="page-container"
        className={`mx-auto flex min-h-dvh w-full min-w-80 flex-col bg-[#101b31] dark:text-gray-100 ${
          desktopSidebarOpen ? "lg:pl-72" : ""
        }`}
      >
        {/* Page Sidebar */}
        <nav
          id="page-sidebar"
          aria-label="Main Sidebar Navigation"
          className={`fixed top-0 bottom-0 left-0 z-50 flex h-full w-full flex-col border-r border-gray-800 bg-gray-800 text-gray-200 transition-transform duration-500 ease-out lg:w-72 ${
            desktopSidebarOpen ? "lg:translate-x-0" : "lg:-translate-x-full"
          } ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          {/* Sidebar Header */}
          <div className="flex h-16 w-full flex-none items-center justify-between bg-gray-600/25 px-4 lg:justify-center">
            {/* Brand */}
            <a
              href="#"
              className="group inline-flex items-center gap-2 text-lg font-bold tracking-wide text-gray-100 hover:text-gray-300"
            >
              <img
                src={companyLogo}
                alt="Company Logo"
                className="mx-auto hx-auto p-2 w-auto"
              />
            </a>
            {/* END Brand */}

            {/* Close Sidebar on Mobile */}
            <div className="lg:hidden">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm leading-5 font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-200 hover:shadow-xs focus:ring-3 focus:ring-gray-600/40 active:border-gray-700 active:shadow-none"
              >
                <svg
                  className="hi-mini hi-x-mark -mx-0.5 inline-block size-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            {/* END Close Sidebar on Mobile */}
          </div>
          {/* END Sidebar Header */}

          {/* Sidebar Navigation */}
          <div className="overflow-y-auto flex flex-col h-full">
            <div className="w-full p-4 flex-1">
              <nav className="space-y-2">
                {/* Dashboard Link */}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView("dashboard");
                  }}
                  className={`group flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-base font-medium transition-all ${
                    activeView === "dashboard"
                      ? "bg-gray-700/75 text-white shadow-md"
                      : "text-gray-200 hover:bg-gray-700/75 hover:text-white active:border-gray-600"
                  }`}
                >
                  <span className="flex flex-none items-center">
                    <svg
                      className="hi-outline hi-home inline-block size-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                      />
                    </svg>
                  </span>
                  <span className="grow">Dashboard</span>
                </a>

                {/* Assessment Link: Render different options based on user role */}
                {userRole === "admin" ? (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveView("assessment");
                    }}
                    className={`group flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-base font-medium transition-all ${
                      activeView === "assessment"
                        ? "bg-gray-700/75 text-white shadow-md"
                        : "text-gray-200 hover:bg-gray-700/75 hover:text-white active:border-gray-600"
                    }`}
                  >
                    <span className="flex flex-none items-center">
                      <svg
                        className="hi-outline inline-block size-6"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                    </span>
                    <span className="grow">Assessment Management</span>
                  </a>
                ) : (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveView("assessmentUser");
                    }}
                    className={`group flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-base font-medium transition-all ${
                      activeView === "assessmentUser"
                        ? "bg-gray-700/75 text-white shadow-md"
                        : "text-gray-200 hover:bg-gray-700/75 hover:text-white active:border-gray-600"
                    }`}
                  >
                    <span className="flex flex-none items-center">
                      <svg
                        className="hi-outline inline-block size-6"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                    </span>
                    <span className="grow">Assessment</span>
                  </a>
                )}

                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView("assessment");
                  }}
                  className={`group flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-base font-medium transition-all ${
                    activeView === "assessment"
                      ? "bg-gray-700/75 text-white shadow-md"
                      : "text-gray-200 hover:bg-gray-700/75 hover:text-white active:border-gray-600"
                  }`}
                >
                  <span className="flex flex-none items-center">
                    <svg
                      className="hi-outline inline-block size-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                      />
                    </svg>
                  </span>
                  <span className="grow">Analytics</span>
                </a>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveView("assessment");
                  }}
                  className={`group flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-base font-medium transition-all ${
                    activeView === "assessment"
                      ? "bg-gray-700/75 text-white shadow-md"
                      : "text-gray-200 hover:bg-gray-700/75 hover:text-white active:border-gray-600"
                  }`}
                >
                  <span className="flex flex-none items-center">
                    <svg
                      className="hi-outline inline-block size-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                      />
                    </svg>
                  </span>
                  <span className="grow">Resources</span>
                </a>
              </nav>
            </div>
            
            {/* Bottom Section with Feedback, Bug Report, and Logout */}
            <div className="w-full p-4 border-t border-gray-700 space-y-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  // Handle give feedback action
                  alert("Feedback feature coming soon!");
                }}
                className="w-full flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-base font-medium text-gray-200 hover:bg-gray-700/75 hover:text-white transition-all"
              >
                <span className="flex flex-none items-center">
                  <svg
                    className="hi-outline inline-block size-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                  </svg>
                </span>
                <span className="grow text-left">Give Feedback</span>
              </button>
              
              <button
                onClick={(e) => {
                  e.preventDefault();
                  // Handle report bug action
                  alert("Bug report feature coming soon!");
                }}
                className="w-full flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-base font-medium text-gray-200 hover:bg-gray-700/75 hover:text-white transition-all"
              >
                <span className="flex flex-none items-center">
                  <svg
                    className="hi-outline inline-block size-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                </span>
                <span className="grow text-left">Report a Bug</span>
              </button>
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-3 text-base font-semibold text-white transition-all shadow-md hover:shadow-lg"
              >
                <svg
                  className="hi-outline inline-block size-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                  />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
          {/* END Sidebar Navigation */}
        </nav>
        {/* END Page Sidebar */}

        {/* Page Header */}
        <header
          id="page-header"
          className={`fixed top-0 right-0 left-0 z-30 flex h-16 flex-none items-center bg-[#10172A] dark:bg-gray-800 ${
            desktopSidebarOpen ? "lg:pl-72" : ""
          }`}
          style={{ boxShadow: "0 10px 40px #162442" }}
        >
          <div className="mx-auto flex w-full max-w-10xl justify-between px-4 lg:px-8">
            {/* Left Section */}
            <div className="flex items-center gap-2">
              {/* Toggle Sidebar on Desktop */}
              <div className="hidden lg:block">
                <button
                  onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-xs focus:ring-3 focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
                >
                  <svg
                    className="hi-solid hi-menu-alt-1 inline-block size-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              {/* END Toggle Sidebar on Desktop */}

              {/* Toggle Sidebar on Mobile */}
              <div className="lg:hidden">
                <button
                  onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-xs focus:ring-3 focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
                >
                  <svg
                    className="hi-solid hi-menu-alt-1 inline-block size-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              {/* END Toggle Sidebar on Mobile */}

              <div className="lg:hidden">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-xs focus:ring-3 focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
                >
                  <svg
                    className="hi-solid hi-search inline-block size-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              {/* END Search */}
            </div>
            {/* END Left Section */}

            {/* Center Section (Large Screens) */}
            <div className="hidden lg:flex flex-1 justify-center">
              <span className="text-xl text-white font-semibold">
                {`Welcome to the BHC${userRole === "admin" ? " (Admin Portal)" : ""}`}
              </span>
            </div>
            {/* Right Section */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-xs focus:ring-3 focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
              >
                <svg
                  className="hi-outline hi-bell-alert inline-block size-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
              </a>
              {/* END Notifications */}

              {/* User Dropdown */}
              <Menu as="div" className="relative inline-block">
                <MenuButton className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-5 font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-xs focus:ring-3 focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700">
                  <svg
                    className="hi-mini hi-user-circle inline-block size-5 sm:hidden"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-5.5-2.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM10 12a5.99 5.99 0 00-4.793 2.39A6.483 6.483 0 0010 16.5a6.483 6.483 0 004.793-2.11A5.99 5.99 0 0010 12z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="hidden sm:inline">{firstName}</span>
                  <svg
                    className="hi-mini hi-chevron-down hidden size-5 opacity-40 sm:inline-block"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </MenuButton>
                <Transition
                  enter="transition ease-out duration-100"
                  enterFrom="opacity-0 scale-90"
                  enterTo="opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-90"
                >
                  <MenuItems
                    modal={false}
                    className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-lg shadow-xl focus:outline-hidden dark:shadow-gray-900"
                  >
                    <div className="divide-y divide-gray-100 rounded-lg bg-white ring-1 ring-black/5 dark:divide-gray-700 dark:bg-gray-800 dark:ring-gray-700">
                      {/* ... Dropdown menu items remain unchanged ... */}
                      <MenuItem>
                        {({ active }) => (
                          <a
                            href="#"
                            onClick={handleLogout}
                            className={`${
                              active ? "bg-gray-100 dark:bg-gray-700" : ""
                            } block px-4 py-2 text-sm text-gray-700 dark:text-gray-300`}
                          >
                            Log out
                          </a>
                        )}
                      </MenuItem>
                    </div>
                  </MenuItems>
                </Transition>
                {/* END Dropdown */}
              </Menu>
              {/* END User Dropdown */}
            </div>
            {/* END Right Section */}
          </div>
        </header>
        {/* END Page Header */}

        {/* Page Content */}
        <main
          id="page-content"
          className="flex max-w-full flex-auto flex-col pt-16 lg:flex-row"
        >
          {/* The active view now entirely manages its own side content */}
          <div className="mx-auto flex w-full max-w-10xl grow flex-col p-4 lg:p-8">
            {activeView === "dashboard" ? (
              <Dashboard />
            ) : activeView === "assessment" ? (
              <Assessment />
            ) : (
              <AssessmentUser />
            )}
          </div>
        </main>
        {/* END Page Content */}

        {/* Page Footer */}
        <footer id="page-footer" className="flex flex-none items-center bg-gray-800">
          <div className="mx-auto flex w-full max-w-10xl flex-col px-4 text-center text-sm md:flex-row md:justify-between md:text-left lg:px-8">
            <div className="pt-4 pb-1 md:pb-4">
              <a
                href="https://tailkit.com"
                target="_blank"
                className="font-medium text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                rel="noreferrer"
              >
                Tailkit
              </a>{" "}
              ©
            </div>
            <div className="inline-flex items-center justify-center pt-1 pb-4 md:pt-4">
              <span className="text-white">Developed by Akshat Rastogi </span>
              
            </div>
          </div>
        </footer>
        {/* END Page Footer */}
      </div>
      {/* END Page Container */}
    </>
  );
}
