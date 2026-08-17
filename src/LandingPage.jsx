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
  
  const googleProvider = new GoogleAuthProvider();

  // Check username availability
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

  // Handle Email/Password Login
  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter your email and password.");
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;
      const userId = user.uid;
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          userId,
          email: user.email,
          verified: user.emailVerified,
          signupMethod: "email/password",
          role: "tier1",
          createdAt: serverTimestamp(),
          lastLoggedOn: null,
          lastLoggedOff: null,
        });
      }
      
      setLoginSuccess(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error) {
      setLoginError(error.message);
    }
  };

  // Handle Google Login
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        let parsedFirstName = "";
        let parsedLastName = "";
        if (user.displayName) {
          const parts = user.displayName.split(" ");
          parsedFirstName = parts[0];
          parsedLastName = parts.slice(1).join(" ");
        }
        await setDoc(userDocRef, {
          userId: user.uid,
          firstName: parsedFirstName,
          lastName: parsedLastName,
          email: user.email,
          username: "",
          verified: user.emailVerified,
          signupMethod: "google",
          role: "tier1",
          createdAt: serverTimestamp(),
          lastLoggedOn: null,
          lastLoggedOff: null,
        });
      }
      
      setLoginSuccess(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error) {
      setLoginError(error.message);
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
      
      setSignupSuccess(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error) {
      setSignupError(error.message);
    }
  };

  // Handle Google Signup
  const handleGoogleSignup = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      let parsedFirstName = "";
      let parsedLastName = "";
      if (user.displayName) {
        const parts = user.displayName.split(" ");
        parsedFirstName = parts[0];
        parsedLastName = parts.slice(1).join(" ");
      }
      
      const finalUsername = username || "";
      
      await setDoc(doc(db, "users", user.uid), {
        userId: user.uid,
        firstName: parsedFirstName,
        lastName: parsedLastName,
        username: finalUsername,
        email: user.email,
        verified: user.emailVerified,
        signupMethod: "google",
        role: "tier1",
        createdAt: serverTimestamp(),
        lastLoggedOn: null,
        lastLoggedOff: null,
      });
      
      if (finalUsername) {
        await setDoc(doc(db, "usernames", finalUsername.toLowerCase()), {
          userId: user.uid,
          username: finalUsername,
          email: user.email,
          createdAt: serverTimestamp(),
        });
      }
      
      setSignupSuccess(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (error) {
      setSignupError(error.message);
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

  if (activeView === "login") return renderLoginForm();
  if (activeView === "signup") return renderSignupForm();
  return (
    <MarketingLanding
      onHome={goHome}
      onLogin={goLogin}
      onSignup={goSignup}
    />
  );
}

