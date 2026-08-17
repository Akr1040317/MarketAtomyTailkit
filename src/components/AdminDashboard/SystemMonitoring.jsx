import { useEffect, useState } from "react";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { formatDate, severityMeta, statusMeta } from "../../utils/adminUi";
import { toast } from "../Toast";

export default function SystemMonitoring() {
  const [activeTab, setActiveTab] = useState("bugs");
  const [bugReports, setBugReports] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [bugSearch, setBugSearch] = useState("");
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [selectedBug, setSelectedBug] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [bugsSnap, feedbackSnap] = await Promise.all([
        getDocs(query(collection(db, "bugReports"), orderBy("submittedAt", "desc"))),
        getDocs(query(collection(db, "feedback"), orderBy("submittedAt", "desc"))),
      ]);
      setBugReports(bugsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      setFeedback(feedbackSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    } catch (error) {
      console.error("Error fetching monitoring data:", error);
      toast("Could not load monitoring data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkResolved = async (bugId) => {
    try {
      setUpdatingStatus(true);
      await updateDoc(doc(db, "bugReports", bugId), { status: "resolved" });
      setBugReports((prev) => prev.map((report) => (report.id === bugId ? { ...report, status: "resolved" } : report)));
      if (selectedBug?.id === bugId) setSelectedBug({ ...selectedBug, status: "resolved" });
      toast("Bug status updated to resolved.");
    } catch (error) {
      console.error("Error updating bug status:", error);
      toast("Error updating bug status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredBugs = bugReports.filter((bug) => {
    const matchesStatus = statusFilter === "all" || (bug.status || "open") === statusFilter;
    const matchesSeverity = severityFilter === "all" || bug.severity === severityFilter;
    const q = bugSearch.toLowerCase();
    const matchesSearch =
      !q ||
      (bug.title || "").toLowerCase().includes(q) ||
      (bug.userEmail || "").toLowerCase().includes(q) ||
      (bug.description || "").toLowerCase().includes(q);
    return matchesStatus && matchesSeverity && matchesSearch;
  });

  const filteredFeedback = feedback.filter((item) => {
    const matchesRating = ratingFilter === "all" || String(item.rating) === String(ratingFilter);
    const q = feedbackSearch.toLowerCase();
    const matchesSearch =
      !q ||
      (item.userEmail || "").toLowerCase().includes(q) ||
      (item.feedback || "").toLowerCase().includes(q) ||
      (item.suggestions || "").toLowerCase().includes(q);
    return matchesRating && matchesSearch;
  });

  const openCount = bugReports.filter((bug) => (bug.status || "open") !== "resolved").length;

  if (loading && bugReports.length === 0 && feedback.length === 0) {
    return (
      <div className="page">
        <p>Loading system monitoring data...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>System Monitoring</h1>
          <p>Triage client bug reports and product feedback without mixing operational issues into the assessment content workflow.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={load}>
            Refresh Queue
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-body">
          <div className="tabs">
            <button type="button" className={`tab${activeTab === "bugs" ? " active" : ""}`} onClick={() => setActiveTab("bugs")}>
              Bug Reports <span className="pill attention">{openCount} open</span>
            </button>
            <button
              type="button"
              className={`tab${activeTab === "feedback" ? " active" : ""}`}
              onClick={() => setActiveTab("feedback")}
            >
              Product Feedback <span className="pill info">{feedback.length}</span>
            </button>
          </div>
        </div>

        {activeTab === "bugs" ? (
          <>
            <div className="toolbar compact">
              <input placeholder="Search bugs" value={bugSearch} onChange={(e) => setBugSearch(e.target.value)} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                <option value="all">All severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={load}>
                Filter
              </button>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>User</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredBugs.length === 0 ? (
                    <tr>
                      <td colSpan="6">No bug reports found</td>
                    </tr>
                  ) : (
                    filteredBugs.map((bug) => {
                      const severity = severityMeta(bug.severity);
                      const status = statusMeta(bug.status);
                      return (
                        <tr key={bug.id}>
                          <td>
                            <strong>{bug.title}</strong>
                          </td>
                          <td>{bug.userEmail}</td>
                          <td>
                            <span className={`pill ${severity.className}`}>{severity.label}</span>
                          </td>
                          <td>
                            <span className={`pill ${status.className}`}>{status.label}</span>
                          </td>
                          <td>{formatDate(bug.submittedAt, true)}</td>
                          <td>
                            <button type="button" className="btn btn-secondary" onClick={() => setSelectedBug(bug)}>
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="toolbar compact">
              <input placeholder="Search feedback" value={feedbackSearch} onChange={(e) => setFeedbackSearch(e.target.value)} />
              <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
                <option value="all">All ratings</option>
                <option value="5">5</option>
                <option value="4">4</option>
                <option value="3">3</option>
                <option value="2">2</option>
                <option value="1">1</option>
              </select>
              <select>
                <option>All types</option>
                <option>feedback</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={load}>
                Filter
              </button>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Rating</th>
                    <th>Feedback</th>
                    <th>Submitted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredFeedback.length === 0 ? (
                    <tr>
                      <td colSpan="5">No feedback found</td>
                    </tr>
                  ) : (
                    filteredFeedback.map((item) => (
                      <tr key={item.id}>
                        <td>{item.userEmail}</td>
                        <td>{"★".repeat(parseInt(item.rating, 10) || 0)}</td>
                        <td>{item.feedback}</td>
                        <td>{formatDate(item.submittedAt, true)}</td>
                        <td>
                          <button type="button" className="btn btn-secondary" onClick={() => setSelectedFeedback(item)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className={`modal-backdrop${selectedBug ? " open" : ""}`} onClick={() => setSelectedBug(null)}>
        {selectedBug ? (
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{selectedBug.title}</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedBug(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div>
                  <label>Severity</label>
                  <span className={`pill ${severityMeta(selectedBug.severity).className}`}>
                    {severityMeta(selectedBug.severity).label}
                  </span>
                </div>
                <div>
                  <label>Status</label>
                  <span className={`pill ${statusMeta(selectedBug.status).className}`}>
                    {statusMeta(selectedBug.status).label}
                  </span>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 15 }}>
                <label>Title</label>
                <div className="callout">
                  <strong>{selectedBug.title}</strong>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <div className="callout">{selectedBug.description}</div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Steps</label>
                  <div className="callout">{selectedBug.stepsToReproduce || "Not provided"}</div>
                </div>
                <div>
                  <div className="form-group">
                    <label>Expected</label>
                    <div className="callout">{selectedBug.expectedBehavior || "Not provided"}</div>
                  </div>
                  <div className="form-group">
                    <label>Actual</label>
                    <div className="callout">{selectedBug.actualBehavior || "Not provided"}</div>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Submitted by</label>
                <div className="callout">{selectedBug.userEmail}</div>
              </div>
            </div>
            <div className="modal-foot">
              {selectedBug.status !== "resolved" ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={updatingStatus}
                  onClick={() => handleMarkResolved(selectedBug.id)}
                >
                  Mark Resolved
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={`modal-backdrop${selectedFeedback ? " open" : ""}`} onClick={() => setSelectedFeedback(null)}>
        {selectedFeedback ? (
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Feedback Detail</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedFeedback(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>User</label>
                <div className="callout">{selectedFeedback.userEmail}</div>
              </div>
              <div className="form-group">
                <label>Rating</label>
                <div className="callout">{selectedFeedback.rating}/5</div>
              </div>
              <div className="form-group">
                <label>Feedback</label>
                <div className="callout">{selectedFeedback.feedback}</div>
              </div>
              <div className="form-group">
                <label>Suggestions</label>
                <div className="callout">{selectedFeedback.suggestions || "None"}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
