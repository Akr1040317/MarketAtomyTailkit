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
import { toast } from "./components/Toast";
import LockedFeature from "./components/LockedFeature";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Scored question types must be answered before a section can be submitted.
// Free-text / notes questions are always optional.
function isRequiredQuestion(question) {
  if (!question) return false;
  return question.type === "multipleChoice" || question.type === "multipleSelect";
}

function isAnswered(question, answers) {
  if (!question) return false;
  const ans = answers[question.id];
  if (question.type === "multipleSelect") return Array.isArray(ans) && ans.length > 0;
  return Boolean(ans && String(ans).trim() !== "");
}

function isPendingCatchup(question, answers, confirmedOptionalSkips) {
  if (!question || isAnswered(question, answers)) return false;
  if (!isRequiredQuestion(question) && confirmedOptionalSkips.has(question.id)) return false;
  return true;
}

function pendingCatchupItems(questions, answers, confirmedOptionalSkips) {
  return (questions || [])
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => isPendingCatchup(q, answers, confirmedOptionalSkips));
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

export default function AssessmentUser({ setActiveView, hasAssessmentAccess = true, onRequestPurchase }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [visitedIds, setVisitedIds] = useState(() => new Set());
  const [reviewMode, setReviewMode] = useState(false);
  const [catchupMode, setCatchupMode] = useState(false);
  const [confirmedOptionalSkips, setConfirmedOptionalSkips] = useState(() => new Set());
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

  const sectionAnsweredCount = useMemo(
    () => visibleQuestions.filter((q) => isAnswered(q, answers)).length,
    [visibleQuestions, answers]
  );
  const sectionPercent = sectionTotal ? Math.round((sectionAnsweredCount / sectionTotal) * 100) : 0;

  const overallPercent = sections.length
    ? Math.round((completedSections.length / sections.length) * 100)
    : 0;
  const currentSectionIdx = sections.findIndex((section) => section.id === selectedSection?.id);

  const requiredUnanswered = useMemo(
    () => visibleQuestions.filter((q) => isRequiredQuestion(q) && !isAnswered(q, answers)),
    [visibleQuestions, answers]
  );
  const canSubmitSection = sectionTotal > 0 && requiredUnanswered.length === 0;

  const pendingCatchup = useMemo(
    () => pendingCatchupItems(visibleQuestions, answers, confirmedOptionalSkips),
    [visibleQuestions, answers, confirmedOptionalSkips]
  );
  const canContinue = catchupMode
    ? !!currentQuestion && isAnswered(currentQuestion, answers)
    : !!currentQuestion && (!isRequiredQuestion(currentQuestion) || isAnswered(currentQuestion, answers));
  const isLastVisible = sectionTotal > 0 && questionIndex >= sectionTotal - 1;
  const isLastCatchup = catchupMode && pendingCatchup.every((item) => item.idx === questionIndex || isAnswered(item.q, answers));
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

  const draftMap = user ? readDraft(user.uid) : {};

  const sectionStatus = (section) => {
    if (completedSections.includes(section.title)) return "done";
    if (selectedSection?.id === section.id) return "current";
    const draft = draftMap[section.id];
    if (draft?.answers && Object.keys(draft.answers).length > 0) return "in-progress";
    return "not-started";
  };

  const handleSectionClick = async (section, startAt = "resume") => {
    setSelectedSection(section);
    setAnswers({});
    setQuestionIndex(0);
    setVisitedIds(new Set());
    setReviewMode(false);
    setCatchupMode(false);
    setConfirmedOptionalSkips(new Set());
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
    if (visible[nextIndex]) {
      setVisitedIds(new Set([visible[nextIndex].id]));
    }
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

  useEffect(() => {
    if (currentQuestion) {
      setVisitedIds((prev) => {
        if (prev.has(currentQuestion.id)) return prev;
        const next = new Set(prev);
        next.add(currentQuestion.id);
        return next;
      });
    }
  }, [currentQuestion]);

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
    if (!canSubmitSection) {
      toast("Answer all required questions before submitting.");
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
        processedAnswers[q.id] = (ans || []).map((a) => {
          const option = q.options.find((o) => o.label === a);
          const weight = option ? option.weight : 0;
          sectionScore += weight;
          return { answer: a, weight };
        });
      } else {
        processedAnswers[q.id] = { answer: ans || "", weight: 0 };
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

  const goContinue = () => {
    if (!currentQuestion || !canContinue || submitting) return;
    persistDraft();
    if (catchupMode) {
      advanceCatchup(confirmedOptionalSkips);
      return;
    }
    if (!isLastVisible) {
      setQuestionIndex((idx) => idx + 1);
      return;
    }
    enterCatchupOrReview(confirmedOptionalSkips);
  };

  const goSkip = () => {
    if (!currentQuestion || submitting) return;
    persistDraft();
    if (catchupMode) {
      if (isRequiredQuestion(currentQuestion)) {
        toast("This question is required. Please choose an answer to finish the section.");
        return;
      }
      const nextConfirmed = new Set(confirmedOptionalSkips);
      nextConfirmed.add(currentQuestion.id);
      setConfirmedOptionalSkips(nextConfirmed);
      advanceCatchup(nextConfirmed, questionIndex);
      return;
    }
    if (!isLastVisible) {
      setQuestionIndex((idx) => idx + 1);
      return;
    }
    enterCatchupOrReview(confirmedOptionalSkips);
  };

  const enterCatchupOrReview = (confirmed = confirmedOptionalSkips) => {
    const pending = pendingCatchupItems(visibleQuestions, answers, confirmed);
    if (pending.length === 0) {
      setCatchupMode(false);
      setReviewMode(true);
      return;
    }
    setCatchupMode(true);
    setReviewMode(false);
    setQuestionIndex(pending[0].idx);
    toast(
      pending.length === 1
        ? "One skipped question still needs your attention before you can save this section."
        : `${pending.length} skipped questions still need your attention before you can save this section.`
    );
  };

  const advanceCatchup = (confirmed = confirmedOptionalSkips, excludeIndex = -1) => {
    const pending = pendingCatchupItems(visibleQuestions, answers, confirmed).filter(
      (item) => item.idx !== excludeIndex
    );
    if (pending.length === 0) {
      setCatchupMode(false);
      setReviewMode(true);
      return;
    }
    const after = pending.find((item) => item.idx > questionIndex);
    setQuestionIndex((after || pending[0]).idx);
  };

  const jumpToQuestion = (idx) => {
    setReviewMode(false);
    setQuestionIndex(idx);
  };

  const goBack = async () => {
    if (reviewMode) {
      setReviewMode(false);
      return;
    }
    if (questionIndex > 0) {
      setQuestionIndex((idx) => idx - 1);
      return;
    }
    if (currentSectionIdx > 0) {
      await handleSectionClick(sections[currentSectionIdx - 1], "end");
    }
  };

  const saveSection = async () => {
    if (!canSubmitSection) {
      toast("Answer all required questions before submitting.");
      return;
    }
    setSubmitting(true);
    const saved = await handleSubmit();
    setSubmitting(false);
    if (!saved) return;

    setReviewMode(false);
    const next = getNextSection();
    if (next) {
      toast("Section saved. Moving to the next section.");
      await handleSectionClick(next, "start");
      return;
    }
    toast("Section saved. Scores have been updated.");
  };

  const saveAndExit = async () => {
    persistDraft();
    if (canSubmitSection && selectedSection) {
      setSubmitting(true);
      await handleSubmit();
      setSubmitting(false);
      toast("Section saved. Returning to dashboard.");
    } else {
      toast("Progress saved as a draft. Returning to dashboard.");
    }
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

  const isGateQuestion = isProductionSection && currentQuestion?.id === manufacturingGateQuestionId;
  const catchupRequired = catchupMode && isRequiredQuestion(currentQuestion);
  const kicker = catchupMode
    ? catchupRequired
      ? "Skipped — required"
      : "Skipped — optional"
    : currentQuestion?.type === "multipleSelect"
      ? "Select all that apply"
      : currentQuestion?.type === "multipleChoice"
        ? isGateQuestion
          ? "Production applicability check"
          : "Choose one"
        : "Optional notes";

  const helper = catchupMode
    ? catchupRequired
      ? "You skipped this required question. Choose an answer to finish the section."
      : "You skipped this optional question. Answer it now, or skip it again to leave it blank."
    : isGateQuestion
      ? "If you are not a manufacturing company, the remaining Production questions are skipped and this section is marked not applicable."
      : currentQuestion?.type === "text"
        ? "Add any notes that help complete this section, or continue without one."
        : "";

  const showCoach = !catchupMode && Boolean(
    (selectedSection?.beginningText && questionIndex === 0) ||
    (selectedSection?.endingText && isLastVisible) ||
    isNonManufacturing
  );
  const coachCopy = selectedSection?.beginningText && questionIndex === 0
    ? selectedSection.beginningText
    : selectedSection?.endingText && isLastVisible
      ? selectedSection.endingText
      : isNonManufacturing
        ? "The remaining Production questions are skipped and will not penalize Product / Service scoring."
        : "";

  const continueLabel = catchupMode
    ? isLastCatchup
      ? "Review section →"
      : "Continue →"
    : isLastVisible
      ? pendingCatchup.length > 0
        ? "Review skipped →"
        : "Review section →"
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
          Completed sections can be reviewed and edited. In-progress sections keep their saved draft.
        </div>
        {sections.map((section) => {
          const status = sectionStatus(section);
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
                  status === "done"
                    ? { background: "#E8F4EA", color: "#166534" }
                    : status === "current"
                      ? { background: "#EEF5FA", color: "#2E6BB0" }
                      : status === "in-progress"
                        ? { background: "#FFF5D5", color: "#854D0E" }
                        : undefined
                }
              >
                {status === "done" ? "✓" : section.order}
              </div>
              <div>
                <strong>{section.title}</strong>
                <br />
                <span>
                  {status === "current"
                    ? "Current section"
                    : status === "done"
                      ? "Completed — tap to review"
                      : status === "in-progress"
                        ? "Draft saved"
                        : section.order === 19
                          ? "Includes applicability check"
                          : "Not started"}
                </span>
              </div>
              <span>{status === "current" ? `${sectionPercent}%` : status === "done" ? "Review" : "Open"}</span>
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

  if (hasAssessmentAccess === false) {
    return (
      <LockedFeature
        title="Business Health Check Assessment"
        body="The assessment stays locked until you purchase, or apply a promo code to begin for free."
        onRequestPurchase={onRequestPurchase}
        onBrowseResources={() => setActiveView?.("resources")}
      />
    );
  }

  return (
    <div className="page assessment-page">
      <div className="assessment-stage">
        <aside className="assessment-side panel">
          <div>
            <div className="side-eyebrow">Business Health Check</div>
            <h3>Your Assessment</h3>
          </div>
          <div>
            <div className="progress-meta">
              <span>Overall progress</span>
              <strong>{overallPercent}%</strong>
            </div>
            <div className="track">
              <span style={{ width: `${overallPercent}%` }} />
            </div>
            <div className="progress-meta" style={{ marginTop: 8 }}>
              <span>{completedSections.length} of {sections.length || 21} sections complete</span>
            </div>
          </div>
          <div className="side-full-list">
            <div className="side-eyebrow" style={{ marginBottom: 8 }}>
              All {sections.length || 21} sections
            </div>
            <div className="section-overview">
              {sections.map((section) => {
                const status = sectionStatus(section);
                return (
                  <button
                    type="button"
                    key={section.id}
                    className={`section-row${status === "current" ? " active" : ""}${status === "done" ? " done" : ""}${status === "in-progress" ? " inprogress" : ""}`}
                    onClick={() => handleSectionClick(section)}
                  >
                    <div className="section-num">{status === "done" ? "✓" : section.order}</div>
                    <div className="section-row-copy">
                      <div className="section-row-title">{section.title}</div>
                      <small>
                        {status === "current"
                          ? `${Math.min(questionIndex + 1, sectionTotal)} / ${sectionTotal || 0}`
                          : status === "done"
                            ? "Complete"
                            : status === "in-progress"
                              ? "Draft"
                              : "Not started"}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="assessment-main">
          <div className="page-head assessment-head">
            <div>
              <h1>{selectedSection?.title || "Assessment"}</h1>
              <p>
                {catchupMode
                  ? pendingCatchup.length
                    ? `Follow-up · ${pendingCatchup.length} skipped left`
                    : "Follow-up complete"
                  : `Section ${selectedSection?.order || currentSectionIdx + 1} of ${sections.length || 21}${
                      sectionTotal ? ` · Question ${Math.min(questionIndex + 1, sectionTotal)} of ${sectionTotal}` : ""
                    } · ${sectionPercent}% answered`}
              </p>
            </div>
            <div className="actions">
              <button type="button" className="btn btn-secondary sections-mobile" onClick={() => setDrawerOpen(true)}>
                Sections
              </button>
              <button type="button" className="btn btn-primary" onClick={saveAndExit}>
                Save & exit
              </button>
            </div>
          </div>
          <div className="walkthrough">

            {!reviewMode && sectionTotal > 1 ? (
              <div className="dots-row" role="list" aria-label="Questions in this section">
                {visibleQuestions.map((q, idx) => {
                  const answered = isAnswered(q, answers);
                  const visited = visitedIds.has(q.id);
                  const state = idx === questionIndex
                    ? "current"
                    : answered
                      ? "answered"
                      : visited
                        ? "skipped"
                        : "unvisited";
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={`dot dot-${state}`}
                      onClick={() => jumpToQuestion(idx)}
                      aria-label={`Question ${idx + 1}${answered ? ", answered" : visited ? ", skipped" : ""}`}
                      title={`Question ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {reviewMode ? (
              <section className="question-card panel review-card">
                <div className="question-kicker">Section review</div>
                <h2>Ready to save this section?</h2>
                <p className="helper">
                  {canSubmitSection
                    ? pendingCatchup.length === 0
                      ? "Every skipped question has been reviewed. Save this section to record your scores."
                      : "Every required question has an answer. Save this section to record your scores."
                    : "Answer the remaining required questions before this section can be saved."}
                </p>
                <div className="review-list">
                  {visibleQuestions.map((q, idx) => {
                    const answered = isAnswered(q, answers);
                    const required = isRequiredQuestion(q);
                    return (
                      <div className="review-row" key={q.id}>
                        <div className="review-row-num">{idx + 1}</div>
                        <div className="review-row-text">{q.text}</div>
                        <span
                          className={`pill-status ${answered ? "ok" : required ? "missing" : "optional"}`}
                        >
                          {answered ? "Answered" : required ? "Required" : "Optional — skipped"}
                        </span>
                        <button type="button" className="review-jump" onClick={() => jumpToQuestion(idx)}>
                          {answered ? "Edit" : "Answer"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="walkthrough-footer">
                  <div className="left-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setReviewMode(false)}>
                      ← Back to questions
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canSubmitSection || submitting}
                    onClick={saveSection}
                  >
                    {submitting
                      ? "Saving…"
                      : isLastSection
                        ? "Finish Assessment →"
                        : existingSubmission
                          ? "Save Changes →"
                          : "Save Section →"}
                  </button>
                </div>
              </section>
            ) : (
              <section className={`question-card panel${catchupMode ? " catchup-card" : ""}`}>
                {currentQuestion ? (
                  <>
                    <div className="question-kicker">{kicker}</div>
                    <h2>{currentQuestion.text}</h2>
                    {helper ? <p className="helper">{helper}</p> : null}

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
                        rows={3}
                        value={answers[currentQuestion.id] || ""}
                        onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                        placeholder="Optional notes"
                      />
                    )}

                    {showCoach && coachCopy ? (
                      <div className="mini-coach">
                        <div className="coach-icon">i</div>
                        <div>
                          <strong>Why we ask this</strong>
                          <p>{coachCopy}</p>
                        </div>
                      </div>
                    ) : null}

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
                        {catchupRequired ? null : (
                          <button type="button" className="btn btn-ghost" onClick={goSkip}>
                            {catchupMode ? "Skip anyway" : "Skip"}
                          </button>
                        )}
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
            )}
          </div>
        </div>
      </div>
      {drawer}
    </div>
  );
}
