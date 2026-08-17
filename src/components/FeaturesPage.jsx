import { Link } from "react-router-dom";
import PublicSiteChrome from "./PublicSiteChrome";
import { Reveal, Stagger, Item } from "./Reveal";

const SYSTEMS = [
  { icon: "01", title: "Foundational Structure", body: "Explore how prepared and organized the business is for the next stage of growth.", chips: ["Preparation", "Leadership", "Structure"] },
  { icon: "02", title: "Financial Position", body: "Gain a clearer view of the financial systems that support stability and expansion.", chips: ["Pricing", "Costs", "Funding"] },
  { icon: "03", title: "Product and Service", body: "Look at how well your offering aligns with the market and supports sustainable demand.", chips: ["Market Fit", "Delivery", "Development"] },
  { icon: "04", title: "Marketing and Sales", body: "Evaluate how effectively your business attracts, converts, and grows customer relationships.", chips: ["Customers", "Brand", "Scalability"] },
  { icon: "05", title: "Overall Health", body: "Step back and consider the larger picture, including the demands the business places on the owner.", chips: ["Perspective", "Sustainability"] },
  { icon: "+", title: "Connected Insights", body: "See how strengths and gaps across multiple systems can influence the direction of the whole business.", chips: ["Clarity", "Priorities", "Next Steps"] },
];

const DELIVERABLES = [
  "Business health dashboard",
  "Category score breakdowns",
  "Health level indicators",
  "Personalized written report",
  "Priority action items",
  "Growth roadmap",
  "Recommended resources",
  "Downloadable PDF report",
];

const METRICS = [
  { label: "Foundational Structure", value: "85%", width: "85%", color: "#2E6BB0" },
  { label: "Financial Strength", value: "72%", width: "72%", color: "#166534" },
  { label: "Sales & Marketing", value: "68%", width: "68%", color: "#2BB3C7" },
  { label: "Product Viability", value: "90%", width: "90%", color: "#F26522" },
];

export default function FeaturesPage() {
  return (
    <PublicSiteChrome current="features">
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <Reveal mode="mount" direction="left">
              <div className="eyebrow">Built for business clarity</div>
              <h1>See your business as a <span className="gradient">connected system.</span></h1>
              <p className="lede">
                The Business Health Check helps you move beyond isolated symptoms and understand the areas that influence your ability to grow, adapt, and make better decisions.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" to="/signup">Get Started</Link>
                <Link className="btn btn-outline" to="/assessment">See How It Works</Link>
              </div>
            </Reveal>
            <Reveal className="hero-card" mode="mount" direction="right" delay={0.12}>
              <div className="hero-card-title">Your business health snapshot</div>
              <div className="metric-grid">
                {METRICS.map((metric) => (
                  <div className="metric" key={metric.label}>
                    <small>{metric.label}</small>
                    <strong>{metric.value}</strong>
                    <div className="track">
                      <span style={{ width: metric.width, background: metric.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section section-dark">
          <div className="container">
            <Reveal className="section-head">
              <div className="eyebrow">Five connected systems</div>
              <h2>A broader view of what drives business health.</h2>
              <p>Growth depends on more than revenue. MarketAtomy helps you examine the major systems that work together behind the scenes of a healthy business.</p>
            </Reveal>
            <Stagger className="cards">
              {SYSTEMS.map((system) => (
                <Item className="card" key={system.title}>
                  <div className="card-icon">{system.icon}</div>
                  <h3>{system.title}</h3>
                  <p>{system.body}</p>
                  <div className="chips">
                    {system.chips.map((chip) => (
                      <span className="chip" key={chip}>{chip}</span>
                    ))}
                  </div>
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="section section-light">
          <div className="container content-grid">
            <Reveal direction="left">
              <div className="eyebrow">What you receive</div>
              <h2>Turn reflection into a practical next step.</h2>
              <p style={{ marginTop: 18, fontSize: 17 }}>
                The experience is designed to give you more than a collection of answers. It organizes what you learn into a clearer view of your business and where attention may be most valuable.
              </p>
            </Reveal>
            <Stagger className="check-list">
              {DELIVERABLES.map((item) => (
                <Item className="check-item" key={item}>
                  <span className="check-dot">✓</span>
                  {item}
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="section section-dark">
          <div className="container content-grid">
            <Reveal direction="left">
              <div className="eyebrow">Designed for real owners</div>
              <h2>Know where to focus before everything feels urgent.</h2>
              <p className="lede">
                When every part of the business demands attention, it can be difficult to separate the loudest problem from the most important one. The Business Health Check helps create that distinction.
              </p>
            </Reveal>
            <Reveal className="quote" direction="right">
              You cannot improve what you have not yet identified.
            </Reveal>
          </div>
        </section>

        <section className="cta">
          <div className="container">
            <Reveal className="cta-box">
              <div>
                <div className="eyebrow">Ready to get a clearer view?</div>
                <h2>Start with the health of the whole business.</h2>
                <p>Identify strengths, uncover gaps, and create a better foundation for the decisions ahead.</p>
              </div>
              <div className="cta-side">
                <div className="cta-price"><strong>$297</strong>Business Health Check</div>
                <Link className="btn btn-primary" to="/signup">Start Assessment</Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </PublicSiteChrome>
  );
}
