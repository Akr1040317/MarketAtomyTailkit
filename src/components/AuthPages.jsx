import { useState } from "react";
import { Link } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import companyLogo from "../assets/MarketAtomy-HOR-300x92.png";
import { Reveal } from "./Reveal";
import "../assets/auth-preview.css";

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/assessment", label: "Assessment" },
  { to: "/about", label: "About" },
];

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.9-1.75 2.99-4.32 2.99-7.37z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.4l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.39 13.92A6.03 6.03 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.61.39 3.13 1.05 4.51l3.34-2.59z" />
      <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.96 2.96 14.7 2 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.71 9.39 5.95 12 5.95z" />
    </svg>
  );
}

function AuthChrome({ variant, current, onHome, children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`ma-auth ${variant}`}>
      <div className="page">
        <header className="nav-wrap">
          <div className="container">
            <nav>
              <a
                className="logo"
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  onHome();
                }}
              >
                <img src={companyLogo} alt="MarketAtomy logo" />
              </a>
              <div className="nav-links">
                {NAV.map((item) => (
                  <Link key={item.to} to={item.to}>{item.label}</Link>
                ))}
              </div>
              <div className="nav-actions">
                {current !== "login" && (
                  <Link className="nav-login" to="/login">Login</Link>
                )}
                {current !== "signup" && (
                  <Link className="btn btn-primary" to="/signup">Get Started</Link>
                )}
                <button
                  type="button"
                  className="nav-menu-btn"
                  aria-label="Open menu"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  {menuOpen ? "✕" : "☰"}
                </button>
              </div>
            </nav>
          </div>
          <div className={`mobile-links${menuOpen ? " open" : ""}`}>
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
            <Link to="/signup" onClick={() => setMenuOpen(false)}>Get Started</Link>
            <Link to="/" onClick={() => { setMenuOpen(false); onHome(); }}>Home</Link>
          </div>
        </header>
        <main>
          <div className="container">
            <div className="auth-layout">{children}</div>
          </div>
        </main>
        <footer>
          <div className="container">
            <div className="footer-grid">
              <div>
                <img className="footer-logo" src={companyLogo} alt="MarketAtomy" />
                <div className="footer-copy">
                  Helping business owners gain clarity, identify gaps, and build stronger foundations for sustainable growth.
                </div>
              </div>
              <div className="footer-col">
                <strong>Explore</strong>
                <Link to="/features">Features</Link>
                <Link to="/assessment">Assessment</Link>
                <Link to="/about">About</Link>
              </div>
              <div className="footer-col">
                <strong>Account</strong>
                <Link to="/login">Login</Link>
                <Link to="/signup">Sign Up</Link>
                <a href="https://www.marketatomy.com/" target="_blank" rel="noopener noreferrer">MarketAtomy.com</a>
              </div>
            </div>
            <div className="footer-bottom">
              <span>© {new Date().getFullYear()} MarketAtomy LLC. All rights reserved.</span>
              <span>Privacy Policy</span>
            </div>
            <div className="footer-credit">Developed by Akshat Rastogi, thank you</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function LoginView({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  error,
  success,
  onSubmit,
  onGoogle,
  onHome,
  onSignup,
}) {
  return (
    <AuthChrome variant="ma-auth-login" current="login" onHome={onHome}>
      <Reveal as="section" className="intro" mode="mount" direction="left">
        <div className="eyebrow">Business Health Check</div>
        <h1>
          Welcome back to
          <br />
          <span className="gradient-text">MarketAtomy.</span>
        </h1>
        <p>
          Sign in to continue your assessment, review your business health results, and access your recommendations.
        </p>
        <div className="mini-list">
          <div className="mini-item">
            <span className="mini-check">✓</span>
            Continue your Business Health Check where you left off
          </div>
          <div className="mini-item">
            <span className="mini-check">✓</span>
            Access your personalized score breakdowns and report
          </div>
          <div className="mini-item">
            <span className="mini-check">✓</span>
            Review priority action items and growth recommendations
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="auth-card" mode="mount" direction="right" delay={0.12}>
        <h2>Sign In</h2>
        <p className="auth-subtitle">Sign in to your Business Health Check account</p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="loginEmail">Email</label>
            <div className="input-wrap">
              <input
                id="loginEmail"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="loginPassword">Password</label>
            <div className="input-wrap">
              <input
                id="loginPassword"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {error && <div className="auth-alert error">{error}</div>}
          {success && <div className="auth-alert success">Login successful! Redirecting...</div>}

          <button className="submit" type="submit">Sign In</button>
        </form>

        <div className="divider">or</div>

        <button className="google-btn" type="button" onClick={onGoogle}>
          <GoogleIcon />
          Sign in with Google
        </button>

        <div className="signup">
          Don&apos;t have an account?{" "}
          <button type="button" onClick={onSignup}>Sign up</button>
        </div>

        <div className="secure-note">
          <span className="lock">●</span>
          Your account information is securely protected.
        </div>
      </Reveal>
    </AuthChrome>
  );
}

export function SignupView({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  username,
  setUsername,
  onUsernameBlur,
  usernameAvailable,
  email,
  setEmail,
  phone,
  setPhone,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  agreedToTerms,
  setAgreedToTerms,
  error,
  success,
  onSubmit,
  onGoogle,
  onHome,
  onLogin,
}) {
  return (
    <AuthChrome variant="ma-auth-signup" current="signup" onHome={onHome}>
      <Reveal as="section" className="intro" mode="mount" direction="left">
        <div className="eyebrow">Business Health Check</div>
        <h1>
          Create your account to
          <br />
          <span className="gradient-text">buy the assessment.</span>
        </h1>
        <p>
          Sign up first. We need a phone number for two-step verification, then you can purchase the one-time $297 Business Health Check and begin.
        </p>
        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <div>
              <strong>Create your account</strong>
              <span>Email plus a phone number for two-step verification, so only you can get into the account.</span>
            </div>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <div>
              <strong>Purchase the assessment</strong>
              <span>One-time $297 fee, or apply a promo code if you have one.</span>
            </div>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <div>
              <strong>Complete it and get next steps</strong>
              <span>Your scores, report, and action plan unlock after purchase.</span>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="auth-card" mode="mount" direction="right" delay={0.12}>
        <h2>Create Your Account</h2>
        <p className="auth-subtitle">Create an account to purchase the $297 Business Health Check</p>

        <form onSubmit={onSubmit}>
          <div className="name-grid">
            <div className="field">
              <label htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={onUsernameBlur}
              required
            />
            {username && !usernameAvailable && <p className="field-hint bad">Username is taken</p>}
            {username && usernameAvailable && <p className="field-hint ok">Username is available</p>}
          </div>

          <div className="field">
            <label htmlFor="signupEmail">Email</label>
            <input
              id="signupEmail"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="signupPhone">Phone number</label>
            <input
              id="signupPhone"
              name="tel"
              type="tel"
              autoComplete="tel"
              placeholder="+15551234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="field-hint">
              Required for two-step verification. We text a code to this number when you create your account and each time you sign in.
            </p>
          </div>

          <div className="password-grid">
            <div className="field">
              <label htmlFor="signupPassword">Password</label>
              <div className="input-wrap">
                <input
                  id="signupPassword"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrap">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
          </div>

          <div className="password-note">
            Use at least 8 characters with a mix of letters, numbers, and symbols.
          </div>

          <div className="checkbox-row">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
            />
            <label htmlFor="terms">
              I agree to receive my assessment results and understand MarketAtomy never sends SPAM.
            </label>
          </div>

          {error && <div className="auth-alert error">{error}</div>}
          {success && <div className="auth-alert success">Account created! Redirecting...</div>}

          <button className="submit" type="submit">Create Account &amp; Continue to Purchase</button>
        </form>

        <div className="divider">or</div>

        <button className="google-btn" type="button" onClick={onGoogle}>
          <GoogleIcon />
          Sign up with Google
        </button>
        <p className="field-hint">Google sign-up still uses the phone number above for two-step verification.</p>

        <div className="signin">
          Already have an account?{" "}
          <button type="button" onClick={onLogin}>Sign in</button>
        </div>

        <div className="secure-note">
          <span className="lock">●</span>
          Your account information is securely protected.
        </div>
      </Reveal>
    </AuthChrome>
  );
}
