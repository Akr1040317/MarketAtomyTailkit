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
import { FaEye, FaEyeSlash } from "react-icons/fa";
import companyLogo from "./assets/MarketAtomy-HOR-300x92.png";
import googleLogo from "./assets/google.png";

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

  // Render Login Form
  const renderLoginForm = () => (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center cursor-pointer" onClick={() => { setActiveView("landing"); navigate("/"); }}>
              <img src={companyLogo} alt="MarketAtomy Logo" className="h-10 w-auto" />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" onClick={(e) => { e.preventDefault(); setActiveView("landing"); navigate("/#features"); }} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Features
              </a>
              <a href="#assessment" onClick={(e) => { e.preventDefault(); setActiveView("landing"); navigate("/#assessment"); }} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Assessment
              </a>
              <a href="#about" onClick={(e) => { e.preventDefault(); setActiveView("landing"); navigate("/#about"); }} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                About
              </a>
              <button onClick={() => { setActiveView("landing"); navigate("/"); }} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Home
              </button>
              <button onClick={() => { setActiveView("signup"); navigate("/signup"); }} className="bg-gradient-to-r from-orange-600 to-yellow-500 hover:from-orange-700 hover:to-yellow-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-xl">
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Login Section */}
      <section className="relative py-24 px-6 lg:px-8 min-h-[calc(100vh-80px)] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-cyan-900/20 to-orange-900/20"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-md mx-auto w-full">
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 shadow-2xl">
            <div className="flex justify-center mb-6">
              <img src={companyLogo} alt="MarketAtomy Logo" className="h-12 w-auto" />
            </div>
            <h2 className="text-3xl font-bold mb-2 text-center">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Sign In
              </span>
            </h2>
            <p className="text-gray-400 text-center mb-8">Sign in to your Business Health Check account</p>
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1">
                <label htmlFor="loginEmail" className="text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  id="loginEmail"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              
              <div className="space-y-1">
                <label htmlFor="loginPassword" className="text-sm font-medium text-gray-300">Password</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    id="loginPassword"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-3 pr-10 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showLoginPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              
              {loginError && <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">{loginError}</div>}
              {loginSuccess && <div className="text-green-400 text-sm bg-green-900/20 border border-green-500/30 rounded-lg p-3">Login successful! Redirecting...</div>}
              
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                Sign In
              </button>
            </form>
            
            <div className="my-6 flex items-center">
              <div className="flex-1 border-t border-gray-700"></div>
              <span className="px-4 text-sm text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-700"></div>
            </div>
            
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center bg-gray-800/50 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium border border-gray-700 hover:border-gray-600 transition-all"
            >
              <img src={googleLogo} alt="Google" className="h-5 mr-2" />
              Sign in with Google
            </button>
            
            <div className="mt-6 text-center text-sm text-gray-400">
              Don't have an account?{" "}
              <button onClick={() => { setActiveView("signup"); navigate("/signup"); }} className="text-cyan-400 hover:text-cyan-300 font-semibold">
                Sign up
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800/50 py-12 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <img src={companyLogo} alt="MarketAtomy Logo" className="h-8 w-auto mb-4 opacity-80" />
              <p className="text-gray-500 text-sm">
                Empowering entrepreneurs with tools and knowledge to build businesses on rock-solid foundations.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => { setActiveView("landing"); navigate("/"); }} className="text-gray-500 hover:text-white transition-colors text-sm">
                    Home
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveView("signup"); navigate("/signup"); }} className="text-gray-500 hover:text-white transition-colors text-sm">
                    Sign Up
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">About MarketAtomy</h3>
              <ul className="space-y-2">
                <li>
                  <a href="https://www.marketatomy.com/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors text-sm">
                    Visit Website
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} MarketAtomy LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );

  // Render Signup Form
  const renderSignupForm = () => (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center cursor-pointer" onClick={() => { setActiveView("landing"); navigate("/"); }}>
              <img src={companyLogo} alt="MarketAtomy Logo" className="h-10 w-auto" />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" onClick={(e) => { e.preventDefault(); setActiveView("landing"); navigate("/#features"); }} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Features
              </a>
              <a href="#assessment" onClick={(e) => { e.preventDefault(); setActiveView("landing"); navigate("/#assessment"); }} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Assessment
              </a>
              <a href="#about" onClick={(e) => { e.preventDefault(); setActiveView("landing"); navigate("/#about"); }} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                About
              </a>
              <button onClick={() => { setActiveView("landing"); navigate("/"); }} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Home
              </button>
              <button onClick={() => { setActiveView("login"); navigate("/login"); }} className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Login
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Signup Section */}
      <section className="relative py-12 px-6 lg:px-8 min-h-[calc(100vh-80px)] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-cyan-900/20 to-orange-900/20"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-2xl mx-auto w-full">
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 shadow-2xl">
            <div className="flex justify-center mb-6">
              <img src={companyLogo} alt="MarketAtomy Logo" className="h-12 w-auto" />
            </div>
            <h2 className="text-3xl font-bold mb-2 text-center">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Create an Account
              </span>
            </h2>
            <p className="text-gray-400 text-center mb-8">Start your Business Health Check assessment today</p>
            
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="firstName" className="text-sm font-medium text-gray-300">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    className="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="lastName" className="text-sm font-medium text-gray-300">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    className="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label htmlFor="username" className="text-sm font-medium text-gray-300">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={checkUsernameAvailability}
                  placeholder="Choose a username"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
                {username && !usernameAvailable && <p className="text-sm text-red-400">Username is taken</p>}
                {username && usernameAvailable && <p className="text-sm text-green-400">Username is available</p>}
              </div>
              
              <div className="space-y-1">
                <label htmlFor="signupEmail" className="text-sm font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  id="signupEmail"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="signupPassword" className="text-sm font-medium text-gray-300">Password</label>
                  <div className="relative">
                    <input
                      type={showSignupPassword ? "text" : "password"}
                      id="signupPassword"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Choose a password"
                      className="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-3 pr-10 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showSignupPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-300">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-3 pr-10 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
              </div>
              
              {signupError && <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">{signupError}</div>}
              {signupSuccess && <div className="text-green-400 text-sm bg-green-900/20 border border-green-500/30 rounded-lg p-3">Account created! Redirecting...</div>}
              
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                Create Account
              </button>
            </form>
            
            <div className="my-6 flex items-center">
              <div className="flex-1 border-t border-gray-700"></div>
              <span className="px-4 text-sm text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-700"></div>
            </div>
            
            <button
              onClick={handleGoogleSignup}
              className="w-full flex items-center justify-center bg-gray-800/50 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium border border-gray-700 hover:border-gray-600 transition-all"
            >
              <img src={googleLogo} alt="Google" className="h-5 mr-2" />
              Sign up with Google
            </button>
            
            <div className="mt-6 text-center text-sm text-gray-400">
              Already have an account?{" "}
              <button onClick={() => { setActiveView("login"); navigate("/login"); }} className="text-cyan-400 hover:text-cyan-300 font-semibold">
                Sign in
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800/50 py-12 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <img src={companyLogo} alt="MarketAtomy Logo" className="h-8 w-auto mb-4 opacity-80" />
              <p className="text-gray-500 text-sm">
                Empowering entrepreneurs with tools and knowledge to build businesses on rock-solid foundations.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => setActiveView("landing")} className="text-gray-500 hover:text-white transition-colors text-sm">
                    Home
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveView("login")} className="text-gray-500 hover:text-white transition-colors text-sm">
                    Login
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">About MarketAtomy</h3>
              <ul className="space-y-2">
                <li>
                  <a href="https://www.marketatomy.com/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors text-sm">
                    Visit Website
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} MarketAtomy LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );

  // Render Landing Page
  const renderLandingPage = () => (
    <div className="min-h-screen bg-gray-900 text-gray-100 overflow-hidden">
      {/* Navigation Bar */}
      <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center">
              <img src={companyLogo} alt="MarketAtomy Logo" className="h-10 w-auto" />
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Features
              </a>
              <a href="#assessment" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                Assessment
              </a>
              <a href="#about" className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                About
              </a>
              <button
                onClick={() => { setActiveView("login"); navigate("/login"); }}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Login
              </button>
              <button
                onClick={() => { setActiveView("signup"); navigate("/signup"); }}
                className="bg-gradient-to-r from-orange-600 to-yellow-500 hover:from-orange-700 hover:to-yellow-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                Get Started
              </button>
            </div>
            <div className="md:hidden">
              <button
                onClick={() => setActiveView("login")}
                className="text-gray-300 hover:text-white px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors text-sm"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-cyan-900/20 to-orange-900/20"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center pt-16">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 mb-6">
                <span className="text-sm font-medium bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  Preventative Measures = Healthy Growth Results
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-orange-400 bg-clip-text text-transparent">
                  Business Health Check
                </span>
                <br />
                <span className="text-white">Assessment</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 mb-4 leading-relaxed">
                Evaluate your business across 20 critical performance areas. Identify gaps and opportunities for sustainable growth.
              </p>
              <p className="text-lg text-gray-400 mb-8">
                For just <span className="text-white font-bold text-2xl">$297</span>, discover where the gaps are that could interfere in the growth of your company.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-4">
                <button
                  onClick={() => { setActiveView("signup"); navigate("/signup"); }}
                  className="bg-gradient-to-r from-orange-600 to-yellow-500 hover:from-orange-700 hover:to-yellow-600 text-white px-10 py-4 rounded-lg text-lg font-bold transition-all shadow-xl hover:shadow-2xl hover:scale-105"
                >
                  Start Assessment - $297
                </button>
                <button
                  onClick={() => { setActiveView("login"); navigate("/login"); }}
                  className="bg-gray-800/50 hover:bg-gray-800 text-white px-10 py-4 rounded-lg text-lg font-semibold border border-gray-700 hover:border-gray-600 transition-all backdrop-blur-sm"
                >
                  Sign In
                </button>
              </div>
              <p className="text-sm text-gray-500">
                Privacy Policy: We value your email privacy and never send SPAM.
              </p>
            </div>

            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-3xl blur-3xl"></div>
                <div className="relative bg-gray-800/60 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Foundational Structure", score: 85, color: "from-blue-500 to-blue-600" },
                      { label: "Financial Strength", score: 72, color: "from-emerald-500 to-emerald-600" },
                      { label: "Sales & Marketing", score: 68, color: "from-cyan-500 to-cyan-600" },
                      { label: "Product Viability", score: 90, color: "from-orange-500 to-orange-600" },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-gray-900/60 rounded-xl p-4 border border-gray-700/50 backdrop-blur-sm">
                        <div className="text-sm text-gray-400 mb-2">{item.label}</div>
                        <div className="text-2xl font-bold text-white mb-2">{item.score}%</div>
                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`bg-gradient-to-r ${item.color} h-2 rounded-full transition-all`}
                            style={{ width: `${item.score}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Statistics */}
      <section className="py-16 px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-cyan-900/10 to-orange-900/10"></div>
        <div className="relative max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-600/10 to-blue-800/10 border border-blue-500/20 backdrop-blur-sm">
              <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent mb-2">400,000+</div>
              <div className="text-gray-400">New businesses start annually</div>
            </div>
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-orange-600/10 to-yellow-600/10 border border-orange-500/20 backdrop-blur-sm">
              <div className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent mb-2">70%</div>
              <div className="text-gray-400">Fail within 24 months</div>
            </div>
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-cyan-600/10 to-cyan-800/10 border border-cyan-500/20 backdrop-blur-sm">
              <div className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent mb-2">20</div>
              <div className="text-gray-400">Critical areas evaluated</div>
            </div>
          </div>
          <p className="text-center text-gray-300 mt-8 text-lg">
            Common reasons for failure: <span className="text-white font-semibold">poor management, undercapitalization, incorrect pricing structures</span>
          </p>
        </div>
      </section>

      {/* Features Section - The 5 Business Health Systems */}
      <section id="features" className="py-24 px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-900/5 to-transparent"></div>
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-orange-400 bg-clip-text text-transparent">
                The 5 Business Health Systems
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Comprehensive evaluation across five critical interdependent systems
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              {
                title: "Foundational Structure",
                areas: ["Business Preparation", "Executive Management", "Business Structure", "Business Milestones"],
                gradient: "from-amber-500/20 to-orange-500/20",
                border: "border-amber-500/30",
                icon: "🏗️"
              },
              {
                title: "Financial Position",
                areas: ["Pricing Models", "Cost Analysis", "Financial Management", "Funding"],
                gradient: "from-emerald-500/20 to-green-500/20",
                border: "border-emerald-500/30",
                icon: "💰"
              },
              {
                title: "Product/Service Offering",
                areas: ["Market Dynamics", "Product Development", "Service Delivery", "Intellectual Property"],
                gradient: "from-blue-500/20 to-cyan-500/20",
                border: "border-blue-500/30",
                icon: "🎯"
              },
              {
                title: "Marketing/Sales",
                areas: ["Market Dynamics", "Customer Identification", "Brand Strategy", "Scalability"],
                gradient: "from-cyan-500/20 to-blue-500/20",
                border: "border-cyan-500/30",
                icon: "📈"
              },
              {
                title: "Overall Health",
                areas: ["General Business Health", "Personal Assessment"],
                gradient: "from-orange-500/20 to-yellow-500/20",
                border: "border-orange-500/30",
                icon: "💊"
              },
            ].map((system, idx) => (
              <div
                key={idx}
                className={`bg-gradient-to-br ${system.gradient} rounded-xl p-6 border ${system.border} hover:scale-105 transition-all backdrop-blur-sm`}
              >
                <div className="text-3xl mb-3">{system.icon}</div>
                <div className="text-xl font-bold text-white mb-4">{system.title}</div>
                <ul className="space-y-2">
                  {system.areas.map((area, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-center">
                      <span className={`w-1.5 h-1.5 rounded-full mr-3 bg-gradient-to-r ${system.gradient.replace('/20', '')}`}></span>
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm">
            <h3 className="text-3xl font-bold mb-6 text-center">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                What You'll Receive
              </span>
            </h3>
            <div className="grid md:grid-cols-2 gap-8 mt-6">
              <div>
                <ul className="space-y-4">
                  {[
                    "Comprehensive PDF Report",
                    "Category Score Breakdowns",
                    "Health Level Indicators",
                    "Priority Action Items"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center text-gray-300">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mr-4 flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-lg">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <ul className="space-y-4">
                  {[
                    "Recommended Resources",
                    "Growth Roadmap",
                    "Progress Tracking",
                    "Actionable Recommendations"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center text-gray-300">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center mr-4 flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-lg">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Take Assessment */}
      <section id="assessment" className="py-24 px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-cyan-900/10 to-orange-900/10"></div>
        <div className="relative max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black mb-12 text-center">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-orange-400 bg-clip-text text-transparent">
              Why Take The Assessment?
            </span>
          </h2>
          <div className="space-y-6 text-gray-300 leading-relaxed">
            <p className="text-lg">
              MarketAtomy's Business Health Check is a comprehensive evaluation of the crucial elements of your business and where it is today. It provides questions to help you see your business from the perspective of an external expert.
            </p>
            <p className="text-lg">
              It explores key performance indicators as they relate to each other in the growth process. The outcome defines your business strength while pointing out ways to improve.
            </p>
            <div className="bg-gradient-to-r from-orange-600/20 via-yellow-600/20 to-cyan-600/20 border-l-4 border-orange-500 p-8 rounded-r-xl mt-8 backdrop-blur-sm">
              <p className="text-xl font-bold text-white mb-3">
                If you don't know what you don't know…how will you know what to focus on fixing?
              </p>
              <p className="text-gray-300">
                No matter what industry or stage of business you're in, this assessment evaluates 20 critical interdependent areas that could result in high costs and business failure.
              </p>
            </div>
            <p className="text-lg mt-6">
              Upon completion, you'll receive a summary report highlighting the <span className="text-white font-semibold">5 functional components</span>: operations, financial strength, product/service viability, marketing/sales, and overall health.
            </p>
          </div>
        </div>
      </section>

      {/* About MarketAtomy */}
      <section id="about" className="py-24 px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/5 to-transparent"></div>
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Designed by MarketAtomy
              </span>
            </h2>
            <p className="text-xl text-gray-400">
              Empowering small and medium business owners with tools and knowledge
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6 text-gray-300 leading-relaxed">
              <p className="text-lg">
                MarketAtomy is a business growth consulting firm specializing in empowering small and medium business owners with the tools and knowledge needed to build businesses on rock-solid foundations.
              </p>
              <p className="text-lg">
                Most owners are so focused on satisfying immediate needs that they forget to plan for the future. When you only work <span className="text-white font-semibold">"in"</span> the business without working <span className="text-white font-semibold">"on"</span> the business, failure is imminent.
              </p>
              <p className="text-lg">
                We focus on sequencing strategy—helping you identify alternative routes designed to avoid roadblocks and get to revenue faster than traditional strategic planning.
              </p>
            </div>
            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 backdrop-blur-sm">
              <h3 className="text-2xl font-bold text-white mb-6">MarketAtomy's Mission</h3>
              <p className="text-gray-300 mb-4 leading-relaxed font-semibold text-lg">
                "Focus on the DREAM...Trust the PROCESS!"
              </p>
              <p className="text-gray-400 leading-relaxed mb-6">
                MarketAtomy's mission is to prepare small business owners for success through cognitive awareness, focused education, and strategic collaboration.
              </p>
              <div className="space-y-3">
                {[
                  "Business Growth Consulting",
                  "Strategic Planning & Sequencing",
                  "Business Health Check Assessment",
                  "Training & Educational Resources"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <a
                  href="https://www.marketatomy.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-400 hover:text-blue-300 font-semibold"
                >
                  Learn More About MarketAtomy
                  <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-cyan-900/20 to-orange-900/20"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-4">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-orange-400 bg-clip-text text-transparent">
              Ready to Assess Your Business Health?
            </span>
          </h2>
          <p className="text-xl text-gray-300 mb-2">
            Preventative Measures = Healthy Growth Results
          </p>
          <p className="text-lg text-gray-400 mb-8">
            For just <span className="text-white font-bold text-2xl">$297</span>, find out where the gaps are that could interfere in the growth of your company.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => { setActiveView("signup"); navigate("/signup"); }}
              className="bg-gradient-to-r from-orange-600 to-yellow-500 hover:from-orange-700 hover:to-yellow-600 text-white px-10 py-4 rounded-lg text-lg font-bold transition-all shadow-xl hover:shadow-2xl hover:scale-105"
            >
              Start Assessment - $297
            </button>
            <button
              onClick={() => { setActiveView("login"); navigate("/login"); }}
              className="bg-gray-800/50 hover:bg-gray-800 text-white px-10 py-4 rounded-lg text-lg font-semibold border border-gray-700 hover:border-gray-600 transition-all backdrop-blur-sm"
            >
              Sign In to Continue
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Privacy Policy: We value your email privacy and never send SPAM.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800/50 py-12 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <img src={companyLogo} alt="MarketAtomy Logo" className="h-8 w-auto mb-4 opacity-80" />
              <p className="text-gray-500 text-sm">
                Empowering entrepreneurs with tools and knowledge to build businesses on rock-solid foundations.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => { setActiveView("login"); navigate("/login"); }} className="text-gray-500 hover:text-white transition-colors text-sm">
                    Login
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveView("signup"); navigate("/signup"); }} className="text-gray-500 hover:text-white transition-colors text-sm">
                    Sign Up
                  </button>
                </li>
                <li>
                  <a href="#features" className="text-gray-500 hover:text-white transition-colors text-sm">
                    Features
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">About MarketAtomy</h3>
              <ul className="space-y-2">
                <li>
                  <a href="https://www.marketatomy.com/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors text-sm">
                    Visit Website
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} MarketAtomy LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );

  // Render based on active view
  if (activeView === "login") return renderLoginForm();
  if (activeView === "signup") return renderSignupForm();
  return renderLandingPage();
}
