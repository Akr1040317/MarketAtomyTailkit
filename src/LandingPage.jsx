import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "./firebaseConfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import MarketingLanding from "./components/MarketingLanding";
import { LoginView, SignupView } from "./components/AuthPages";
import MfaSmsModal from "./components/MfaSmsModal";
import {
  formatAuthError,
  getMfaResolver,
  hasEnrolledMfa,
  isMfaExemptUser,
  isMfaRequiredError,
  sendVerificationIfNeeded,
  toE164,
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
  const [mfa, setMfa] = useState({ open: false, mode: "enroll", user: null, resolver: null, intent: "login", phone: "" });
  const [googleBusy, setGoogleBusy] = useState(false);
  const processedUid = useRef("");
  const googleProvider = new GoogleAuthProvider();
  
  const googleFromDisplayName = (user) => {
    const parts = (user.displayName || "").split(" ").filter(Boolean);
    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
    };
  };

  const closedMfa = () => ({
    open: false,
    mode: "enroll",
    user: null,
    resolver: null,
    intent: "login",
    phone: "",
  });

  const saveUserPhone = async (uid, phone) => {
    const e164 = toE164(phone);
    if (!uid || !e164) return;
    await setDoc(doc(db, "users", uid), { phone: e164 }, { merge: true });
  };

  const ensureUserDoc = async (user, extras = {}) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      if (extras.phone) await saveUserPhone(user.uid, extras.phone);
      return;
    }
    const names = googleFromDisplayName(user);
    await setDoc(userDocRef, {
      userId: user.uid,
      email: user.email,
      firstName: extras.firstName ?? names.firstName,
      lastName: extras.lastName ?? names.lastName,
      username: extras.username ?? "",
      phone: toE164(extras.phone) || "",
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
    setGoogleBusy(false);
    setTimeout(() => navigate("/dashboard"), 400);
  };

  const finishExistingSession = async (user, intent = "login") => {
    if (!user) return;
    if (processedUid.current === user.uid) {
      setGoogleBusy(false);
      return;
    }
    processedUid.current = user.uid;
    await ensureUserDoc(user, { signupMethod: "google" });
    if (intent === "signup") await offerOptionalMfa(user, "signup");
    else goToDashboard("login");
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!mfa.open) processedUid.current = "";
        return;
      }
      if (mfa.open || loginSuccess || signupSuccess) return;
      if (location.pathname !== "/login" && location.pathname !== "/signup") return;
      try {
        await finishExistingSession(
          user,
          location.pathname === "/signup" ? "signup" : "login"
        );
      } catch (error) {
        processedUid.current = "";
        const message = formatAuthError(error);
        if (location.pathname === "/signup") setSignupError(message);
        else setLoginError(message);
        setGoogleBusy(false);
      }
    });
    return unsub;
  }, [location.pathname, mfa.open, loginSuccess, signupSuccess]);

  const offerOptionalMfa = async (user, intent = "signup") => {
    if (isMfaExemptUser(user) || hasEnrolledMfa(user)) {
      goToDashboard(intent);
      return;
    }
    await sendVerificationIfNeeded(user);
    setMfa({ open: true, mode: "offer", user, resolver: null, intent, phone: "" });
  };

  const skipMfa = () => {
    const intent = mfa.intent || "signup";
    setMfa(closedMfa());
    goToDashboard(intent);
  };

  const continueAfterLogin = async (user, intent = "login") => {
    goToDashboard(intent);
  };

  const handleMfaRequired = (error, intent = "login") => {
    setMfa({
      open: true,
      mode: "challenge",
      user: null,
      resolver: getMfaResolver(error),
      intent,
      phone: "",
    });
  };

  const finishMfa = async (user, enrolledPhone) => {
    const intent = mfa.intent;
    const phone = toE164(enrolledPhone || mfa.phone);
    if (user?.uid) processedUid.current = user.uid;
    setMfa(closedMfa());
    try {
      await ensureUserDoc(user, {
        signupMethod: intent === "signup" ? "google" : "email/password",
        phone,
      });
      await saveUserPhone(user.uid, phone);
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
      processedUid.current = userCredential.user.uid;
      await ensureUserDoc(userCredential.user, { signupMethod: "email/password" });
      await continueAfterLogin(userCredential.user, "login");
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
    setGoogleBusy(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await finishExistingSession(result.user, "login");
    } catch (error) {
      setGoogleBusy(false);
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
      processedUid.current = user.uid;
      
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
      
      await offerOptionalMfa(user, "signup");
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
    if (!agreedToTerms) {
      setSignupError("Check the box above, then try Google sign-up again.");
      return;
    }
    setGoogleBusy(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (processedUid.current === user.uid) {
        setGoogleBusy(false);
        return;
      }
      processedUid.current = user.uid;
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
      
      await offerOptionalMfa(user, "signup");
      setGoogleBusy(false);
    } catch (error) {
      setGoogleBusy(false);
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
      googleBusy={googleBusy}
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
      googleBusy={googleBusy}
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
      initialPhone={mfa.phone}
      skippable={mfa.mode !== "challenge"}
      onComplete={finishMfa}
      onSkip={skipMfa}
      onCancel={() => {
        setMfa(closedMfa());
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

