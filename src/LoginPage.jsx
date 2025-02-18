import { useState } from "react";
import { auth, db } from "./firebaseConfig"; 
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

import googleLogo from "./assets/google.png";
import companyLogo from "./assets/companyLogo.png";
import poweredBy from "./assets/poweredBy.png";

export default function SignInBoxed() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  const navigate = useNavigate();
  const googleProvider = new GoogleAuthProvider();

  // --- Email/Password Sign In ---
  const handleSignIn = async () => {
    if (!email || !password) {
      setErrorMessage("Incorrect login. Please check your email/password.");
      setShowAlert(true);
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if user doc exists in Firestore
      const userId = user.uid;
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);

      // If no doc, create a basic one
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

      setShowSuccessAlert(true);
      setTimeout(() => {
        navigate("/dashboard"); 
      }, 2000);
    } catch (error) {
      setErrorMessage(error.message);
      setShowAlert(true);
    }
  };

  // --- Google Sign In ---
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user doc exists; if not, create it
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

      setShowSuccessAlert(true);
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      setErrorMessage(error.message);
      setShowAlert(true);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <>
      {/* Page Container */}
      <div id="page-container" className="mx-auto flex min-h-dvh w-full min-w-80 flex-col bg-gray-900 dark:bg-gray-900 dark:text-gray-100">
        {/* Page Content */}
        <main id="page-content" className="flex max-w-full flex-auto flex-col">
          <div className="relative mx-auto flex min-h-dvh w-full max-w-10xl items-center justify-center overflow-hidden p-4 lg:p-8">
            {/* Sign In Section */}
            <section className="w-full max-w-xl py-6">
              {/* Header */}
              <header className="mb-10 text-center">
                <img src={companyLogo} alt="Company Logo" className="mx-auto h-35 w-auto" />
              </header>

              {/* Sign In Form */}
              <div className="flex flex-col overflow-hidden rounded-lg bg-gray-800 shadow-xs dark:bg-gray-800 dark:text-gray-100">
                <div className="grow p-5 md:px-16 md:py-12">
                <h2 className="text-xl text-center font-medium text-white dark:text-gray-40 py-3">
                  Sign in to BHC
                </h2>
                  <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
                    {/* Email */}
                    
                    <div className="space-y-1">
                      <label htmlFor="email" className="inline-block text-sm text-white font-medium">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full rounded-lg border border-gray-200 px-5 py-3 leading-6 dark:border-gray-600 dark:bg-gray-800"
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-1">
                      <label htmlFor="password" className="inline-block text-white text-sm font-medium">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          name="password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="block w-full rounded-lg border border-gray-200 px-5 py-3 leading-6 dark:border-gray-600 dark:bg-gray-800"
                        />
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer" onClick={togglePasswordVisibility}>
                          {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </span>
                      </div>
                    </div>

                    {/* Alerts */}
                    {showAlert && <div className="text-red-500 text-sm">{errorMessage}</div>}
                    {showSuccessAlert && <div className="text-green-500 text-sm">Login successful! Redirecting...</div>}

                    {/* Sign In Button */}
                    <button onClick={handleSignIn} className="w-full rounded-lg bg-blue-700 px-6 py-3 text-white font-semibold hover:bg-blue-600">
                      Sign In
                    </button>

                    {/* Or sign in with */}
                    <div className="flex items-center justify-center">
                      <span className="text-s text-gray-500 dark:text-gray-400">or sign in with</span>
                    </div>

                    {/* Google Button */}
                    <button
                      onClick={handleGoogleSignIn}
                      className="flex items-center justify-center w-full bg-[#334155] text-white rounded-lg py-3 shadow-md  hover:bg-[#475569]"
                    >
                      <img src={googleLogo} alt="Google" className="h-5 mr-2" />
                      Sign in with Google
                    </button>

                  </form>
                </div>

                {/* Footer */}
                <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  Don’t have an account?{" "}
                  <button onClick={() => navigate("/signup")} className="text-blue-600 dark:text-blue-400">Sign up</button>
                </div>

                
              </div>
              
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
