import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { processComputedScores } from "./utils/analytics";
import { getCategoryReport } from "./utils/reportContent";
import { getResourceCoverImage } from "./utils/resourceImages";

const FILTERS = [
  { value: "all", label: "All categories" },
  { value: "financialPosition", label: "Financial Strength" },
  { value: "salesMarketing", label: "Sales & Marketing" },
  { value: "productService", label: "Product / Service" },
  { value: "foundationalStructure", label: "Foundational Structure" },
  { value: "general", label: "Overall Health" },
];

const PINNED = [
  {
    title: "BHC Financial Expert Consultation",
    description: "Discuss your financial position with a specialist.",
    pill: "Financial Strength",
    pillClass: "tweak",
    category: "financialPosition",
    href: "https://calendly.com/dannaolivo/bhc-financial-expert-consultation",
    cta: "Schedule",
    primary: true,
  },
  {
    title: "BHC 1:1 Debrief",
    description: "Walk through your Business Health Check results with MarketAtomy.",
    pill: "Business Health",
    pillClass: "info",
    category: "general",
    href: "https://calendly.com/dannaolivo/bhc-1-on-1-consult",
    cta: "Book Debrief",
    primary: true,
  },
  {
    title: "MarketAtomy Discovery Conversation",
    description: "Explore broader business support options.",
    pill: "Discovery",
    pillClass: "info",
    category: "general",
    href: "https://calendly.com/dannaolivo/discovery",
    cta: "Schedule",
    primary: false,
  },
];

const CATEGORY_PILL = {
  financialPosition: { label: "Financial Strength", cls: "tweak" },
  salesMarketing: { label: "Sales & Marketing", cls: "tweak" },
  productService: { label: "Product / Service", cls: "healthy" },
  foundationalStructure: { label: "Foundational Structure", cls: "info" },
  general: { label: "Overall Health", cls: "info" },
};

export default function Resources() {
  const [enhancedScores, setEnhancedScores] = useState(null);
  const [queryText, setQueryText] = useState("");
  const [filter, setFilter] = useState("all");
  const user = getAuth().currentUser;

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        setEnhancedScores(processComputedScores(snap.data().computedScores || {}));
      }
    };
    load().catch((error) => console.error("Error loading resources:", error));
  }, [user]);

  const recommended = useMemo(() => {
    if (!enhancedScores) return [];
    const map = new Map();
    FILTERS.filter((item) => item.value !== "all").forEach(({ value }) => {
      const analytics =
        value === "general"
          ? enhancedScores.overallHealth || enhancedScores.general
          : enhancedScores[value];
      if (!analytics?.healthLevel) return;
      getCategoryReport(value, analytics.healthLevel).resources.forEach((resource) => {
        if (!map.has(resource.title)) {
          map.set(resource.title, { ...resource, category: value });
        }
      });
    });
    return Array.from(map.values());
  }, [enhancedScores]);

  const cards = useMemo(() => {
    const fromScores = recommended.map((resource) => ({
      title: resource.title,
      description: resource.description || "",
      pill: CATEGORY_PILL[resource.category]?.label || resource.type || "Resource",
      pillClass: CATEGORY_PILL[resource.category]?.cls || "info",
      category: resource.category || "general",
      type: resource.type || "",
      image: resource.image || "",
      href: resource.url || null,
      cta: resource.url ? "Open" : "View Resource",
      primary: Boolean(resource.url),
    }));
    const merged = [...PINNED];
    fromScores.forEach((card) => {
      if (!merged.some((item) => item.title === card.title)) merged.push(card);
    });
    return merged.filter((card) => {
      const hay = `${card.title} ${card.description} ${card.pill}`.toLowerCase();
      const matchQ = !queryText || hay.includes(queryText.toLowerCase());
      const matchCat = filter === "all" || card.category === filter;
      return matchQ && matchCat;
    });
  }, [recommended, queryText, filter]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Help Center</h1>
          <p>Recommended guides, worksheets, videos, MarketAtomy Academy resources, and consultation options based on your assessment.</p>
        </div>
        <a className="btn btn-secondary" href="https://marketatomy.academy" target="_blank" rel="noreferrer">
          Open MarketAtomy Academy
        </a>
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-body">
          <div className="filter-grid">
            <input
              type="text"
              placeholder="Search resources, topics, or categories"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="grid-3">
        {cards.map((card) => (
          <article className="panel resource-card" key={card.title}>
            <img
              className="resource-cover"
              src={getResourceCoverImage({
                title: card.title,
                description: card.description,
                type: card.type,
                category: card.category,
                image: card.image,
              })}
              alt=""
              loading="lazy"
            />
            <div className="panel-body">
              <span className={`pill ${card.pillClass}`}>{card.pill}</span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              {card.href ? (
                <a className={`btn ${card.primary ? "btn-primary" : "btn-secondary"}`} href={card.href} target="_blank" rel="noreferrer">
                  {card.cta}
                </a>
              ) : (
                <span className="btn btn-secondary">{card.cta}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
