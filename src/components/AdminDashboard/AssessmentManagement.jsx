import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { mintQuestionId } from "../../utils/adminUi";
import { toast } from "../Toast";

export default function AssessmentManagement() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [originalSection, setOriginalSection] = useState(null);
  const [questionAnalytics, setQuestionAnalytics] = useState({});
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    if (selectedSection) fetchQuestionAnalytics(selectedSection.id);
  }, [selectedSection]);

  async function fetchSections() {
    try {
      const q = query(collection(db, "BHC_Assessment"), orderBy("order"));
      const querySnapshot = await getDocs(q);
      const sectionsData = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setSections(sectionsData);
      if (sectionsData.length > 0 && !selectedSection) {
        loadSection(sectionsData[0]);
      }
    } catch (error) {
      console.error("Error fetching sections: ", error);
      toast("Could not load BHC_Assessment.");
    }
  }

  const loadSection = (section) => {
    const sectionWithExtras = {
      beginningText: "",
      endingText: "",
      ...section,
    };
    const snapshot = JSON.parse(JSON.stringify(sectionWithExtras));
    setSelectedSection(section);
    setEditingSection(snapshot);
    setOriginalSection(JSON.parse(JSON.stringify(sectionWithExtras)));
  };

  async function fetchQuestionAnalytics(sectionId) {
    try {
      setLoadingAnalytics(true);
      const sectionResultsSnapshot = await getDocs(collection(db, "sectionResults"));
      const sectionDoc = await getDoc(doc(db, "BHC_Assessment", sectionId));
      if (!sectionDoc.exists()) return;
      const sectionData = sectionDoc.data();
      const relevantResults = sectionResultsSnapshot.docs
        .map((docSnap) => docSnap.data())
        .filter((result) => result.sectionName === sectionData.title);

      const analytics = {};
      (sectionData.questions || []).forEach((question) => {
        let totalAnswers = 0;
        let totalWeight = 0;
        relevantResults.forEach((result) => {
          if (!result.answers?.[question.id]) return;
          totalAnswers += 1;
          const answerData = result.answers[question.id];
          if (question.type === "multipleChoice") {
            totalWeight += answerData.weight || 0;
          } else if (question.type === "multipleSelect" && Array.isArray(answerData)) {
            answerData.forEach((item) => {
              totalWeight += item.weight || 0;
            });
          }
        });
        analytics[question.id] = {
          completionRate: relevantResults.length ? Math.round((totalAnswers / relevantResults.length) * 100) : 0,
          averageWeight: totalAnswers ? Math.round((totalWeight / totalAnswers) * 10) / 10 : 0,
          totalAnswers,
        };
      });
      setQuestionAnalytics(analytics);
    } catch (error) {
      console.error("Error fetching question analytics:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  const updateEditing = (updater) => {
    setEditingSection((prev) => updater(prev));
  };

  const handleAddNewQuestion = () => {
    updateEditing((prev) => {
      const questions = [...(prev.questions || [])];
      questions.push({
        id: mintQuestionId(prev.order || 0, questions),
        text: "",
        type: "multipleChoice",
        options: [],
      });
      return { ...prev, questions };
    });
  };

  const handleDeleteQuestion = (questionIndex) => {
    updateEditing((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, index) => index !== questionIndex),
    }));
  };

  const moveQuestion = (from, to) => {
    updateEditing((prev) => {
      if (to < 0 || to >= prev.questions.length) return prev;
      const questions = [...prev.questions];
      const [moved] = questions.splice(from, 1);
      questions.splice(to, 0, moved);
      return { ...prev, questions };
    });
  };

  const persistSection = async () => {
    if (!editingSection?.id) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, "BHC_Assessment", editingSection.id), {
        title: editingSection.title,
        order: editingSection.order || 0,
        beginningText: editingSection.beginningText || "",
        endingText: editingSection.endingText || "",
        questions: editingSection.questions,
      });
      setSections((prev) => prev.map((section) => (section.id === editingSection.id ? editingSection : section)));
      setSelectedSection(editingSection);
      setOriginalSection(JSON.parse(JSON.stringify(editingSection)));
      setConfirmOpen(false);
      setConfirmText("");
      toast("Section saved to BHC_Assessment.");
    } catch (error) {
      console.error("Error saving section:", error);
      toast("Error saving section. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Assessment Management</h1>
          <p>Edit BHC_Assessment section content and questions while preserving IDs, weights, scoring behavior, and stable section titles.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={fetchSections}>Reload</button>
          <button type="button" className="btn btn-primary" onClick={() => { setConfirmText(""); setConfirmOpen(true); }}>Save Section</button>
        </div>
      </div>
      <div className="callout warning" style={{ marginBottom: 17 }}>
        <strong>High-impact editor.</strong> Changing option weights changes future scores. Changing question IDs can orphan existing sectionResults.answers. Renaming section titles can break completion matching. Preserve IDs and stable titles unless you are intentionally migrating existing data.
      </div>
      <div className="grid-main">
        <aside className="panel">
          <div className="panel-head"><div><h2>Sections</h2><p>Loaded from BHC_Assessment ordered by order.</p></div></div>
          <div className="panel-body">
            <select
              value={selectedSection?.id || ""}
              onChange={(e) => {
                const next = sections.find((section) => section.id === e.target.value);
                if (next) loadSection(next);
              }}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>{section.order}. {section.title}</option>
              ))}
            </select>
            <div className="list" style={{ marginTop: 13 }}>
              {sections.filter((section) => [2, 16, 19].includes(section.order)).map((section) => (
                <button type="button" className="list-item" key={section.id} onClick={() => loadSection(section)}>
                  <div>
                    <strong>Section {section.order}</strong>
                    <span>{section.questions?.length || 0} questions</span>
                  </div>
                  <span className={`pill ${section.order === 19 ? "attention" : section.order === 16 ? "tweak" : "info"}`}>{section.title}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>{editingSection ? `Section ${editingSection.order}: ${editingSection.title}` : "Select a section"}</h2>
              <p>Document fields: title, order, beginningText, endingText, questions[].</p>
            </div>
          </div>
          {editingSection ? (
            <div className="panel-body">
              <div className="grid-2">
                <div className="form-group">
                  <label>Title</label>
                  <input value={editingSection.title || ""} onChange={(e) => updateEditing((prev) => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Order</label>
                  <input type="number" value={editingSection.order || 0} onChange={(e) => updateEditing((prev) => ({ ...prev, order: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Beginning text</label>
                <textarea value={editingSection.beginningText || ""} onChange={(e) => updateEditing((prev) => ({ ...prev, beginningText: e.target.value }))} />
              </div>
              {(editingSection.questions || []).map((question, qIndex) => {
                const analytics = questionAnalytics[question.id];
                return (
                  <div className="question-editor callout" key={question.id || qIndex}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <span className="pill info">{question.id}</span>
                        <strong style={{ display: "block", marginTop: 7 }}>Question {qIndex + 1}</strong>
                        {analytics ? <span>Completion {analytics.completionRate}% · Avg weight {analytics.averageWeight} · {analytics.totalAnswers} answers</span> : loadingAnalytics ? <span>Loading analytics...</span> : null}
                      </div>
                      <div className="actions">
                        <button type="button" className="btn btn-ghost" onClick={() => moveQuestion(qIndex, qIndex - 1)}>↑</button>
                        <button type="button" className="btn btn-ghost" onClick={() => moveQuestion(qIndex, qIndex + 1)}>↓</button>
                        <button type="button" className="btn btn-danger" onClick={() => handleDeleteQuestion(qIndex)}>Delete</button>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginTop: 12 }}>
                      <label>Question text</label>
                      <input value={question.text || ""} onChange={(e) => updateEditing((prev) => { const questions = [...prev.questions]; questions[qIndex] = { ...questions[qIndex], text: e.target.value }; return { ...prev, questions }; })} />
                    </div>
                    <div className="form-group">
                      <label>Type</label>
                      <select
                        value={question.type}
                        onChange={(e) => updateEditing((prev) => {
                          const questions = [...prev.questions];
                          const nextType = e.target.value;
                          questions[qIndex] = { ...questions[qIndex], type: nextType, options: nextType === "multipleChoice" || nextType === "multipleSelect" ? questions[qIndex].options || [] : [] };
                          return { ...prev, questions };
                        })}
                      >
                        <option value="multipleChoice">multipleChoice</option>
                        <option value="multipleSelect">multipleSelect</option>
                        <option value="text">text</option>
                      </select>
                    </div>
                    {(question.type === "multipleChoice" || question.type === "multipleSelect") && (question.options || []).map((option, oIndex) => (
                      <div className="grid-2" key={`${question.id}-opt-${oIndex}`}>
                        <div className="form-group">
                          <label>Option label</label>
                          <input value={option.label || ""} onChange={(e) => updateEditing((prev) => { const questions = [...prev.questions]; const options = [...(questions[qIndex].options || [])]; options[oIndex] = { ...options[oIndex], label: e.target.value }; questions[qIndex] = { ...questions[qIndex], options }; return { ...prev, questions }; })} />
                        </div>
                        <div className="form-group">
                          <label>Weight</label>
                          <input type="number" value={option.weight ?? ""} onChange={(e) => updateEditing((prev) => { const questions = [...prev.questions]; const options = [...(questions[qIndex].options || [])]; options[oIndex] = { ...options[oIndex], weight: e.target.value }; questions[qIndex] = { ...questions[qIndex], options }; return { ...prev, questions }; })} />
                        </div>
                      </div>
                    ))}
                    {(question.type === "multipleChoice" || question.type === "multipleSelect") && (
                      <button type="button" className="btn btn-secondary" onClick={() => updateEditing((prev) => { const questions = [...prev.questions]; const options = [...(questions[qIndex].options || []), { label: "", weight: 0 }]; questions[qIndex] = { ...questions[qIndex], options }; return { ...prev, questions }; })}>+ Add Option</button>
                    )}
                  </div>
                );
              })}
              <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={handleAddNewQuestion}>+ Add Question</button>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Ending text</label>
                <textarea value={editingSection.endingText || ""} onChange={(e) => updateEditing((prev) => ({ ...prev, endingText: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="panel-body"><p>Select a section to edit its details.</p></div>
          )}
        </section>
      </div>
      <div className={`modal-backdrop${confirmOpen ? " open" : ""}`} onClick={() => setConfirmOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Confirm Assessment Change</h3>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
          </div>
          <div className="modal-body">
            <div className="dangerbox callout">
              <strong>This can affect future scores and historical answer compatibility.</strong>
              <br />
              Saving overwrites the BHC_Assessment section document. Do not recycle question IDs. If you changed a title, question ID, or option weight, verify that the change is intentional.
              {originalSection && originalSection.title !== editingSection?.title ? (
                <>
                  <br />
                  Title change detected: existing sectionResults matching "{originalSection.title}" will no longer count as complete.
                </>
              ) : null}
            </div>
            <div className="form-group" style={{ marginTop: 14 }}>
              <label>Type SAVE to confirm</label>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="SAVE" />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-primary" disabled={confirmText !== "SAVE" || saving} onClick={persistSection}>Save to Firestore</button>
          </div>
        </div>
      </div>
    </div>
  );
}
