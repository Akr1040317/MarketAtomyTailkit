import React, { useState, useEffect } from "react";
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

export default function AssessmentUser() {
  const [mobileSideContentOpen, setMobileSideContentOpen] = useState(false);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [answers, setAnswers] = useState({});
  const [completedSections, setCompletedSections] = useState([]);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [isEditMode, setIsEditMode] = useState(true);
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

  const auth = getAuth();
  const user = auth.currentUser;

  const isAssessmentComplete =
    sections.length > 0 && completedSections.length === sections.length;

  const isProductionSection = selectedSection?.order === 19;
  const manufacturingGateIndex =
    isProductionSection && selectedSection?.questions?.length
      ? selectedSection.questions.findIndex((q, idx) => {
          const t = (q?.text || "").toLowerCase();
          return idx === 0 || t.includes("manufacturing company");
        })
      : -1;
  const manufacturingGateQuestionId =
    manufacturingGateIndex >= 0 ? selectedSection.questions[manufacturingGateIndex]?.id : null;
  const isNonManufacturing =
    isProductionSection &&
    manufacturingGateQuestionId &&
    String(answers[manufacturingGateQuestionId] || "").toLowerCase() === "no";

  const getNextSection = () => {
    if (!selectedSection || sections.length === 0) return null;
    const idx = sections.findIndex((s) => s.id === selectedSection.id);
    if (idx < 0) return null;
    return sections[idx + 1] || null;
  };

  const computeSectionMaxExcludingGate = (section) => {
    if (!section?.questions || section.questions.length === 0) return 0;
    let total = 0;
    section.questions.forEach((q, idx) => {
      if (section.order === 19 && idx === manufacturingGateIndex) return; // exclude gate
      if (q.type === "multipleChoice" && Array.isArray(q.options)) {
        const max = q.options.reduce((m, o) => Math.max(m, o.weight || 0), 0);
        total += max;
      } else if (q.type === "multipleSelect" && Array.isArray(q.options)) {
        // UI allows multiple selections; approximate max as sum of positive weights.
        total += q.options.reduce((sum, o) => sum + Math.max(0, o.weight || 0), 0);
      }
    });
    return total;
  };

  const checkFeedbackAlreadySubmitted = async () => {
    if (!user) return false;
    const snap = await getDocs(
      query(
        collection(db, "assessmentFeedback"),
        where("userId", "==", user.uid),
        limit(1)
      )
    );
    return !snap.empty;
  };

  // Fetch sections
  useEffect(() => {
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
          setSelectedSection(sectionsData[0]);
          handleSectionClick(sectionsData[0]);
        }
      } catch (error) {
        console.error("Error fetching sections: ", error);
      }
    }
    fetchSections();
  }, []);

  // Fetch completed sections
  async function fetchCompletedSections() {
    if (!user) return;
    try {
      const q = query(
        collection(db, "sectionResults"),
        where("userId", "==", user.uid),
      );
      const querySnapshot = await getDocs(q);
      const completed = querySnapshot.docs.map(
        (docSnap) => docSnap.data().sectionName,
      );
      setCompletedSections([...new Set(completed)]);
    } catch (error) {
      console.error("Error fetching completed sections:", error);
    }
  }

  useEffect(() => {
    fetchCompletedSections();
  }, [user]);

  useEffect(() => {
    // When the assessment becomes complete, prompt feedback (once).
    const run = async () => {
      if (!user) return;
      if (!isAssessmentComplete) return;
      if (feedbackSubmitted) return;
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

  // Handle section selection
  const handleSectionClick = async (section) => {
    setSelectedSection(section);
    setAnswers({});
    if (user) {
      try {
        const q = query(
          collection(db, "sectionResults"),
          where("userId", "==", user.uid),
          where("sectionName", "==", section.title),
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.docs.length > 0) {
          const docSnap = querySnapshot.docs[0];
          const data = docSnap.data();
          setExistingSubmission({ id: docSnap.id, data });

          const normalizedAnswers = {};
          if (section.questions && section.questions.length > 0) {
            section.questions.forEach((qItem) => {
              const storedAnswer = data.answers[qItem.id];
              if (!storedAnswer) return;

              if (qItem.type === "multipleChoice") {
                normalizedAnswers[qItem.id] = storedAnswer.answer;
              } else if (qItem.type === "multipleSelect") {
                normalizedAnswers[qItem.id] = Array.isArray(storedAnswer)
                  ? storedAnswer.map((a) => a.answer)
                  : [];
              } else {
                normalizedAnswers[qItem.id] = storedAnswer.answer;
              }
            });
          }
          setAnswers(normalizedAnswers);
          setIsEditMode(false);
        } else {
          setExistingSubmission(null);
          setIsEditMode(true);
        }
      } catch (error) {
        console.error("Error fetching submission for section:", error);
      }
    }
    setMobileSideContentOpen(false);
  };

  // Answer handlers
  const handleTextAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleRadioAnswerChange = (questionId, value) => {
    // Section 19 manufacturing gate: if "No", skip the rest of the section.
    if (isProductionSection && questionId === manufacturingGateQuestionId) {
      setAnswers((prev) => {
        const next = { ...prev, [questionId]: value };
        if (String(value).toLowerCase() === "no" && selectedSection?.questions) {
          selectedSection.questions.forEach((q, idx) => {
            if (idx !== manufacturingGateIndex) delete next[q.id];
          });
        }
        return next;
      });
      return;
    }
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleCheckboxAnswerChange = (questionId, optionLabel) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      return {
        ...prev,
        [questionId]: current.includes(optionLabel)
          ? current.filter((item) => item !== optionLabel)
          : [...current, optionLabel],
      };
    });
  };

  // Handle submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const unanswered = selectedSection.questions.filter((q, idx) => {
      if (isNonManufacturing && idx !== manufacturingGateIndex) return false;
      const ans = answers[q.id];
      return q.type === "multipleSelect"
        ? !ans || ans.length === 0
        : !ans || ans === "";
    });

    if (unanswered.length > 0) {
      alert("Please answer all questions before submitting.");
      return;
    }

    if (!user) {
      alert("User not logged in. Please log in to submit your answers.");
      return;
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
        await updateDoc(
          doc(db, "sectionResults", existingSubmission.id),
          submission,
        );
        alert("Your answers have been updated successfully!");
      } else {
        const newDoc = await addDoc(
          collection(db, "sectionResults"),
          submission,
        );
        alert("Your answers have been submitted successfully!");
        setExistingSubmission({ id: newDoc.id, data: submission });
      }
      fetchCompletedSections();
      setIsEditMode(false);

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      let userData = userDocSnap.exists() ? userDocSnap.data() : {};
      let computedScores = userData.computedScores || {
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
          // If Section 19 is not applicable (non-manufacturing), don't penalize product/service scoring.
          if (sectionNumber === 19 && isNonManufacturing) {
            delete computedScores[categoryKey].sections[sectionNumber];
          } else {
            computedScores[categoryKey].sections[sectionNumber] = sectionScore;
          }
          computedScores[categoryKey].total = Object.values(
            computedScores[categoryKey].sections,
          ).reduce((sum, val) => sum + (val || 0), 0);
        }
      });

      // Optional scoring adjustment: if non-manufacturing, reduce Product/Service maxPossible by Section 19 production questions.
      if (isProductionSection) {
        if (isNonManufacturing) {
          const baseMax = getCategoryMaxScore("productService");
          const section19Max = computeSectionMaxExcludingGate(selectedSection);
          computedScores.productService.maxPossible = Math.max(0, baseMax - section19Max);
        } else if (computedScores.productService?.maxPossible) {
          delete computedScores.productService.maxPossible;
        }
      }

      // Process scores to add analytics (percentages, health levels)
      const enhancedScores = processComputedScores(computedScores);
      
      // Update computedScores with enhanced analytics
      Object.keys(enhancedScores).forEach((categoryKey) => {
        if (categoryKey !== 'overallHealth' && computedScores[categoryKey]) {
          computedScores[categoryKey] = {
            ...computedScores[categoryKey],
            ...enhancedScores[categoryKey],
          };
        }
      });

      // Add overall health if available
      const updateData = {
        computedScores,
      };
      if (enhancedScores.overallHealth) {
        updateData.overallHealth = enhancedScores.overallHealth;
      }

      await updateDoc(userDocRef, updateData);

      // If non-manufacturing, this section is effectively done; move to next section for convenience.
      if (isNonManufacturing) {
        const next = getNextSection();
        if (next) {
          handleSectionClick(next);
        }
      }

      // If assessment is complete, prompt feedback.
      try {
        const already = await checkFeedbackAlreadySubmitted();
        if (!already) setShowFeedbackForm(true);
      } catch {}
    } catch (error) {
      console.error("Error submitting/updating answers:", error);
      alert("There was an error submitting your answers. Please try again.");
    }
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
      alert("Thanks! Your feedback has been submitted.");
    } catch (err) {
      console.error("Feedback submit failed:", err);
      alert("Could not submit feedback. Please try again.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 rounded-2xl bg-white p-6 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Business Health Check Assessment
          </h1>
          <button
            onClick={() => setMobileSideContentOpen(!mobileSideContentOpen)}
            className="rounded-lg bg-emerald-500 p-2 text-white transition-colors hover:bg-emerald-600 lg:hidden"
          >
            {mobileSideContentOpen ? "Close" : "Sections"}
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 lg:flex-row">
        {/* Sidebar */}
        <aside
          className={`Bg-[#101b31] w-full rounded-2xl p-8 backdrop-blur-sm transition-all duration-300 lg:w-96 ${
            mobileSideContentOpen ? "block" : "hidden lg:block"
          }`}
        >
          <h2 className="mb-6 text-2xl font-semibold text-white">
            Assessment Sections
          </h2>
          {/* Progress Indicator */}
          <div className="mt-6 mb-8">
            <div className="mb-3 text-base font-medium text-white">
              Progress: {completedSections.length}/{sections.length} sections
            </div>
            <div className="h-3 w-full rounded-full bg-gray-700">
              <div
                className="h-3 rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${(completedSections.length / sections.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="space-y-4">
            {sections.length > 0 ? (
              sections.map((section) => {
                const isCompleted = completedSections.includes(section.title);
                const isActive = selectedSection?.id === section.id;
                return (
                  <div
                    key={section.id}
                    onClick={() => handleSectionClick(section)}
                    className={`cursor-pointer rounded-lg p-5 transition-all duration-200 ${
                      isActive
                        ? "border-2 border-emerald-500 bg-emerald-500/20"
                        : isCompleted
                          ? "border-2 border-green-500 bg-green-500/10"
                          : "border-2 border-gray-600 bg-gray-700/50"
                    } hover:bg-gray-600/70`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white">
                        {section.title}
                      </h3>
                      {isCompleted ? (
                        <span className="text-sm font-medium text-green-400">
                          ✓ Completed
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Pending</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-400">
                      {section.questions?.length || 0} questions
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-base text-gray-400">Loading sections...</p>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 rounded-2xl bg-white p-8 shadow-xl">
          {isAssessmentComplete && showFeedbackForm && !feedbackSubmitted && (
            <section className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Quick feedback (2 minutes)
                  </h2>
                  <p className="mt-1 text-sm text-gray-700">
                    Help us improve the assessment experience. This is optional.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFeedbackForm(false)}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Skip for now
                </button>
              </div>

              <form onSubmit={submitFeedback} className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-900">
                    Overall experience (1–5)
                  </span>
                  <select
                    value={feedback.overallRating}
                    onChange={(e) =>
                      setFeedback((p) => ({ ...p, overallRating: e.target.value }))
                    }
                    required
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    <option value="1">1 - Poor</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5 - Excellent</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-gray-900">
                    Clarity of questions (1–5)
                  </span>
                  <select
                    value={feedback.clarityRating}
                    onChange={(e) =>
                      setFeedback((p) => ({ ...p, clarityRating: e.target.value }))
                    }
                    required
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    <option value="1">1 - Not clear</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5 - Very clear</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-gray-900">
                    Relevance to your business (1–5)
                  </span>
                  <select
                    value={feedback.relevanceRating}
                    onChange={(e) =>
                      setFeedback((p) => ({ ...p, relevanceRating: e.target.value }))
                    }
                    required
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    <option value="1">1 - Not relevant</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5 - Very relevant</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-gray-900">
                    Assessment length
                  </span>
                  <select
                    value={feedback.length}
                    onChange={(e) =>
                      setFeedback((p) => ({ ...p, length: e.target.value }))
                    }
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <option value="too_short">Too short</option>
                    <option value="just_right">Just right</option>
                    <option value="too_long">Too long</option>
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Most valuable sections (select any)
                  </span>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={feedback.mostValuableSections.includes(s.title)}
                          onChange={() =>
                            setFeedback((p) => {
                              const current = p.mostValuableSections;
                              const next = current.includes(s.title)
                                ? current.filter((t) => t !== s.title)
                                : [...current, s.title];
                              return { ...p, mostValuableSections: next };
                            })
                          }
                          className="h-4 w-4 text-emerald-500"
                        />
                        <span className="line-clamp-1">{s.title}</span>
                      </label>
                    ))}
                  </div>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Any confusing questions? (optional)
                  </span>
                  <textarea
                    value={feedback.confusingQuestions}
                    onChange={(e) =>
                      setFeedback((p) => ({ ...p, confusingQuestions: e.target.value }))
                    }
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3"
                    rows={3}
                    placeholder="Which questions felt unclear, and why?"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-gray-900">
                    What should we add? (optional)
                  </span>
                  <textarea
                    value={feedback.missingTopics}
                    onChange={(e) =>
                      setFeedback((p) => ({ ...p, missingTopics: e.target.value }))
                    }
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3"
                    rows={3}
                    placeholder="Any topics or questions you expected but didn’t see?"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-gray-900">
                    Likelihood to recommend (0–10)
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={feedback.recommendScore}
                    onChange={(e) =>
                      setFeedback((p) => ({ ...p, recommendScore: e.target.value }))
                    }
                    required
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-3"
                    placeholder="0 to 10"
                  />
                </label>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={feedbackLoading}
                    className="rounded-lg bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {feedbackLoading ? "Submitting…" : "Submit Feedback"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {selectedSection ? (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                  {selectedSection.title}
                </h2>
                {existingSubmission && !isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm text-white transition-colors hover:bg-emerald-600"
                  >
                    Edit Answers
                  </button>
                )}
              </div>
              {selectedSection.beginningText && (
                <div className="mt-4 rounded-lg bg-gray-50 p-4 text-gray-600">
                  {selectedSection.beginningText}
                </div>
              )}

              {selectedSection.questions &&
              selectedSection.questions.length > 0 ? (
                <>
                  {existingSubmission && !isEditMode ? (
                    // Read-Only View
                    <div className="space-y-4">
                      {selectedSection.questions.map((question, qIndex) => (
                        <div
                          key={question.id || qIndex}
                          className="rounded-lg border border-gray-100 bg-gray-50 p-6"
                        >
                          <p className="font-semibold text-gray-900">
                            {qIndex + 1}. {question.text}
                          </p>
                          <p className="mt-2 text-gray-600">
                            <span className="font-medium">Your Answer:</span>{" "}
                            {Array.isArray(answers[question.id])
                              ? answers[question.id].join(", ")
                              : answers[question.id] || "No answer provided"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Editable Form
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {selectedSection.questions.map((question, qIndex) => {
                        if (isNonManufacturing && qIndex !== manufacturingGateIndex) {
                          return null;
                        }
                        return (
                        <div
                          key={question.id || qIndex}
                          className="rounded-lg border border-gray-100 bg-gray-50 p-6"
                        >
                          <p className="mb-3 font-semibold text-gray-900">
                            {qIndex + 1}. {question.text}
                          </p>
                          {question.type === "multipleChoice" &&
                          question.options ? (
                            <div className="space-y-2">
                              {question.options.map((option, oIndex) => (
                                <label
                                  key={oIndex}
                                  className="flex cursor-pointer items-center rounded-lg p-2 transition-colors hover:bg-gray-100"
                                >
                                  <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={option.label}
                                    checked={
                                      answers[question.id] === option.label
                                    }
                                    onChange={(e) =>
                                      handleRadioAnswerChange(
                                        question.id,
                                        e.target.value,
                                      )
                                    }
                                    className="h-4 w-4 text-emerald-500 focus:ring-emerald-400"
                                  />
                                  <span className="ml-3 text-gray-700">
                                    {option.label}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : question.type === "multipleSelect" &&
                            question.options ? (
                            <div className="space-y-2">
                              {question.options.map((option, oIndex) => (
                                <label
                                  key={oIndex}
                                  className="flex cursor-pointer items-center rounded-lg p-2 transition-colors hover:bg-gray-100"
                                >
                                  <input
                                    type="checkbox"
                                    name={`question-${question.id}`}
                                    value={option.label}
                                    checked={
                                      answers[question.id]?.includes(
                                        option.label,
                                      ) || false
                                    }
                                    onChange={() =>
                                      handleCheckboxAnswerChange(
                                        question.id,
                                        option.label,
                                      )
                                    }
                                    className="h-4 w-4 text-emerald-500 focus:ring-emerald-400"
                                  />
                                  <span className="ml-3 text-gray-700">
                                    {option.label}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <input
                              type="text"
                              name={`question-${question.id}`}
                              value={answers[question.id] || ""}
                              onChange={(e) =>
                                handleTextAnswerChange(
                                  question.id,
                                  e.target.value,
                                )
                              }
                              className="w-full rounded-lg border border-gray-200 p-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400"
                              placeholder="Your answer"
                            />
                          )}
                        </div>
                      )})}
                      {isNonManufacturing && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                          Since you’re not a manufacturing company, the production questions are optional and have been skipped.
                          Click “Submit Answers” to mark this section complete and continue.
                        </div>
                      )}
                      {selectedSection.endingText && (
                        <div className="rounded-lg bg-gray-50 p-4 text-gray-600">
                          {selectedSection.endingText}
                        </div>
                      )}
                      <div className="flex justify-end gap-4">
                        {existingSubmission && (
                          <button
                            type="button"
                            onClick={() => setIsEditMode(false)}
                            className="rounded-lg bg-gray-500 px-6 py-2 text-white transition-colors hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-500 px-6 py-2 text-white transition-colors hover:bg-emerald-600"
                        >
                          {existingSubmission
                            ? "Save Changes"
                            : "Submit Answers"}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <p className="py-8 text-center text-gray-500">
                  No questions available for this section.
                </p>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              <div className="py-16 text-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  Welcome to the BHC Assessment
                </h3>
                <p className="mt-2 text-gray-600">
                  Select a section from the sidebar to begin evaluating your
                  business.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
