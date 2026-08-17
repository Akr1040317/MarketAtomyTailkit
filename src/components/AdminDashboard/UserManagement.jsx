import { useEffect, useState } from "react";
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import jsPDF from "jspdf";
import { db } from "../../firebaseConfig";
import { downloadCSV, exportUsersToCSV, filterUsers } from "../../utils/adminUtils";
import { processComputedScores } from "../../utils/analytics";
import { CATEGORY_RANGES } from "../../utils/scoreRanges";
import { CATEGORY_LABELS, formatDate, healthMeta, initials } from "../../utils/adminUi";
import { toast } from "../Toast";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [assessmentFilter, setAssessmentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionResults, setSectionResults] = useState([]);
  const [progressByUser, setProgressByUser] = useState({});
  const [pendingRole, setPendingRole] = useState("tier1");

  useEffect(() => {
    fetchUsers();
    fetchSections();
    fetchProgress();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, roleFilter, assessmentFilter, dateFrom, sortConfig]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(usersQuery);
      setUsers(querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast("Could not load users.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      const q = query(collection(db, "BHC_Assessment"), orderBy("order"));
      const querySnapshot = await getDocs(q);
      const sectionsData = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setSections(sectionsData);
    } catch (error) {
      console.error("Error fetching sections:", error);
    }
  };

  const fetchProgress = async () => {
    try {
      const resultsSnap = await getDocs(collection(db, "sectionResults"));
      const map = {};
      resultsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.userId || !data.sectionName) return;
        if (!map[data.userId]) map[data.userId] = new Set();
        map[data.userId].add(data.sectionName);
      });
      setProgressByUser(map);
    } catch (error) {
      console.error("Error fetching section results:", error);
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const applyFilters = () => {
    const filters = {
      search: searchTerm,
      role: roleFilter,
      assessmentStatus: assessmentFilter,
      dateFrom: dateFrom || null,
      dateTo: null,
    };
    let filtered = filterUsers(users, filters);
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aVal;
        let bVal;
        switch (sortConfig.key) {
          case "name":
            aVal = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
            bVal = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
            break;
          case "email":
            aVal = (a.email || "").toLowerCase();
            bVal = (b.email || "").toLowerCase();
            break;
          case "role":
            aVal = a.role || "tier1";
            bVal = b.role || "tier1";
            break;
          case "signupDate":
            aVal = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            bVal = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    setFilteredUsers(filtered);
  };

  const handleRoleChange = async (userId, newRole) => {
    if (newRole !== "admin" && newRole !== "tier1") {
      toast("Role can only be admin or tier1.");
      return;
    }
    try {
      setUpdatingRole(true);
      await updateDoc(doc(db, "users", userId), { role: newRole });
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role: newRole } : user)));
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, role: newRole });
      }
      toast("Role updated.");
    } catch (error) {
      console.error("Error updating user role:", error);
      toast("Error updating user role. Please try again.");
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = exportUsersToCSV(filteredUsers);
    downloadCSV(csvContent, `users_export_${new Date().toISOString().split("T")[0]}.csv`);
    toast("CSV exported.");
  };

  const loadUserResults = async (user) => {
    const q = query(collection(db, "sectionResults"), where("userId", "==", user.id));
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    setSectionResults(results);
    if (sections.length > 0) setSelectedSection(sections[0]);
    return results;
  };

  const openUserDetails = async (user) => {
    setSelectedUser(user);
    setPendingRole(user.role || "tier1");
    setDetailOpen(true);
    try {
      await loadUserResults(user);
    } catch (error) {
      console.error("Error fetching user answers:", error);
    }
  };

  const downloadUserResponsesCSV = (user) => {
    const rows = [["Section", "Question ID", "Question Text", "Answer", "Weight"]];
    sectionResults.forEach((result) => {
      const section = sections.find((item) => item.title === result.sectionName);
      if (!section?.questions) return;
      section.questions.forEach((question) => {
        const answer = result.answers?.[question.id];
        if (!answer) return;
        if (Array.isArray(answer)) {
          answer.forEach((item) => {
            rows.push([result.sectionName, question.id, question.text, item.answer, item.weight || 0]);
          });
        } else {
          rows.push([result.sectionName, question.id, question.text, answer.answer, answer.weight || 0]);
        }
      });
    });
    downloadCSV(
      rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n"),
      `${user.firstName}_${user.lastName}_responses_${new Date().toISOString().split("T")[0]}.csv`
    );
    toast("Section answers exported.");
  };

  const downloadUserResponsesPDF = async (user) => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let yPos = 20;
    const pageWidth = 210;
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    const checkNewPage = (requiredHeight) => {
      if (yPos + requiredHeight > 280) {
        pdf.addPage();
        yPos = 20;
        return true;
      }
      return false;
    };

    pdf.setFontSize(20);
    pdf.setFont(undefined, "bold");
    pdf.text(`${user.firstName} ${user.lastName} - Assessment Report`, margin, yPos);
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    pdf.text(`Email: ${user.email}`, margin, yPos);
    yPos += 5;
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 10;

    let enhancedScores = null;
    if (user.computedScores) enhancedScores = processComputedScores(user.computedScores);

    if (enhancedScores?.overallHealth) {
      checkNewPage(25);
      pdf.setFontSize(16);
      pdf.setFont(undefined, "bold");
      pdf.text("Overall Business Health", margin, yPos);
      yPos += 8;
      pdf.setFontSize(14);
      pdf.setFont(undefined, "normal");
      pdf.text(`Overall Health Score: ${enhancedScores.overallHealth.percentage}%`, margin, yPos);
      yPos += 6;
      pdf.text(`Health Level: ${enhancedScores.overallHealth.healthLevel}`, margin, yPos);
      yPos += 10;
    }

    if (enhancedScores) {
      checkNewPage(40);
      pdf.setFontSize(16);
      pdf.setFont(undefined, "bold");
      pdf.text("Category Scores Breakdown", margin, yPos);
      yPos += 8;
      Object.keys(enhancedScores)
        .filter((key) => key !== "overallHealth")
        .forEach((key) => {
          const analytics = enhancedScores[key];
          const categoryRange = CATEGORY_RANGES[key];
          if (!analytics || !categoryRange) return;
          checkNewPage(15);
          pdf.setFontSize(12);
          pdf.setFont(undefined, "bold");
          pdf.text(categoryRange.label, margin, yPos);
          yPos += 6;
          pdf.setFontSize(10);
          pdf.setFont(undefined, "normal");
          pdf.text(`Score: ${analytics.rawScore} / ${analytics.maxPossible}`, margin + 5, yPos);
          yPos += 5;
          pdf.text(`Percentage: ${analytics.percentage}%`, margin + 5, yPos);
          yPos += 7;
        });
    }

    pdf.save(`${user.firstName}_${user.lastName}_responses_${new Date().toISOString().split("T")[0]}.pdf`);
    toast("Per-user PDF snapshot generated.");
  };

  const userProgress = (userId) => {
    const done = progressByUser[userId]?.size || 0;
    const total = sections.length || 21;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  };

  const healthForUser = (user) => {
    const processed = processComputedScores(user.computedScores);
    const overall = user.overallHealth || processed?.overallHealth;
    if (!overall) return null;
    return {
      percentage: overall.percentage,
      ...healthMeta(overall.healthLevel),
    };
  };

  if (loading) {
    return (
      <div className="page">
        <p>Loading users...</p>
      </div>
    );
  }

  if (detailOpen && selectedUser) {
    const processed = processComputedScores(selectedUser.computedScores);
    const overall = selectedUser.overallHealth || processed?.overallHealth;
    const overallMeta = healthMeta(overall?.healthLevel);
    const completedNames = new Set(sectionResults.map((result) => result.sectionName));
    const currentResult = sectionResults.find((result) => result.sectionName === selectedSection?.title);

    return (
      <div className="page">
        <div className="page-head">
          <div>
            <button type="button" className="link-btn" onClick={() => setDetailOpen(false)}>
              ← Back to users
            </button>
            <h1 style={{ marginTop: 8 }}>
              {selectedUser.firstName} {selectedUser.lastName}
            </h1>
            <p>Client profile, scores, assessment completion, and stored section answers.</p>
          </div>
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => downloadUserResponsesPDF(selectedUser)}>
              Export PDF Snapshot
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setAnswersOpen(true)}>
              Inspect Answers
            </button>
          </div>
        </div>

        <div className="grid-main">
          <div>
            <section className="panel" style={{ marginBottom: 18 }}>
              <div className="panel-head">
                <div>
                  <h2>Business Health Snapshot</h2>
                  <p>Computed scores from the user's completed sections.</p>
                </div>
                <span className={`pill ${overallMeta.className}`}>
                  Overall {overall?.percentage != null ? `${overall.percentage}%` : "n/a"}
                </span>
              </div>
              <div className="panel-body grid-3">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                  const score = processed?.[key];
                  const meta = healthMeta(score?.healthLevel);
                  return (
                    <div className="callout" key={key}>
                      <strong>{label}</strong>
                      <div style={{ font: "800 24px Manrope", margin: "6px 0" }}>
                        {score?.percentage != null ? `${score.percentage}%` : "—"}
                      </div>
                      <span className={`pill ${meta.className}`}>{score ? meta.label : "Pending"}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Section Completion</h2>
                  <p>Completion uses sectionResults.sectionName matched to BHC_Assessment.title.</p>
                </div>
              </div>
              <div className="panel-body grid-3">
                {sections.map((section) => {
                  const done = completedNames.has(section.title);
                  return (
                    <div className="list-item" key={section.id}>
                      <div>
                        <strong>
                          {section.order}. {section.title}
                        </strong>
                        <span>{done ? "Completed" : "Not completed"}</span>
                      </div>
                      <span className={`pill ${done ? "healthy" : "neutral"}`}>{done ? "✓" : "Pending"}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside>
            <section className="panel" style={{ marginBottom: 18 }}>
              <div className="panel-head">
                <div>
                  <h2>Profile</h2>
                </div>
              </div>
              <div className="panel-body">
                <div className="form-group">
                  <label>Name</label>
                  <input value={`${selectedUser.firstName || ""} ${selectedUser.lastName || ""}`.trim()} readOnly />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input value={selectedUser.email || ""} readOnly />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input value={selectedUser.username || ""} readOnly />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select className="role-select" value={pendingRole} onChange={(e) => setPendingRole(e.target.value)}>
                    <option value="tier1">tier1</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Created</label>
                  <input value={formatDate(selectedUser.createdAt, true)} readOnly />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={updatingRole}
                  onClick={() => handleRoleChange(selectedUser.id, pendingRole)}
                >
                  Save Role
                </button>
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Activity</h2>
                </div>
              </div>
              <div className="panel-body list">
                <div className="list-item">
                  <div>
                    <strong>Last login</strong>
                    <span>{formatDate(selectedUser.lastLoggedOn, true)}</span>
                  </div>
                </div>
                <div className="list-item">
                  <div>
                    <strong>Last assessment update</strong>
                    <span>
                      {sectionResults[0]
                        ? formatDate(
                            [...sectionResults].sort((a, b) => {
                              const aTime = a.submittedAt?.toDate ? a.submittedAt.toDate().getTime() : 0;
                              const bTime = b.submittedAt?.toDate ? b.submittedAt.toDate().getTime() : 0;
                              return bTime - aTime;
                            })[0]?.submittedAt,
                            true
                          )
                        : "None"}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <div className={`modal-backdrop${answersOpen ? " open" : ""}`} onClick={() => setAnswersOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Answers Inspector</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setAnswersOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Select section</label>
                <select
                  value={selectedSection?.id || ""}
                  onChange={(e) => setSelectedSection(sections.find((section) => section.id === e.target.value))}
                >
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.order}. {section.title}
                    </option>
                  ))}
                </select>
              </div>
              {selectedSection?.questions?.map((question) => {
                const answer = currentResult?.answers?.[question.id];
                return (
                  <div className="callout" key={question.id} style={{ marginTop: 8 }}>
                    <strong>
                      {question.id} · {question.type}
                    </strong>
                    <br />
                    {answer
                      ? Array.isArray(answer)
                        ? `Answers: ${answer.map((item) => `${item.answer} (${item.weight})`).join(", ")}`
                        : `Answer: ${answer.answer} · Weight: ${answer.weight ?? 0}`
                      : "No stored answer"}
                  </div>
                );
              })}
              {currentResult ? (
                <div className="callout" style={{ marginTop: 8 }}>
                  <strong>Section score</strong>
                  <br />
                  {currentResult.sectionScore ?? 0} · submitted {formatDate(currentResult.submittedAt, true)}
                </div>
              ) : (
                <div className="callout" style={{ marginTop: 8 }}>
                  This section has no matching sectionResults document.
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => downloadUserResponsesCSV(selectedUser)}>
                Export Section Answers
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>User Management</h1>
          <p>Search clients, review assessment progress, inspect results, change roles, and export user data.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={handleExportCSV}>
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => toast("User creation is not part of the current brief. New clients sign up through the client flow.")}
          >
            Add User
          </button>
        </div>
      </div>
      <section className="panel">
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search name, email, or username"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            <option value="tier1">tier1</option>
            <option value="admin">admin</option>
          </select>
          <select value={assessmentFilter} onChange={(e) => setAssessmentFilter(e.target.value)}>
            <option value="all">All progress</option>
            <option value="completed">Completed</option>
            <option value="incomplete">Incomplete</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSearchTerm("");
              setRoleFilter("all");
              setAssessmentFilter("all");
              setDateFrom("");
            }}
          >
            Clear
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("name")}>User</th>
                <th onClick={() => handleSort("email")}>Email</th>
                <th onClick={() => handleSort("role")}>Role</th>
                <th>Assessment</th>
                <th>Overall Health</th>
                <th onClick={() => handleSort("signupDate")}>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7">No users found</td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const progress = userProgress(user.id);
                  const health = healthForUser(user);
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="table-user">
                          <div className="mini-avatar">{initials(user.firstName, user.lastName, user.email)}</div>
                          <div>
                            <strong>
                              {user.firstName} {user.lastName}
                            </strong>
                            <br />
                            <span>@{user.username || "n/a"}</span>
                          </div>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          className="role-select"
                          value={user.role === "admin" ? "admin" : "tier1"}
                          disabled={updatingRole}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        >
                          <option value="tier1">tier1</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ width: 115 }}>
                          <div className="progress">
                            <span style={{ width: `${progress.percent}%` }} />
                          </div>
                          <small>
                            {progress.percent}% complete
                          </small>
                        </div>
                      </td>
                      <td>
                        {health ? (
                          <span className={`pill ${health.className}`}>
                            {health.percentage}% {health.label}
                          </span>
                        ) : (
                          <span className="pill neutral">Pending</span>
                        )}
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <button type="button" className="btn btn-secondary" onClick={() => openUserDetails(user)}>
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
      </section>
    </div>
  );
}
