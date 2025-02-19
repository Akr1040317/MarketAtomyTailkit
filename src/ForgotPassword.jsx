import React, { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "./firebaseConfig";
import { sendPasswordResetEmail } from "firebase/auth";

import logo from "../assets/welcome-to.svg";
import "../pages/SignUp.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(""); 
  const [error, setError] = useState(""); 

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent. Please check your inbox.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="entire-page">
      <div className="center">
        <img src={logo} alt="Logo" />
      </div>

      <div className="center title">
        <h1 className="pink">NEXT-GEN&nbsp;</h1>
        <h1 className="blue">WELLNESS</h1>
      </div>

      <div className="center">
        <button className="sign switch" type="button">
          FORGOT PASSWORD
        </button>
        <Link to="/login">
          <button className="log switch" type="button" id="login">
            LOG IN
          </button>
        </Link>
      </div>

      <div className="text-input center">
        <form onSubmit={handleForgotPassword}>
          <div className="center">
            <input
              type="email"
              name="email"
              id="email"
              placeholder="Enter your email"
              size={40}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button type="submit" className="center create-account">
            SEND RESET EMAIL
          </button>
        </form>

        {message && (
          <p className="center" style={{ color: "green" }}>
            {message}
          </p>
        )}
        {error && (
          <p className="center" style={{ color: "red" }}>
            {error}
          </p>
        )}
      </div>

      <div className="center">
        <Link to="/signup">Don't have an account? Sign up</Link>
      </div>
    </div>
  );
}

export default ForgotPassword;

