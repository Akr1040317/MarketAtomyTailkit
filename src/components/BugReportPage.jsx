import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebaseConfig";
import { toast } from "./Toast";

const EMPTY = {
  title: "",
  description: "",
  stepsToReproduce: "",
  expectedBehavior: "",
  actualBehavior: "",
  severity: "medium",
};

export default function BugReportPage() {
  const [formData, setFormData] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const user = getAuth().currentUser;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast("Please log in to report a bug.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "bugReports"), {
        userId: user.uid,
        userEmail: user.email,
        title: formData.title,
        description: formData.description,
        stepsToReproduce: formData.stepsToReproduce,
        expectedBehavior: formData.expectedBehavior,
        actualBehavior: formData.actualBehavior,
        severity: formData.severity,
        submittedAt: serverTimestamp(),
        status: "open",
      });
      setFormData(EMPTY);
      toast("Bug report submitted with status: open.");
    } catch (error) {
      console.error("Error submitting bug report:", error);
      toast("Error submitting bug report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Report a Bug</h1>
          <p>Tell us what happened so the MarketAtomy team can reproduce and resolve the issue.</p>
        </div>
      </div>
      <form className="panel form-page" onSubmit={handleSubmit}>
        <div className="panel-head">
          <div>
            <h2>Bug Details</h2>
            <p>Please provide enough detail to reproduce the problem.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="form-group">
            <label>Issue title</label>
            <input
              type="text"
              required
              placeholder="Short description of the problem"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>What happened?</label>
            <textarea
              required
              placeholder="Describe the issue"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Steps to reproduce</label>
            <textarea
              placeholder="1. Go to... 2. Click..."
              value={formData.stepsToReproduce}
              onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })}
            />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>What did you expect?</label>
              <textarea
                placeholder="Expected behavior"
                value={formData.expectedBehavior}
                onChange={(e) => setFormData({ ...formData, expectedBehavior: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>What actually happened?</label>
              <textarea
                placeholder="Actual behavior"
                value={formData.actualBehavior}
                onChange={(e) => setFormData({ ...formData, actualBehavior: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Severity</label>
            <select
              required
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
            >
              <option value="low">Low - Minor issue, does not affect functionality</option>
              <option value="medium">Medium - Affects some functionality</option>
              <option value="high">High - Significantly impacts usage</option>
              <option value="critical">Critical - Blocks core functionality</option>
            </select>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting || !formData.title || !formData.description}>
              {submitting ? "Submitting..." : "Submit Bug Report"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
