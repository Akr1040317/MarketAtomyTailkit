import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "./firebaseConfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import MarketingLanding from "./components/MarketingLanding";
import { LoginView, SignupView } from "./components/AuthPages";
import MfaSmsModal from "./components/MfaSmsModal";
import {
  formatAuthError,
  getMfaResolver,
  isMfaRequiredError,
  needsMfaEnrollment,
  requireVerifiedEmail,
} from "./utils/mfaAuth";

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeView, setActiveView] = useState("landing"); // "landing", "login", "signup"
  
  // Set active view based on route
  useEffect(() => {
    if (location.pathname === "/login") {
      setActiveView("login");
    } else if (location.pathname === "/signup") {
      setActiveView("signup");
    } else {
      setActiveView("landing");
    }
  }, [location.pathname]);

  useEffect(() => {
    if (activeView !== "landing" || !location.hash) return;
    const id = location.hash.replace("#", "");
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeView, location.hash]);
  
  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  // Signup state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [mfa, setMfa] = useState({ open: false, mode: "enroll", user: null, resolver: null, intent: "login" });
  const googleProvider = new GoogleAuthProvider();
  
  const googleFromDisplayName = (user) => {
    const parts = (user.displayName || "").split(" ").filter(Boolean);
    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
    };
  };

  const ensureUserDoc = async (user, extras = {}) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) return;
    const names = googleFromDisplayName(user);
    await setDoc(userDocRef, {
      userId: user.uid,
      email: user.email,
      firstName: extras.firstName ?? names.firstName,
      lastName: extras.lastName ?? names.lastName,
      username: extras.username ?? "",
      verified: user.emailVerified,
      signupMethod: extras.signupMethod || "email/password",
      role: "tier1",
      createdAt: serverTimestamp(),
      lastLoggedOn: null,
      lastLoggedOff: null,
    });
  };

  const goToDashboard = (intent = "login") => {
    if (intent === "signup") setSignupSuccess(true);
    else setLoginSuccess(true);
    setTimeout(() => navigate("/dashboard"), 800);
  };

  const continueAfterFirstFactor = async (user, intent = "login") => {
    await requireVerifiedEmail(user);
    if (needsMfaEnrollment(user)) {
      setMfa({ open: true, mode: "enroll", user, resolver: null, intent });
      return;
    }
    goToDashboard(intent);
  };

  const handleMfaRequired = (error, intent = "login") => {
    setMfa({
      open: true,
      mode: "challenge",
      user: null,
      resolver: getMfaResolver(error),
      intent,
    });
  };

  const finishMfa = async (user) => {
    const intent = mfa.intent;
    setMfa({ open: false, mode: "enroll", user: null, resolver: null, intent: "login" });
    try {
      await ensureUserDoc(user, { signupMethod: intent === "signup" ? "google" : "email/password" });
      goToDashboard(intent);
    } catch (error) {
      if (intent === "signup") setSignupError(formatAuthError(error));
      else setLoginError(formatAuthError(error));
    }
  };

  // Handle Email/Password Login
  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter your email and password.");
      return;
    }
    setLoginError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      await ensureUserDoc(userCredential.user, { signupMethod: "email/password" });
      await continueAfterFirstFactor(userCredential.user, "login");
    } catch (error) {
      if (isMfaRequiredError(error)) {
        handleMfaRequired(error, "login");
        return;
      }
      setLoginError(formatAuthError(error));
    }
  };

  // Handle Google Login
  const handleGoogleLogin = async () => {
    setLoginError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserDoc(result.user, { signupMethod: "google" });
      await continueAfterFirstFactor(result.user, "login");
    } catch (error) {
      if (isMfaRequiredError(error)) {
        handleMfaRequired(error, "login");
        return;
      }
      setLoginError(formatAuthError(error));
    }
  };

  // Handle Email/Password Signup
  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError("");
    
    if (!firstName || !lastName || !username || !signupEmail || !signupPassword || !confirmPassword) {
      setSignupError("Please fill in all fields.");
      return;
    }
    
    if (!usernameAvailable) {
      setSignupError("Username is already taken.");
      return;
    }
    
    if (signupPassword !== confirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }

    if (!agreedToTerms) {
      setSignupError("Please confirm you agree before creating an account.");
      return;
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
      const user = userCredential.user;
      
      await setDoc(doc(db, "users", user.uid), {
        userId: user.uid,
        firstName,
        lastName,
        username,
        email: signupEmail,
        verified: user.emailVerified,
        signupMethod: "email/password",
        role: "tier1",
        createdAt: serverTimestamp(),
        lastLoggedOn: null,
        lastLoggedOff: null,
      });
      
      await setDoc(doc(db, "usernames", username.toLowerCase()), {
        userId: user.uid,
        username: username,
        email: user.email,
        createdAt: serverTimestamp(),
      });
      
      await continueAfterFirstFactor(user, "signup");
    } catch (error) {
      if (isMfaRequiredError(error)) {
        handleMfaRequired(error, "signup");
        return;
      }
      setSignupError(formatAuthError(error));
    }
  };

  // Handle Google Signup
  const handleGoogleSignup = async () => {
    setSignupError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const names = googleFromDisplayName(user);
      const finalUsername = username || "";
      
      await setDoc(doc(db, "users", user.uid), {
        userId: user.uid,
        firstName: names.firstName,
        lastName: names.lastName,
        username: finalUsername,
        email: user.email,
        verified: user.emailVerified,
        signupMethod: "google",
        role: "tier1",
        createdAt: serverTimestamp(),
        lastLoggedOn: null,
        lastLoggedOff: null,
      }, { merge: true });
      
      if (finalUsername) {
        await setDoc(doc(db, "usernames", finalUsername.toLowerCase()), {
          userId: user.uid,
          username: finalUsername,
          email: user.email,
          createdAt: serverTimestamp(),
        });
      }
      
      await continueAfterFirstFactor(user, "signup");
    } catch (error) {
      if (isMfaRequiredError(error)) {
        handleMfaRequired(error, "signup");
        return;
      }
      setSignupError(formatAuthError(error));
    }
  };

  const checkUsernameAvailability = async () => {
    if (!username) {
      setUsernameAvailable(false);
      return;
    }
    try {
      const docRef = doc(db, "usernames", username.toLowerCase());
      const docSnap = await getDoc(docRef);
      setUsernameAvailable(!docSnap.exists());
    } catch (error) {
      console.error("Error checking username:", error);
      setUsernameAvailable(false);
    }
  };

  const renderLoginForm = () => (
    <LoginView
      email={loginEmail}
      setEmail={setLoginEmail}
      password={loginPassword}
      setPassword={setLoginPassword}
      showPassword={showLoginPassword}
      setShowPassword={setShowLoginPassword}
      error={loginError}
      success={loginSuccess}
      onSubmit={handleLogin}
      onGoogle={handleGoogleLogin}
      onHome={goHome}
      onSignup={goSignup}
    />
  );

  const renderSignupForm = () => (
    <SignupView
      firstName={firstName}
      setFirstName={setFirstName}
      lastName={lastName}
      setLastName={setLastName}
      username={username}
      setUsername={setUsername}
      onUsernameBlur={checkUsernameAvailability}
      usernameAvailable={usernameAvailable}
      email={signupEmail}
      setEmail={setSignupEmail}
      password={signupPassword}
      setPassword={setSignupPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      showPassword={showSignupPassword}
      setShowPassword={setShowSignupPassword}
      showConfirmPassword={showConfirmPassword}
      setShowConfirmPassword={setShowConfirmPassword}
      agreedToTerms={agreedToTerms}
      setAgreedToTerms={setAgreedToTerms}
      error={signupError}
      success={signupSuccess}
      onSubmit={handleSignup}
      onGoogle={handleGoogleSignup}
      onHome={goHome}
      onLogin={goLogin}
    />
  );

  const goHome = (sectionId) => {
    setActiveView("landing");
    navigate(sectionId ? `/#${sectionId}` : "/");
  };
  const goLogin = () => { setActiveView("login"); navigate("/login"); };
  const goSignup = () => { setActiveView("signup"); navigate("/signup"); };

  // Render based on active view

  const mfaModal = (
    <MfaSmsModal
      open={mfa.open}
      mode={mfa.mode}
      user={mfa.user}
      resolver={mfa.resolver}
      onComplete={finishMfa}
      onCancel={() => {
        setMfa({ open: false, mode: "enroll", user: null, resolver: null, intent: "login" });
      }}
    />
  );

  if (activeView === "login") {
    return (
      <>
        {renderLoginForm()}
        {mfaModal}
      </>
    );
  }
  if (activeView === "signup") {
    return (
      <>
        {renderSignupForm()}
        {mfaModal}
      </>
    );
  }
  return (
    <>
      <MarketingLanding
        onHome={goHome}
        onLogin={goLogin}
        onSignup={goSignup}
      />
      {mfaModal}
    </>
  );
}

