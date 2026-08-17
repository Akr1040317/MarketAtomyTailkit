import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import companyLogo from "../assets/MarketAtomy-HOR-300x92.png";
import { Reveal } from "./Reveal";
import "../assets/site-preview.css";

const NAV = [
  { to: "/features", label: "Features", id: "features" },
  { to: "/assessment", label: "Assessment", id: "assessment" },
  { to: "/about", label: "About", id: "about" },
];

export default function PublicSiteChrome({ current, children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [current]);

  return (
    <div className="ma-site">
      <Reveal as="header" className="nav-wrap" mode="mount" direction="none">
        <div className="container">
          <nav>
            <Link className="logo" to="/" onClick={() => setMenuOpen(false)}>
              <img src={companyLogo} alt="MarketAtomy logo" />
            </Link>
            <div className="nav-links">
              {NAV.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  className={current === item.id ? "active" : ""}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="nav-actions">
              <Link className="login" to="/login">Login</Link>
              <Link className="btn btn-primary" to="/signup">Get Started</Link>
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
            <Link key={item.id} to={item.to} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
          <Link to="/signup" onClick={() => setMenuOpen(false)}>Get Started</Link>
        </div>
      </Reveal>

      {children}

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
        </div>
      </footer>
    </div>
  );
}
