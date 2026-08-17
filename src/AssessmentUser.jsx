import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  where,
  limit,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebaseConfig";
import { processComputedScores } from "./utils/analytics";
import { getCategoryMaxScore } from "./utils/scoreRanges";
import ToastHost, { toast } from "./components/Toast";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function isAnswered(question, answers) {
  if (!question) return false;
  const ans = answers[question.id];
  if (question.type === "multipleSelect") return Array.isArray(ans) && ans.length > 0;
  return Boolean(ans && String(ans).trim() !== "");
}

function gateIndexFor(section) {
  if (section?.order !== 19 || !section?.questions?.length) return -1;
  return section.questions.findIndex((q, idx) => {
    const t = (q?.text || "").toLowerCase();
    return idx === 0 || t.includes("manufacturing company");
  });
}

function visibleQuestionsFor(section, answers) {
  const questions = section?.questions || [];
  const gateIndex = gateIndexFor(section);
  if (gateIndex < 0) return questions;
  const gateId = questions[gateIndex]?.id;
  const nonManufacturing = gateId && String(answers[gateId] || "").toLowerCase() === "no";
  if (nonManufacturing) return questions.filter((_, idx) => idx === gateIndex);
  return questions;
}

function readDraft(uid) {
  try {
    return JSON.parse(localStorage.getItem(`bhcDraft:${uid}`) || "{}");
  } catch {
    return {};
  }
}

function writeDraft(uid, sectionId, payload) {
  if (!uid || !sectionId) return;
  const all = readDraft(uid);
  all[sectionId] = payload;
  localStorage.setItem(`bhcDraft:${uid}`, JSON.stringify(all));
}

function clearDraft(uid, sectionId) {
  if (!uid || !sectionId) return;
  const all = readDraft(uid);
  delete all[sectionId];
  localStorage.setItem(`bhcDraft:${uid}`, JSON.stringify(all));
}

export default function AssessmentUser({ setActiveView }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [completedSections, setCompletedSections] = useState([]);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedback, setFeedback] = useState({
    overallRating: "",
    clarityRating: "",
    relevanceRating: "",
    length: "just_right",
    recommendScore: "",
    mostValuableSections: [],
    confusingQuestions: "",
    missingTopics: "",
  });

  const user = getAuth().currentUser;

  const isAssessmentComplete =
    sections.length > 0 && completedSections.length === sections.length;

  const isProductionSection = selectedSection?.order === 19;
  const manufacturingGateIndex = gateIndexFor(selectedSection);
  const manufacturingGateQuestionId =
    manufacturingGateIndex >= 0 ? selectedSection.questions[manufacturingGateIndex]?.id : null;
  const isNonManufacturing =
    isProductionSection &&
    manufacturingGateQuestionId &&
    String(answers[manufacturingGateQuestionId] || "").toLowerCase() === "no";

  const visibleQuestions = useMemo(
    () => visibleQuestionsFor(selectedSection, answers),
    [selectedSection, answers]
  );
  const currentQuestion = visibleQuestions[questionIndex] || null;
  const sectionTotal = visibleQuestions.length;
  const sectionPercent = sectionTotal ? Math.round(((questionIndex + 1) / sectionTotal) * 100) : 0;
  const overallPercent = sections.length
    ? Math.round((completedSections.length / sections.length) * 100)
    : 0;
  const currentSectionIdx = sections.findIndex((section) => section.id === selectedSection?.id);
  const canContinue = isAnswered(currentQuestion, answers);
  const isLastVisible = sectionTotal > 0 && questionIndex >= sectionTotal - 1;
  const isLastSection = currentSectionIdx >= 0 && currentSectionIdx === sections.length - 1;

  const getNextSection = (fromSection = selectedSection) => {
    if (!fromSection || sections.length === 0) return null;
    const idx = sections.findIndex((s) => s.id === fromSection.id);
    if (idx < 0) return null;
    return sections[idx + 1] || null;
  };

  const computeSectionMaxExcludingGate = (section) => {
    if (!section?.questions || section.questions.length === 0) return 0;
    const gateIndex = gateIndexFor(section);
    let total = 0;
    section.questions.forEach((q, idx) => {
      if (section.order === 19 && idx === gateIndex) return;
      if (q.type === "multipleChoice" && Array.isArray(q.options)) {
        const max = q.options.reduce((m, o) => Math.max(m, o.weight || 0), 0);
        total += max;
      } else if (q.type === "multipleSelect" && Array.isArray(q.options)) {
        total += q.options.reduce((sum, o) => sum + Math.max(0, o.weight || 0), 0);
      }
    });
    return total;
  };

  const checkFeedbackAlreadySubmitted = async () => {
    if (!user) return false;
    const snap = await getDocs(
      query(collection(db, "assessmentFeedback"), where("userId", "==", user.uid), limit(1))
    );
    return !snap.empty;
  };

  const persistDraft = (nextAnswers = answers, nextIndex = questionIndex) => {
    if (!user || !selectedSection) return;
    writeDraft(user.uid, selectedSection.id, {
      answers: nextAnswers,
      questionIndex: nextIndex,
    });
  };

  const handleSectionClick = async (section, startAt = "resume") => {
    setSelectedSection(section);
    setAnswers({});
    setQuestionIndex(0);
    setDrawerOpen(false);
    let nextAnswers = {};
    let existing = null;

    if (user) {
      try {
        const q = query(
          collection(db, "sectionResults"),
          where("userId", "==", user.uid),
          where("sectionName", "==", section.title)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.docs.length > 0) {
          const docSnap = querySnapshot.docs[0];
          const data = docSnap.data();
          existing = { id: docSnap.id, data };
          setExistingSubmission(existing);
          if (section.questions?.length) {
            section.questions.forEach((qItem) => {
              const storedAnswer = data.answers?.[qItem.id];
              if (!storedAnswer) return;
              if (qItem.type === "multipleChoice") {
                nextAnswers[qItem.id] = storedAnswer.answer;
              } else if (qItem.type === "multipleSelect") {
                nextAnswers[qItem.id] = Array.isArray(storedAnswer)
                  ? storedAnswer.map((a) => a.answer)
                  : [];
              } else {
                nextAnswers[qItem.id] = storedAnswer.answer;
              }
            });
          }
        } else {
          setExistingSubmission(null);
          const draft = readDraft(user.uid)[section.id];
          if (draft?.answers) nextAnswers = draft.answers;
        }
      } catch (error) {
        console.error("Error fetching submission for section:", error);
      }
    }

    setAnswers(nextAnswers);
    const visible = visibleQuestionsFor(section, nextAnswers);
    let nextIndex = 0;
    if (startAt === "end") {
      nextIndex = Math.max(0, visible.length - 1);
    } else if (startAt === "resume") {
      const firstOpen = visible.findIndex((q) => !isAnswered(q, nextAnswers));
      nextIndex = firstOpen >= 0 ? firstOpen : 0;
    }
    setQuestionIndex(nextIndex);
  };

  useEffect(() => {
    async function boot() {
      try {
        const q = query(collection(db, "BHC_Assessment"), orderBy("order"));
        const querySnapshot = await getDocs(q);
        const sectionsData = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setSections(sectionsData);
        let completed = [];
        if (user) {
          const resultsSnap = await getDocs(
            query(collection(db, "sectionResults"), where("userId", "==", user.uid))
          );
          completed = [...new Set(resultsSnap.docs.map((docSnap) => docSnap.data().sectionName))];
          setCompletedSections(completed);
        }
        const resume =
          sectionsData.find((section) => !completed.includes(section.title)) || sectionsData[0];
        if (resume) handleSectionClick(resume);
      } catch (error) {
        console.error("Error fetching sections: ", error);
      }
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!user || !isAssessmentComplete || feedbackSubmitted) return;
      const already = await checkFeedbackAlreadySubmitted();
      if (already) {
        setFeedbackSubmitted(true);
        setShowFeedbackForm(false);
        return;
      }
      setShowFeedbackForm(true);
    };
    run().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAssessmentComplete, user]);

  useEffect(() => {
    if (sectionTotal > 0 && questionIndex > sectionTotal - 1) {
      setQuestionIndex(sectionTotal - 1);
    }
  }, [sectionTotal, questionIndex]);

  const handleTextAnswerChange = (questionId, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      persistDraft(next);
      return next;
    });
  };

  const handleRadioAnswerChange = (questionId, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      if (isProductionSection && questionId === manufacturingGateQuestionId) {
        if (String(value).toLowerCase() === "no" && selectedSection?.questions) {
          selectedSection.questions.forEach((q, idx) => {
            if (idx !== manufacturingGateIndex) delete next[q.id];
          });
        }
      }
      persistDraft(next);
      return next;
    });
    toast("Answer saved");
  };

  const handleCheckboxAnswerChange = (questionId, optionLabel) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      const next = {
        ...prev,
        [questionId]: current.includes(optionLabel)
          ? current.filter((item) => item !== optionLabel)
          : [...current, optionLabel],
      };
      persistDraft(next);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedSection) return false;
    const unanswered = selectedSection.questions.filter((q, idx) => {
      if (isNonManufacturing && idx !== manufacturingGateIndex) return false;
      return !isAnswered(q, answers);
    });

    if (unanswered.length > 0) {
      toast("Please answer all questions before submitting.");
      return false;
    }

    if (!user) {
      toast("User not logged in. Please log in to submit your answers.");
      return false;
    }

    let processedAnswers = {};
    let sectionScore = 0;
    selectedSection.questions.forEach((q, idx) => {
      if (isNonManufacturing && idx !== manufacturingGateIndex) return;
      const ans = answers[q.id];
      if (q.type === "multipleChoice") {
        const option = q.options.find((o) => o.label === ans);
        const weight = option ? option.weight : 0;
        sectionScore += weight;
        processedAnswers[q.id] = { answer: ans, weight };
      } else if (q.type === "multipleSelect") {
        processedAnswers[q.id] = ans.map((a) => {
          const option = q.options.find((o) => o.label === a);
          const weight = option ? option.weight : 0;
          sectionScore += weight;
          return { answer: a, weight };
        });
      } else {
        processedAnswers[q.id] = { answer: ans, weight: 0 };
      }
    });

    const submission = {
      userId: user.uid,
      userEmail: user.email,
      submittedAt: serverTimestamp(),
      sectionName: selectedSection.title,
      answers: processedAnswers,
      sectionScore,
      notApplicable: isNonManufacturing,
    };

    try {
      if (existingSubmission) {
        await updateDoc(doc(db, "sectionResults", existingSubmission.id), submission);
      } else {
        const newDoc = await addDoc(collection(db, "sectionResults"), submission);
        setExistingSubmission({ id: newDoc.id, data: submission });
      }
      clearDraft(user.uid, selectedSection.id);
      setCompletedSections((prev) => [...new Set([...prev, selectedSection.title])]);

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};
      const computedScores = userData.computedScores || {
        foundationalStructure: { sections: {}, total: 0 },
        financialPosition: { sections: {}, total: 0 },
        salesMarketing: { sections: {}, total: 0 },
        productService: { sections: {}, total: 0 },
        general: { sections: {}, total: 0 },
      };

      const sectionNumber = selectedSection.order;
      const categoryMapping = {
        foundationalStructure: [2, 3, 5, 6, 7],
        financialPosition: [4, 8, 11, 12, 16, 17, 18],
        salesMarketing: [10, 12, 13, 14, 15],
        productService: [8, 9, 19],
        general: [20, 21],
      };

      Object.keys(categoryMapping).forEach((categoryKey) => {
        if (categoryMapping[categoryKey].includes(sectionNumber)) {
          if (sectionNumber === 19 && isNonManufacturing) {
            delete computedScores[categoryKey].sections[sectionNumber];
          } else {
            computedScores[categoryKey].sections[sectionNumber] = sectionScore;
          }
          computedScores[categoryKey].total = Object.values(
            computedScores[categoryKey].sections
          ).reduce((sum, val) => sum + (val || 0), 0);
        }
      });

      if (isProductionSection) {
        if (isNonManufacturing) {
          const baseMax = getCategoryMaxScore("productService");
          const section19Max = computeSectionMaxExcludingGate(selectedSection);
          computedScores.productService.maxPossible = Math.max(0, baseMax - section19Max);
        } else if (computedScores.productService?.maxPossible) {
          delete computedScores.productService.maxPossible;
        }
      }

      const enhancedScores = processComputedScores(computedScores);
      Object.keys(enhancedScores).forEach((categoryKey) => {
        if (categoryKey !== "overallHealth" && computedScores[categoryKey]) {
          computedScores[categoryKey] = {
            ...computedScores[categoryKey],
            ...enhancedScores[categoryKey],
          };
        }
      });

      const updateData = { computedScores };
      if (enhancedScores.overallHealth) {
        updateData.overallHealth = enhancedScores.overallHealth;
      }
      await updateDoc(userDocRef, updateData);

      try {
        const already = await checkFeedbackAlreadySubmitted();
        if (!already) setShowFeedbackForm(true);
      } catch {
        /* ignore */
      }
      return true;
    } catch (error) {
      console.error("Error submitting/updating answers:", error);
      toast("There was an error submitting your answers. Please try again.");
      return false;
    }
  };

  const goContinue = async () => {
    if (!currentQuestion || !canContinue || submitting) return;
    persistDraft();
    if (!isLastVisible) {
      toast("Saved. Moving to the next question.");
      setQuestionIndex((idx) => idx + 1);
      return;
    }

    setSubmitting(true);
    const saved = await handleSubmit();
    setSubmitting(false);
    if (!saved) return;

    const next = getNextSection();
    if (next) {
      toast("Section saved. Moving to the next section.");
      await handleSectionClick(next, "start");
      return;
    }
    toast("Section saved. Scores have been updated.");
  };

  const goBack = async () => {
    if (questionIndex > 0) {
      setQuestionIndex((idx) => idx - 1);
      return;
    }
    if (currentSectionIdx > 0) {
      await handleSectionClick(sections[currentSectionIdx - 1], "end");
    }
  };

  const saveForLater = () => {
    persistDraft();
    toast("Saved. You can return to this question later.");
  };

  const saveAndExit = async () => {
    persistDraft();
    const unanswered = (selectedSection?.questions || []).filter((q, idx) => {
      if (isNonManufacturing && idx !== manufacturingGateIndex) return false;
      return !isAnswered(q, answers);
    });
    if (unanswered.length === 0 && selectedSection) {
      setSubmitting(true);
      await handleSubmit();
      setSubmitting(false);
    }
    toast("Progress saved. Returning to dashboard.");
    if (setActiveView) setActiveView("dashboard");
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    if (!user) return;
    setFeedbackLoading(true);
    try {
      await addDoc(collection(db, "assessmentFeedback"), {
        userId: user.uid,
        userEmail: user.email || "",
        createdAt: serverTimestamp(),
        assessmentCompleted: true,
        responses: {
          overallRating: feedback.overallRating,
          clarityRating: feedback.clarityRating,
          relevanceRating: feedback.relevanceRating,
          length: feedback.length,
          recommendScore: feedback.recommendScore,
          mostValuableSections: feedback.mostValuableSections,
          confusingQuestions: feedback.confusingQuestions,
          missingTopics: feedback.missingTopics,
        },
      });
      setFeedbackSubmitted(true);
      setShowFeedbackForm(false);
      toast("Assessment feedback saved. Your report is ready to view.");
      if (setActiveView) setActiveView("reports");
    } catch (err) {
      console.error("Feedback submit failed:", err);
      toast("Could not submit feedback. Please try again.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const skipFeedback = () => {
    setShowFeedbackForm(false);
    if (setActiveView) setActiveView("reports");
  };

  const overviewRows = useMemo(() => {
    if (currentSectionIdx < 0) return [];
    const rows = [];
    if (currentSectionIdx > 0) rows.push({ section: sections[currentSectionIdx - 1], kind: "prev" });
    rows.push({ section: sections[currentSectionIdx], kind: "current" });
    if (currentSectionIdx + 1 < sections.length) {
      rows.push({ section: sections[currentSectionIdx + 1], kind: "next" });
    }
    if (currentSectionIdx + 2 < sections.length) {
      rows.push({ section: sections[currentSectionIdx + 2], kind: "later" });
    }
    return rows;
  }, [sections, currentSectionIdx]);

  const kicker = currentQuestion?.type === "multipleSelect"
    ? "Select all that apply"
    : currentQuestion?.type === "multipleChoice"
      ? isProductionSection && currentQuestion?.id === manufacturingGateQuestionId
        ? "Production applicability check"
        : "Choose the answer that best reflects your business today"
      : "Add a short response";

  const helper = currentQuestion?.type === "multipleSelect"
    ? "Choose every option that currently applies. You can select more than one."
    : currentQuestion?.type === "multipleChoice"
      ? isProductionSection && currentQuestion?.id === manufacturingGateQuestionId
        ? "If you are not a manufacturing company, the remaining Production questions are skipped and this section is marked not applicable."
        : "Choose the answer that is most accurate right now. The goal is to build an honest baseline, not to get a perfect score."
      : "Add any notes that help complete this section.";

  const coachCopy = selectedSection?.beginningText && questionIndex === 0
    ? selectedSection.beginningText
    : selectedSection?.endingText && isLastVisible
      ? selectedSection.endingText
      : isNonManufacturing
        ? "The remaining Production questions are skipped and will not penalize Product / Service scoring."
        : "Your individual answers are used as part of the broader business health picture. Answer honestly so the report reflects where the business stands today.";

  const continueLabel = isLastVisible
    ? isLastSection
      ? "Finish Assessment →"
      : existingSubmission
        ? "Save Changes →"
        : "Save Section →"
    : "Continue →";

  const drawer = (
    <div
      className={`drawer-backdrop${drawerOpen ? " open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) setDrawerOpen(false);
      }}
    >
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Assessment sections</div>
            <h3>Jump to another section</h3>
          </div>
          <button type="button" className="icon-btn" onClick={() => setDrawerOpen(false)}>
            Close
          </button>
        </div>
        <div className="callout meta-soft" style={{ marginBottom: 12 }}>
          Completed sections can be reviewed and edited. Incomplete sections keep their saved progress.
        </div>
        {sections.map((section) => {
          const done = completedSections.includes(section.title);
          const current = selectedSection?.id === section.id;
          return (
            <button
              type="button"
              className="drawer-section"
              key={section.id}
              onClick={() => handleSectionClick(section)}
            >
              <div
                className="section-num"
                style={
                  done
                    ? { background: "#E8F4EA", color: "#166534" }
                    : current
                      ? { background: "#EEF5FA", color: "#2E6BB0" }
                      : undefined
                }
              >
                {done ? "✓" : section.order}
              </div>
              <div>
                <strong>{section.title}</strong>
                <br />
                <span>
                  {current
                    ? "Current section"
                    : done
                      ? "Completed"
                      : section.order === 19
                        ? "Includes applicability check"
                        : "Not started"}
                </span>
              </div>
              <span>{current ? `${sectionPercent}%` : done ? "Review" : "Open"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (isAssessmentComplete && showFeedbackForm && !feedbackSubmitted) {
    return (
      <div className="page assessment-page">
        <div className="page-head">
          <div>
            <h1>Assessment complete</h1>
            <p>Before you open your report, tell us how the assessment experience worked for you.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setActiveView?.("reports")}>
            Skip to report
          </button>
        </div>
        <form className="panel" onSubmit={submitFeedback}>
          <div className="panel-body">
                <div className="grid-2">
                  <div className="form-group">
                    <label>Overall rating</label>
                    <select
                      required
                      value={feedback.overallRating}
                      onChange={(e) => setFeedback((p) => ({ ...p, overallRating: e.target.value }))}
                    >
                      <option value="" disabled>Select…</option>
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Good</option>
                      <option value="3">3 - Neutral</option>
                      <option value="2">2 - Difficult</option>
                      <option value="1">1 - Poor</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Clarity rating</label>
                    <select
                      required
                      value={feedback.clarityRating}
                      onChange={(e) => setFeedback((p) => ({ ...p, clarityRating: e.target.value }))}
                    >
                      <option value="" disabled>Select…</option>
                      <option value="5">5 - Very clear</option>
                      <option value="4">4</option>
                      <option value="3">3</option>
                      <option value="2">2</option>
                      <option value="1">1 - Unclear</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Relevance rating</label>
                    <select
                      required
                      value={feedback.relevanceRating}
                      onChange={(e) => setFeedback((p) => ({ ...p, relevanceRating: e.target.value }))}
                    >
                      <option value="" disabled>Select…</option>
                      <option value="5">5 - Highly relevant</option>
                      <option value="4">4</option>
                      <option value="3">3</option>
                      <option value="2">2</option>
                      <option value="1">1 - Not relevant</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Assessment length</label>
                    <select
                      value={feedback.length}
                      onChange={(e) => setFeedback((p) => ({ ...p, length: e.target.value }))}
                    >
                      <option value="just_right">Just right</option>
                      <option value="too_short">Too short</option>
                      <option value="too_long">Too long</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>How likely are you to recommend the Business Health Check?</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    required
                    placeholder="0 to 10"
                    value={feedback.recommendScore}
                    onChange={(e) => setFeedback((p) => ({ ...p, recommendScore: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Most valuable sections</label>
                  <div className="grid-3">
                    {sections.map((section) => (
                      <label className="check-card" key={section.id}>
                        <input
                          type="checkbox"
                          checked={feedback.mostValuableSections.includes(section.title)}
                          onChange={() =>
                            setFeedback((p) => {
                              const current = p.mostValuableSections;
                              const next = current.includes(section.title)
                                ? current.filter((title) => title !== section.title)
                                : [...current, section.title];
                              return { ...p, mostValuableSections: next };
                            })
                          }
                        />
                        <div>
                          <strong>{section.title}</strong>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Were any questions confusing?</label>
                  <textarea
                    value={feedback.confusingQuestions}
                    onChange={(e) => setFeedback((p) => ({ ...p, confusingQuestions: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Was anything important missing?</label>
                  <textarea
                    value={feedback.missingTopics}
                    onChange={(e) => setFeedback((p) => ({ ...p, missingTopics: e.target.value }))}
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={skipFeedback}>
                    Skip for now
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={feedbackLoading}>
                    {feedbackLoading ? "Submitting…" : "Submit & View Report"}
                  </button>
                </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page assessment-page">
      <div className="page-head assessment-head">
        <div>
          <h1>Business Health Assessment</h1>
          <p>
            Section {selectedSection?.order || currentSectionIdx + 1} of {sections.length || 21}
            {sectionTotal ? ` · Question ${questionIndex + 1} of ${sectionTotal}` : ""}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => setDrawerOpen(true)}>
            Sections
          </button>
          <button type="button" className="btn btn-secondary" onClick={saveForLater}>
            Save progress
          </button>
          <button type="button" className="btn btn-primary" onClick={saveAndExit}>
            Save & exit
          </button>
        </div>
      </div>
      <div className="assessment-stage">
          <aside className="assessment-side panel">
            <div>
              <div className="side-eyebrow">Business Health Check</div>
              <h3>Your Assessment</h3>
              <p>Take it one step at a time. You can stop and come back whenever you need to.</p>
            </div>
            <div>
              <div className="progress-meta">
                <span>Overall progress</span>
                <strong>{overallPercent}%</strong>
              </div>
              <div className="track">
                <span style={{ width: `${overallPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="side-eyebrow" style={{ marginBottom: 8 }}>Current area</div>
              <div className="section-overview">
                {overviewRows.map((row) => {
                  const done = completedSections.includes(row.section.title);
                  return (
                    <button
                      type="button"
                      key={row.section.id}
                      className={`section-row${row.kind === "current" ? " active" : ""}${done && row.kind !== "current" ? " done" : ""}`}
                      onClick={() => handleSectionClick(row.section)}
                    >
                      <div className="section-num">
                        {done && row.kind !== "current" ? "✓" : row.section.order}
                      </div>
                      <div>{row.section.title}</div>
                      <small>
                        {row.kind === "current"
                          ? `${Math.min(questionIndex + 1, sectionTotal)} / ${sectionTotal || 0}`
                          : done
                            ? "Complete"
                            : row.kind === "next"
                              ? "Next"
                              : "Later"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="side-footer">
              <button type="button" onClick={() => setDrawerOpen(true)}>
                View all {sections.length || 21} sections
              </button>
            </div>
          </aside>

          <div className="assessment-main">
            <div className="walkthrough">
              <div className="top-context">
                <div>
                  <div className="eyebrow">{selectedSection?.title || "Assessment"}</div>
                  <h1>{selectedSection?.title || "Assessment"}</h1>
                  <p>{helper}</p>
                </div>
                <div className="question-progress">
                  <strong>{sectionPercent}% of section</strong>
                  <span>{overallPercent}% overall complete</span>
                </div>
              </div>

              <section className="question-card panel">
                {currentQuestion ? (
                  <>
                    <div className="question-kicker">{kicker}</div>
                    <h2>{currentQuestion.text}</h2>
                    <p className="helper">{helper}</p>

                    {currentQuestion.type === "multipleChoice" && currentQuestion.options ? (
                      <div className="answers">
                        {currentQuestion.options.map((option, oIndex) => {
                          const selected = answers[currentQuestion.id] === option.label;
                          return (
                            <button
                              type="button"
                              className={`answer${selected ? " selected" : ""}`}
                              key={option.label || oIndex}
                              onClick={() => handleRadioAnswerChange(currentQuestion.id, option.label)}
                            >
                              <div className="answer-bullet">{LETTERS[oIndex] || oIndex + 1}</div>
                              <div>
                                <strong>{option.label}</strong>
                                {option.description ? <span>{option.description}</span> : null}
                              </div>
                              <div className="answer-check">✓</div>
                            </button>
                          );
                        })}
                      </div>
                    ) : currentQuestion.type === "multipleSelect" && currentQuestion.options ? (
                      <div className="answers">
                        {currentQuestion.options.map((option, oIndex) => {
                          const selected = answers[currentQuestion.id]?.includes(option.label);
                          return (
                            <button
                              type="button"
                              className={`answer${selected ? " selected" : ""}`}
                              key={option.label || oIndex}
                              onClick={() => handleCheckboxAnswerChange(currentQuestion.id, option.label)}
                            >
                              <div className="answer-bullet">✓</div>
                              <div>
                                <strong>{option.label}</strong>
                                {option.description ? <span>{option.description}</span> : null}
                              </div>
                              <div className="answer-check">✓</div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <textarea
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                        placeholder="Optional notes"
                      />
                    )}

                    <div className="mini-coach">
                      <div className="coach-icon">i</div>
                      <div>
                        <strong>Why we ask this</strong>
                        <p>{coachCopy}</p>
                      </div>
                    </div>

                    <div className="walkthrough-footer">
                      <div className="left-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={goBack}
                          disabled={questionIndex === 0 && currentSectionIdx <= 0}
                        >
                          ← Back
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={saveForLater}>
                          Save for later
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!canContinue || submitting}
                        onClick={goContinue}
                      >
                        {submitting ? "Saving…" : continueLabel}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="question-kicker">Assessment</div>
                    <h2>{selectedSection ? "No questions available for this section." : "Loading your assessment…"}</h2>
                    <p className="helper">Select a section from the list to continue.</p>
                  </>
                )}
              </section>
              <div className="footer-note">Your progress is saved as you move through the assessment.</div>
            </div>
          </div>
      </div>
      {drawer}
    </div>
  );
}
