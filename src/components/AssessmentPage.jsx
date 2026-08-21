import { Link } from "react-router-dom";
import PublicSiteChrome from "./PublicSiteChrome";
import { Reveal, Stagger, Item } from "./Reveal";

const STEPS = [
  { icon: "01", title: "Take Stock", body: "Work through focused business topics at a pace that fits your schedule." },
  { icon: "02", title: "See the Patterns", body: "View your results across the major systems that influence business health." },
  { icon: "03", title: "Set Priorities", body: "Use the results to distinguish areas of strength from areas that deserve closer attention." },
];

const PROGRESS = [
  "Clear progress tracking",
  "Return and continue later",
  "Review completed areas",
  "Results become more useful as your baseline develops",
];

const RESULTS = [
  "Executive business health summary",
  "Five system scorecards",
  "Priority action areas",
  "Personalized recommendations",
  "Relevant business resources",
  "Downloadable report",
];

export default function AssessmentPage() {
  return (
    <PublicSiteChrome current="assessment">
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <Reveal mode="mount" direction="left">
              <div className="eyebrow">The Business Health Check</div>
              <h1>A structured way to see <span className="gradient">what needs your attention.</span></h1>
              <p className="lede">
                Step out of day to day problem solving and take a deliberate look at the systems that shape your business. The assessment helps turn scattered concerns into a more organized picture of where you stand.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" to="/signup">Start Assessment - $297</Link>
                <Link className="btn btn-outline" to="/login">Continue Assessment</Link>
              </div>
            </Reveal>
            <Reveal className="hero-card" mode="mount" direction="right" delay={0.12}>
              <div className="hero-card-title">A simple path from questions to clarity</div>
              <div className="check-list">
                <div className="check-item"><span className="check-dot">1</span>Reflect on the major areas of your business</div>
                <div className="check-item"><span className="check-dot">2</span>Build a clearer picture across five systems</div>
                <div className="check-item"><span className="check-dot">3</span>Review your results and priority areas</div>
                <div className="check-item"><span className="check-dot">4</span>Use your report and resources to plan what comes next</div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section section-light">
          <div className="container">
            <Reveal className="section-head">
              <div className="eyebrow">How it works</div>
              <h2>Designed to help you think differently about the business.</h2>
              <p>You do not need to solve everything while taking the assessment. The purpose is to create an honest baseline, surface patterns, and give you a better place to begin.</p>
            </Reveal>
            <Stagger className="cards">
              {STEPS.map((step) => (
                <Item className="card" key={step.title}>
                  <div className="card-icon">{step.icon}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="section section-dark">
          <div className="container content-grid">
            <Reveal direction="left">
              <div className="eyebrow">Built for progress</div>
              <h2>You can work through it in sessions.</h2>
              <p className="lede">
                Business owners are busy. The assessment is designed so you can make progress section by section, return later, and continue building your business health picture without starting over.
              </p>
              <div className="check-list">
                {PROGRESS.map((item) => (
                  <div className="check-item" key={item}>
                    <span className="check-dot">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal className="hero-card" direction="right">
              <div className="hero-card-title">Assessment progress</div>
              <h3 style={{ fontSize: 30, marginTop: 8 }}>Your business baseline</h3>
              <p style={{ marginTop: 9, color: "#93a1b3", fontSize: 13 }}>
                A guided process that helps you move from reflection to a more informed growth conversation.
              </p>
              <div style={{ marginTop: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8b99ab" }}>
                  <span>Progress</span>
                  <span>65%</span>
                </div>
                <div className="track" style={{ height: 8, marginTop: 9 }}>
                  <span style={{ width: "65%", background: "linear-gradient(90deg,#2E6BB0,#2BB3C7,#F5C400)" }} />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="section section-light">
          <div className="container content-grid">
            <Reveal direction="left">
              <div className="eyebrow">Your results</div>
              <h2>Finish with something you can actually use.</h2>
              <p style={{ marginTop: 18, fontSize: 17 }}>
                Your completed assessment gives you a structured health view, written insights, recommended resources, and a roadmap that can help guide the next stage of your planning.
              </p>
            </Reveal>
            <Stagger className="check-list">
              {RESULTS.map((item) => (
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
            <Reveal className="quote" direction="left">
              If you do not know what you do not know, how will you know what to focus on fixing?
            </Reveal>
            <Reveal direction="right">
              <div className="eyebrow">A better starting point</div>
              <h2>Clarity before another strategy.</h2>
              <p className="lede">
                The goal is not to hand you another generic list of business advice. It is to help you understand your current position so your next decisions can be more intentional.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="cta">
          <div className="container">
            <Reveal className="cta-box">
              <div>
                <div className="eyebrow">Start your Business Health Check</div>
                <h2>Make the next decision with a clearer picture.</h2>
                <p>Take a structured look at where the business is today and identify where focused attention can create the most value.</p>
              </div>
              <div className="cta-side">
                <div className="cta-price"><strong>$297</strong>Business Health Check</div>
                <Link className="btn btn-primary" to="/signup">Get Started — $297</Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </PublicSiteChrome>
  );
}
