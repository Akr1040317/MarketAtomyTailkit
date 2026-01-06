import { useState } from "react";
import { auth, db } from "./firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

import companyLogo from "./assets/MarketAtomy-HOR-300x92.png";
import googleLogo from "./assets/google.png";
import poweredBy from "./assets/poweredBy.png";

export default function SignUpBoxed() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);

  const navigate = useNavigate();
  const googleProvider = new GoogleAuthProvider();

  // Toggle password visibility for password field
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Toggle password visibility for confirm password field
  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Check if the username already exists in the "usernames" collection
  const checkUsernameAvailability = async () => {
    if (!username) {
      setUsernameAvailable(false);
      return;
    }
    try {
      const docRef = doc(db, "usernames", username.toLowerCase());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUsernameAvailable(false);
      } else {
        setUsernameAvailable(true);
      }
    } catch (error) {
      console.error("Error checking username:", error);
      // If error occurs, assume username is not available
      setUsernameAvailable(false);
    }
  };

  // Handle Email/Password Sign Up
  const handleSignUp = async (e) => {
    e.preventDefault();
    setShowAlert(false);
    setErrorMessage("");

    // Validate that all fields are filled
    if (
      !firstName ||
      !lastName ||
      !username ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      setErrorMessage("Please fill in all fields.");
      setShowAlert(true);
      return;
    }

    if (!usernameAvailable) {
      setErrorMessage("Username is already taken.");
      setShowAlert(true);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      setShowAlert(true);
      return;
    }

    try {
      // Create user using Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // Create a document for the user in the "users" collection
      await setDoc(doc(db, "users", user.uid), {
        userId: user.uid,
        firstName,
        lastName,
        username,
        email,
        verified: user.emailVerified,
        signupMethod: "email/password",
        role: "tier1",
        createdAt: serverTimestamp(),
        lastLoggedOn: null,
        lastLoggedOff: null,
      });

      // Add username to the "usernames" collection
      await setDoc(doc(db, "usernames", username.toLowerCase()), {
        userId: user.uid,
        username: username,
        email: user.email,
        createdAt: serverTimestamp(),
      });

      setShowSuccessAlert(true);
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      setErrorMessage(error.message);
      setShowAlert(true);
    }
  };

  // Handle Google Sign Up
  const handleGoogleSignUp = async (e) => {
    e.preventDefault();
    setShowAlert(false);
    setErrorMessage("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Split the display name (if available) into first and last names
      let parsedFirstName = "";
      let parsedLastName = "";
      if (user.displayName) {
        const parts = user.displayName.split(" ");
        parsedFirstName = parts[0];
        parsedLastName = parts.slice(1).join(" ");
      }

      // For Google sign up, do not require a username.
      // Use the value from the username field if provided; otherwise, keep it empty.
      const finalUsername = username ? username : "";

      // Create a document for the user in the "users" collection
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

      // Only add a username document if the username is provided
      if (finalUsername !== "") {
        await setDoc(doc(db, "usernames", finalUsername.toLowerCase()), {
          userId: user.uid,
          username: finalUsername,
          email: user.email,
          createdAt: serverTimestamp(),
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

  return (
    <>
      {/* Page Container */}
      <div
        id="page-container"
        className="mx-auto flex min-h-dvh w-full min-w-80 flex-col bg-gray-900 dark:bg-gray-900 dark:text-gray-100"
      >
        {/* Page Content */}
        <main id="page-content" className="flex max-w-full flex-auto flex-col">
          <div className="max-w-10xl relative mx-auto flex min-h-dvh w-full items-center justify-center overflow-hidden p-4 lg:p-8">
            {/* Sign Up Section */}
            <section className="w-full max-w-xl py-6">
              {/* Header */}
              <header className="mb-10 text-center">
                <img
                  src={companyLogo}
                  alt="Company Logo"
                  className="mx-auto h-35 w-auto"
                />
              </header>

              {/* Sign Up Form */}
              <div className="flex flex-col overflow-hidden rounded-lg bg-gray-800 shadow-xs dark:bg-gray-800 dark:text-gray-100">
                <div className="grow p-5 md:px-16 md:py-12">
                  <h2 className="dark:text-gray-40 py-3 text-center text-xl font-medium text-white">
                    Create an Account
                  </h2>
                  <form onSubmit={handleSignUp} className="space-y-5">
                    {/* First & Last Name */}
                    <div className="flex space-x-4">
                      <div className="w-1/2 space-y-1">
                        <label
                          htmlFor="firstName"
                          className="inline-block text-sm font-medium text-white"
                        >
                          First Name
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          placeholder="Enter your first name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="block w-full rounded-lg border border-gray-200 px-5 py-3 leading-6 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </div>
                      <div className="w-1/2 space-y-1">
                        <label
                          htmlFor="lastName"
                          className="inline-block text-sm font-medium text-white"
                        >
                          Last Name
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          placeholder="Enter your last name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="block w-full rounded-lg border border-gray-200 px-5 py-3 leading-6 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </div>
                    </div>

                    {/* Username */}
                    <div className="space-y-1">
                      <label
                        htmlFor="username"
                        className="inline-block text-sm font-medium text-white"
                      >
                        Username
                      </label>
                      <input
                        type="text"
                        id="username"
                        name="username"
                        placeholder="Choose a username (optional for Google sign up)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onBlur={checkUsernameAvailability}
                        className="block w-full rounded-lg border border-gray-200 px-5 py-3 leading-6 dark:border-gray-600 dark:bg-gray-800"
                      />
                      {username && !usernameAvailable && (
                        <p className="text-sm text-red-500">
                          Username is taken
                        </p>
                      )}
                      {username && usernameAvailable && (
                        <p className="text-sm text-green-500">
                          Username is available
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <label
                        htmlFor="email"
                        className="inline-block text-sm font-medium text-white"
                      >
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
                      <label
                        htmlFor="password"
                        className="inline-block text-sm font-medium text-white"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          id="password"
                          name="password"
                          placeholder="Choose a strong password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="block w-full rounded-lg border border-gray-200 px-5 py-3 leading-6 dark:border-gray-600 dark:bg-gray-800"
                        />
                        <span
                          className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3"
                          onClick={togglePasswordVisibility}
                        >
                          {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </span>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1">
                      <label
                        htmlFor="confirmPassword"
                        className="inline-block text-sm font-medium text-white"
                      >
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          id="confirmPassword"
                          name="confirmPassword"
                          placeholder="Confirm your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="block w-full rounded-lg border border-gray-200 px-5 py-3 leading-6 dark:border-gray-600 dark:bg-gray-800"
                        />
                        <span
                          className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3"
                          onClick={toggleConfirmPasswordVisibility}
                        >
                          {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </span>
                      </div>
                    </div>

                    {/* Alerts */}
                    {showAlert && (
                      <div className="text-sm text-red-500">{errorMessage}</div>
                    )}
                    {showSuccessAlert && (
                      <div className="text-sm text-green-500">
                        Account created! Redirecting...
                      </div>
                    )}

                    {/* Sign Up Button */}
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-600"
                    >
                      Create Account
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="my-4 flex items-center justify-center">
                    <span className="text-s text-gray-500 dark:text-gray-400">
                      or sign up with
                    </span>
                  </div>

                  {/* Google Sign Up Button */}
                  <button
                    onClick={handleGoogleSignUp}
                    className="flex w-full items-center justify-center rounded-lg bg-[#334155] py-3 text-white shadow-md hover:bg-[#475569]"
                  >
                    <img src={googleLogo} alt="Google" className="mr-2 h-5" />
                    Sign up with Google
                  </button>
                </div>

                {/* Footer */}
                <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  Already have an account?{" "}
                  <button
                    onClick={() => navigate("/signin")}
                    className="text-blue-600 dark:text-blue-400"
                  >
                    Sign In
                  </button>
                </div>
              </div>

              {/* Powered By */}
              <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <img src={poweredBy} alt="Powered By" className="mx-auto h-5" />
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
