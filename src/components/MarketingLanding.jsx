import { useState } from "react";
import { Link } from "react-router-dom";
import companyLogo from "../assets/MarketAtomy-HOR-300x92.png";
import { Reveal, Stagger, Item } from "./Reveal";
import "../assets/landing-preview.css";

const SYSTEMS = [
  {
    icon: "🏗",
    title: "Foundational Structure",
    items: ["Business Preparation", "Executive Management", "Business Structure", "Business Milestones"],
  },
  {
    icon: "💰",
    title: "Financial Position",
    items: ["Pricing Models", "Cost Analysis", "Financial Management", "Funding"],
  },
  {
    icon: "◆",
    title: "Product / Service Offering",
    items: ["Market Dynamics", "Product Development", "Service Delivery", "Intellectual Property"],
  },
  {
    icon: "📈",
    title: "Marketing / Sales",
    items: ["Market Dynamics", "Customer Identification", "Brand Strategy", "Scalability"],
  },
  {
    icon: "♥",
    title: "Overall Health",
    items: ["General Business Health", "Personal Assessment", "Leadership Readiness", "Growth Sustainability"],
  },
];

const DELIVERABLES = [
  "Comprehensive PDF Report",
  "Category Score Breakdowns",
  "Health Level Indicators",
  "Priority Action Items",
  "Recommended Resources",
  "Growth Roadmap",
  "Progress Tracking",
  "Actionable Recommendations",
];

const STEPS = [
  { num: "01", title: "Evaluate where you are", body: "Answer structured questions covering 20 critical business areas." },
  { num: "02", title: "See the interdependencies", body: "Understand how weaknesses in one function may restrict another." },
  { num: "03", title: "Identify the highest-priority gaps", body: "Separate urgent issues from areas that are already supporting growth." },
  { num: "04", title: "Build your next-stage roadmap", body: "Use the findings and recommendations to prioritize smarter growth." },
];

const SERVICES = [
  "Business Growth Consulting",
  "Strategic Planning & Sequencing",
  "Business Health Check Assessment",
  "Training & Educational Resources",
];

function PublicNav({ onHome, onLogin, onSignup, current }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Reveal as="header" className="nav-wrap" mode="mount" direction="none">
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
            <Link to="/features">Features</Link>
            <Link to="/assessment">Assessment</Link>
            <Link to="/about">About</Link>
          </div>

          <div className="nav-actions">
            {current !== "login" && (
              <button type="button" className="nav-login" onClick={onLogin}>Login</button>
            )}
            {current !== "signup" && (
              <button type="button" className="btn btn-primary" onClick={onSignup}>Get Started</button>
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
        <Link to="/features" onClick={() => setMenuOpen(false)}>Features</Link>
        <Link to="/assessment" onClick={() => setMenuOpen(false)}>Assessment</Link>
        <Link to="/about" onClick={() => setMenuOpen(false)}>About</Link>
        <button type="button" onClick={() => { setMenuOpen(false); onLogin(); }}>Login</button>
        <button type="button" onClick={() => { setMenuOpen(false); onSignup(); }}>Get Started</button>
      </div>
    </Reveal>
  );
}

function PublicFooter({ onLogin, onSignup }) {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-intro">
            <img className="footer-logo" src={companyLogo} alt="MarketAtomy" />
            <p>
              Empowering entrepreneurs with tools and knowledge to build businesses on rock-solid foundations.
            </p>
          </div>
          <div className="footer-col">
            <strong>Quick Links</strong>
            <button type="button" onClick={onLogin}>Login</button>
            <button type="button" onClick={onSignup}>Sign Up</button>
            <Link to="/features">Features</Link>
            <Link to="/assessment">Assessment</Link>
            <Link to="/about">About</Link>
          </div>
          <div className="footer-col">
            <strong>MarketAtomy</strong>
            <a href="https://www.marketatomy.com/" target="_blank" rel="noopener noreferrer">Visit Website</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MarketAtomy. All rights reserved.</span>
          <span>We value your email privacy and never send SPAM.</span>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLanding({ onLogin, onSignup, onHome }) {
  return (
    <div className="ma-landing">
      <PublicNav onHome={onHome} onLogin={onLogin} onSignup={onSignup} current="landing" />

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <Reveal mode="mount" direction="left">
              <div className="hero-badge">
                <span>✓</span>
                Business clarity starts here
              </div>
              <h1>
                <span className="gradient-text">Business Health Check</span>
                <span className="white">Assessment</span>
              </h1>
              <p className="hero-copy">
                Evaluate your business across 20 critical performance areas and identify the gaps, risks, and opportunities that matter most for sustainable growth.
              </p>
              <div className="price-line">
                For just <strong>$297</strong>, see where your business is strong and where hidden gaps could interfere with growth.
              </div>
              <div className="hero-actions">
                <button type="button" className="btn btn-primary" onClick={onSignup}>
                  Start Assessment — $297
                  <span>→</span>
                </button>
                <button type="button" className="btn btn-secondary" onClick={onLogin}>Sign In</button>
              </div>
              <div className="privacy">
                <span className="privacy-dot">✓</span>
                Privacy Policy: We value your email privacy and never send SPAM.
              </div>
            </Reveal>

            <Reveal className="dashboard-shell" mode="mount" direction="right" delay={0.15}>
              <div className="glow" />
              <div className="dashboard">
                <div className="dashboard-header">
                  <div>
                    <strong>Business Health Overview</strong>
                    <span style={{ display: "block", marginTop: 2 }}>Sample assessment result</span>
                  </div>
                  <span>20 areas analyzed</span>
                </div>
                <div className="score-summary">
                  <div>
                    <small>Overall health score</small>
                    <div className="score">79%</div>
                  </div>
                  <div className="health-label">
                    Strong foundation<br />
                    <span style={{ color: "#7d8b9f", fontWeight: 500 }}>Growth opportunities identified</span>
                  </div>
                </div>
                <div className="metrics">
                  <div className="metric">
                    <div className="metric-label">Foundational<br />Structure</div>
                    <div className="metric-value">85%</div>
                    <div className="bar bar-blue"><span style={{ width: "85%" }} /></div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Financial Strength</div>
                    <div className="metric-value">72%</div>
                    <div className="bar bar-green"><span style={{ width: "72%" }} /></div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Sales &amp; Marketing</div>
                    <div className="metric-value">68%</div>
                    <div className="bar bar-cyan"><span style={{ width: "68%" }} /></div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Product Viability</div>
                    <div className="metric-value">90%</div>
                    <div className="bar bar-orange"><span style={{ width: "90%" }} /></div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="stats">
          <div className="container">
            <Stagger className="stats-grid">
              <Item className="stat">
                <strong className="blue">400,000+</strong>
                <span>New businesses start annually</span>
              </Item>
              <Item className="stat">
                <strong className="orange">70%</strong>
                <span>Fail within 24 months</span>
              </Item>
              <Item className="stat">
                <strong className="cyan">20</strong>
                <span>Critical areas evaluated</span>
              </Item>
            </Stagger>
            <Reveal className="reason" delay={0.2}>
              Common reasons for failure:{" "}
              <strong>poor management, undercapitalization, incorrect pricing structures</strong>
            </Reveal>
          </div>
        </section>

        <section className="section systems" id="systems">
          <div className="container">
            <Reveal className="section-head">
              <div className="eyebrow">One complete diagnostic</div>
              <h2>The 5 Business Health Systems</h2>
              <p>
                A business does not grow in isolated departments. The assessment evaluates five interdependent systems to show where your company is healthy and where one weakness may be limiting another.
              </p>
            </Reveal>
            <Stagger className="systems-grid" delay={0.08}>
              {SYSTEMS.map((system) => (
                <Item as="article" className="system-card" key={system.title}>
                  <div className="system-icon">{system.icon}</div>
                  <h3>{system.title}</h3>
                  <ul>
                    {system.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="section" id="assessment">
          <div className="container report-grid">
            <Reveal className="report-preview" direction="left">
              <div className="preview-top">
                <div>
                  <span>Personalized Business Health Report</span>
                  <h3>Your Growth Snapshot</h3>
                </div>
                <div className="report-pill">Growth Ready</div>
              </div>
              <div className="report-score">
                <div className="score-ring" />
                <div>
                  <p>Business Health Level</p>
                  <strong>Strong, with clear opportunities</strong>
                  <p style={{ marginTop: 5 }}>12 strengths · 4 priorities · 4 watch areas</p>
                </div>
              </div>
              <div className="report-rows">
                <div className="report-row">
                  <span>Top strength</span>
                  <strong>Product Viability</strong>
                </div>
                <div className="report-row">
                  <span>Priority gap</span>
                  <strong>Pricing Model</strong>
                </div>
                <div className="report-row">
                  <span>Recommended next action</span>
                  <strong>Review unit economics</strong>
                </div>
              </div>
            </Reveal>

            <Reveal className="report-copy" direction="right" delay={0.1}>
              <div className="eyebrow">What you'll receive</div>
              <h2>More than a score. A clearer path forward.</h2>
              <p>
                Your assessment turns complex business inputs into a structured view of strengths, vulnerabilities, and the areas that deserve your attention first.
              </p>
              <Stagger className="deliverables" delay={0.12}>
                {DELIVERABLES.map((item) => (
                  <Item className="deliverable" key={item}>
                    <span className="check">✓</span>
                    {item}
                  </Item>
                ))}
              </Stagger>
              <button type="button" className="btn btn-blue" style={{ marginTop: 30 }} onClick={onSignup}>
                Start Your Assessment
                <span>→</span>
              </button>
            </Reveal>
          </div>
        </section>

        <section className="section why">
          <div className="container why-grid">
            <Reveal className="why-copy" direction="left">
              <div className="eyebrow">Why take the assessment?</div>
              <h2>Growth problems often start somewhere other than where they show up.</h2>
              <p>
                MarketAtomy's Business Health Check gives you the perspective of an external expert by examining how your operations, finances, market, product, and leadership systems influence each other.
              </p>
              <p>
                Instead of reacting only to the problem in front of you, you can identify the upstream gaps that may be creating friction across the company.
              </p>
              <div className="quote">
                “If you don't know what you don't know… how will you know what to focus on fixing?”
              </div>
            </Reveal>
            <Stagger className="steps" delay={0.1}>
              {STEPS.map((step) => (
                <Item className="step" key={step.num}>
                  <div className="step-num">{step.num}</div>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.body}</p>
                  </div>
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="section" id="about">
          <div className="container about-grid">
            <Reveal className="about-panel" direction="left">
              <img className="about-logo" src={companyLogo} alt="MarketAtomy" />
              <h3>Build your business on rock-solid foundations.</h3>
              <p>
                Empowering small and medium business owners with the tools and knowledge needed to grow with greater clarity.
              </p>
              <div className="mission">“Focus on the DREAM... Trust the PROCESS!”</div>
              <p>
                MarketAtomy's mission is to prepare small business owners for success through cognitive awareness, focused education, and strategic collaboration.
              </p>
            </Reveal>
            <Reveal className="about-copy" direction="right" delay={0.08}>
              <div className="eyebrow">Designed by MarketAtomy</div>
              <h2>Work on the business, not only in it.</h2>
              <p>
                Most owners are so focused on satisfying immediate needs that planning for the future gets pushed aside. MarketAtomy helps leaders step outside day-to-day execution and examine the systems that determine whether growth is sustainable.
              </p>
              <p>
                We focus on sequencing strategy: identifying alternative routes, avoiding unnecessary roadblocks, and helping businesses get to revenue faster than traditional static strategic planning.
              </p>
              <Stagger className="services" delay={0.12}>
                {SERVICES.map((service) => (
                  <Item className="service" key={service}>{service}</Item>
                ))}
              </Stagger>
              <a className="text-link" href="https://www.marketatomy.com/" target="_blank" rel="noopener noreferrer">
                Learn More About MarketAtomy
                <span>↗</span>
              </a>
            </Reveal>
          </div>
        </section>

        <section className="cta">
          <div className="container">
            <Reveal className="cta-box">
              <div className="cta-copy">
                <div className="eyebrow">Ready to assess your business?</div>
                <h2>Know the gaps before they become expensive problems.</h2>
                <p>
                  Preventative measures create healthier growth. See where your business stands today and what deserves your attention next.
                </p>
              </div>
              <div className="cta-side">
                <div className="cta-price">
                  <strong>$297</strong>
                  one-time assessment
                </div>
                <button type="button" className="btn btn-primary" onClick={onSignup}>
                  Start Assessment
                  <span>→</span>
                </button>
                <button type="button" className="cta-login" onClick={onLogin}>
                  Already started? Sign in
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Reveal as="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-intro">
              <img className="footer-logo" src={companyLogo} alt="MarketAtomy" />
              <p>
                Empowering entrepreneurs with tools and knowledge to build businesses on rock-solid foundations.
              </p>
            </div>
            <div className="footer-col">
              <strong>Quick Links</strong>
              <button type="button" onClick={onLogin}>Login</button>
              <button type="button" onClick={onSignup}>Sign Up</button>
              <Link to="/features">Features</Link>
              <Link to="/assessment">Assessment</Link>
              <Link to="/about">About</Link>
            </div>
            <div className="footer-col">
              <strong>MarketAtomy</strong>
              <a href="https://www.marketatomy.com/" target="_blank" rel="noopener noreferrer">Visit Website</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} MarketAtomy. All rights reserved.</span>
            <span>We value your email privacy and never send SPAM.</span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

export { PublicNav, PublicFooter };
