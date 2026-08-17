import { Link } from "react-router-dom";
import companyLogo from "../assets/MarketAtomy-HOR-300x92.png";
import PublicSiteChrome from "./PublicSiteChrome";
import { Reveal, Stagger, Item } from "./Reveal";

const APPROACH = [
  { icon: "01", title: "Cognitive Awareness", body: "Help owners recognize what is happening across the business before deciding what to change." },
  { icon: "02", title: "Focused Education", body: "Connect business challenges with practical knowledge and resources that support better decisions." },
  { icon: "03", title: "Strategic Collaboration", body: "Encourage a more deliberate path forward through informed planning, support, and sequencing." },
];

const HELP = [
  { icon: "↗", title: "Business Growth Consulting", body: "Support for owners who need a clearer path through complex growth decisions." },
  { icon: "◎", title: "Strategic Planning and Sequencing", body: "A practical approach to prioritizing actions and reducing unnecessary friction." },
  { icon: "✓", title: "Business Health Check", body: "A structured diagnostic that helps owners identify strengths, gaps, and priority areas." },
  { icon: "▤", title: "Education and Resources", body: "Focused learning designed to strengthen the owner's ability to make informed decisions." },
  { icon: "◇", title: "Growth Roadmapping", body: "A clearer view of how assessment, analysis, strategy, implementation, and growth connect." },
  { icon: "+", title: "Strategic Support", body: "Opportunities to continue the conversation with resources and professional guidance." },
];

export default function AboutPage() {
  return (
    <PublicSiteChrome current="about">
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <Reveal mode="mount" direction="left">
              <div className="eyebrow">About MarketAtomy</div>
              <h1>Helping owners build businesses with <span className="gradient">stronger foundations.</span></h1>
              <p className="lede">
                MarketAtomy helps small and medium business owners step outside the daily demands of running a company and gain the clarity needed to plan, prioritize, and grow with greater intention.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" to="/signup">Take the Business Health Check</Link>
                <a className="btn btn-outline" href="https://www.marketatomy.com/" target="_blank" rel="noopener noreferrer">
                  Visit MarketAtomy.com
                </a>
              </div>
            </Reveal>
            <Reveal className="hero-card" mode="mount" direction="right" delay={0.12}>
              <img src={companyLogo} alt="MarketAtomy" style={{ width: 220, display: "block", marginBottom: 25 }} />
              <div className="hero-card-title">Our mission</div>
              <h3 style={{ fontSize: 27, marginTop: 9 }}>Focus on the DREAM... Trust the PROCESS!</h3>
              <p style={{ marginTop: 13, color: "#9aa8ba", fontSize: 14 }}>
                Preparing business owners for success through cognitive awareness, focused education, and strategic collaboration.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="section section-light">
          <div className="container content-grid">
            <Reveal direction="left">
              <div className="eyebrow">Why MarketAtomy exists</div>
              <h2>It is difficult to plan the future when the present demands everything.</h2>
            </Reveal>
            <Reveal direction="right">
              <p style={{ fontSize: 17 }}>
                Business owners often spend so much time solving immediate problems that there is little room left to evaluate the systems behind those problems.
              </p>
              <p style={{ fontSize: 17, marginTop: 17 }}>
                MarketAtomy creates space for that larger view. The goal is to help owners work ON the business, not only IN the business, so decisions can be made with greater context and purpose.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="section section-dark">
          <div className="container">
            <Reveal className="section-head">
              <div className="eyebrow">Our approach</div>
              <h2>Clarity first. Then strategy.</h2>
              <p>We believe stronger decisions begin with a better understanding of where the business is today.</p>
            </Reveal>
            <Stagger className="cards">
              {APPROACH.map((item) => (
                <Item className="card" key={item.title}>
                  <div className="card-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="section section-light">
          <div className="container content-grid">
            <Reveal direction="left">
              <div className="eyebrow">Sequencing strategy</div>
              <h2>The right move matters. So does the order.</h2>
              <p style={{ marginTop: 18, fontSize: 17 }}>
                Traditional planning can make every objective feel equally important. MarketAtomy focuses on identifying the sequence of actions that can help owners avoid preventable roadblocks and move toward healthier growth.
              </p>
            </Reveal>
            <Reveal className="quote" direction="right">
              A stronger business is not built by doing everything at once. It is built by knowing what deserves attention next.
            </Reveal>
          </div>
        </section>

        <section className="section section-dark">
          <div className="container">
            <Reveal className="section-head">
              <div className="eyebrow">How we help</div>
              <h2>Tools and guidance for the work behind sustainable growth.</h2>
            </Reveal>
            <Stagger className="cards">
              {HELP.map((item) => (
                <Item className="card" key={item.title}>
                  <div className="card-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="cta">
          <div className="container">
            <Reveal className="cta-box">
              <div>
                <div className="eyebrow">Start with clarity</div>
                <h2>See where your business stands today.</h2>
                <p>The Business Health Check is designed to help you uncover the areas that may deserve closer attention before they become larger obstacles.</p>
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
