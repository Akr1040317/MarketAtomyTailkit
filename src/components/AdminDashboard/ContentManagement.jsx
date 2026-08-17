import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { REPORT_CONTENT } from "../../utils/reportContent";
import { toast } from "../Toast";

const CATEGORIES = {
  foundationalStructure: "Foundational Structure",
  financialPosition: "Financial Position",
  salesMarketing: "Sales & Marketing",
  productService: "Product / Service",
  general: "General / Work-life",
};

const HEALTH_LEVELS = {
  healthy: "Healthy",
  needsTweaking: "Needs Tweaking",
  unhealthy: "Needs Attention",
};

function cloneContent(value) {
  return JSON.parse(JSON.stringify(value));
}

export default function ContentManagement() {
  const [selectedCategory, setSelectedCategory] = useState("foundationalStructure");
  const [selectedHealthLevel, setSelectedHealthLevel] = useState("needsTweaking");
  const [reportContent, setReportContent] = useState(cloneContent(REPORT_CONTENT));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    loadReportContent();
  }, []);

  const loadReportContent = async () => {
    try {
      setLoading(true);
      const contentDocRef = doc(db, "reportContent", "main");
      const contentDocSnap = await getDoc(contentDocRef);
      if (contentDocSnap.exists()) {
        setReportContent(contentDocSnap.data());
      } else {
        await setDoc(contentDocRef, REPORT_CONTENT);
        setReportContent(cloneContent(REPORT_CONTENT));
      }
    } catch (error) {
      console.error("Error loading report content:", error);
      toast("Could not load report content. Using code fallbacks.");
      setReportContent(cloneContent(REPORT_CONTENT));
    } finally {
      setLoading(false);
    }
  };

  const currentContent =
    reportContent[selectedCategory]?.[selectedHealthLevel] ||
    REPORT_CONTENT[selectedCategory]?.[selectedHealthLevel] ||
    { label: HEALTH_LEVELS[selectedHealthLevel], message: "", resources: [] };

  const fallbackContent = REPORT_CONTENT[selectedCategory]?.[selectedHealthLevel];

  const updateCurrent = (patch) => {
    setReportContent((prev) => {
      const next = cloneContent(prev);
      if (!next[selectedCategory]) next[selectedCategory] = {};
      next[selectedCategory][selectedHealthLevel] = {
        ...(next[selectedCategory][selectedHealthLevel] || currentContent),
        ...patch,
      };
      return next;
    });
  };

  const updateResource = (index, field, value) => {
    const resources = [...(currentContent.resources || [])];
    resources[index] = { ...resources[index], [field]: value };
    updateCurrent({ resources });
  };

  const saveReportContent = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, "reportContent", "main"), reportContent);
      toast("Report narrative and resources saved to reportContent/main.");
    } catch (error) {
      console.error("Error saving report content:", error);
      toast("Error saving content. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const pillClass =
    selectedHealthLevel === "healthy" ? "healthy" : selectedHealthLevel === "unhealthy" ? "attention" : "tweak";

  if (loading) {
    return (
      <div className="page">
        <p>Loading content...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Report Content & Resources</h1>
          <p>Edit the narrative messages and resource lists used in client reports for each category and health level.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowFallback((open) => !open)}>
            {showFallback ? "Hide Fallback" : "View Fallback"}
          </button>
          <button type="button" className="btn btn-primary" onClick={saveReportContent} disabled={saving}>
            {saving ? "Saving..." : "Save to Firestore"}
          </button>
        </div>
      </div>

      <div className="grid-main">
        <aside className="panel">
          <div className="panel-head">
            <div>
              <h2>Content Matrix</h2>
              <p>Select a category and health state.</p>
            </div>
          </div>
          <div className="panel-body">
            <div className="form-group">
              <label>Category</label>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Health level</label>
              <select value={selectedHealthLevel} onChange={(e) => setSelectedHealthLevel(e.target.value)}>
                {Object.entries(HEALTH_LEVELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="callout">
              <strong>Firestore target</strong>
              <br />
              reportContent/main → {selectedCategory} → {selectedHealthLevel}
            </div>
          </div>
        </aside>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Client Report Content</h2>
              <p>What the client sees for this category and health state.</p>
            </div>
            <span className={`pill ${pillClass}`}>{HEALTH_LEVELS[selectedHealthLevel]}</span>
          </div>
          <div className="panel-body">
            <div className="form-group">
              <label>Label</label>
              <input
                value={currentContent.label || HEALTH_LEVELS[selectedHealthLevel]}
                onChange={(e) => updateCurrent({ label: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Narrative message</label>
              <textarea
                value={currentContent.message || ""}
                onChange={(e) => updateCurrent({ message: e.target.value })}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 9px" }}>
              <strong>Resources</strong>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  updateCurrent({
                    resources: [...(currentContent.resources || []), { title: "", description: "", type: "", url: "", image: "" }],
                  })
                }
              >
                + Add Resource
              </button>
            </div>
            <div className="list">
              {(currentContent.resources || []).map((resource, index) => (
                <div className="resource-edit callout" key={`${selectedCategory}-${selectedHealthLevel}-${index}`}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Title</label>
                      <input value={resource.title || ""} onChange={(e) => updateResource(index, "title", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Type</label>
                      <input value={resource.type || ""} onChange={(e) => updateResource(index, "type", e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <input
                      value={resource.description || ""}
                      onChange={(e) => updateResource(index, "description", e.target.value)}
                    />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>URL</label>
                      <input value={resource.url || ""} onChange={(e) => updateResource(index, "url", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Cover image URL (optional)</label>
                      <input value={resource.image || ""} onChange={(e) => updateResource(index, "image", e.target.value)} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() =>
                      updateCurrent({
                        resources: (currentContent.resources || []).filter((_, resourceIndex) => resourceIndex !== index),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {showFallback && fallbackContent ? (
              <div className="callout warning" style={{ marginTop: 16 }}>
                <strong>Code fallback for this cell</strong>
                <br />
                {fallbackContent.message}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
