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
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebaseConfig";

export default function AssessmentUser() {
  const [mobileSideContentOpen, setMobileSideContentOpen] = useState(false);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [answers, setAnswers] = useState({});
  const [completedSections, setCompletedSections] = useState([]);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [isEditMode, setIsEditMode] = useState(true);

  const auth = getAuth();
  const user = auth.currentUser;

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
        where("userId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const completed = querySnapshot.docs.map(
        (docSnap) => docSnap.data().sectionName
      );
      setCompletedSections([...new Set(completed)]);
    } catch (error) {
      console.error("Error fetching completed sections:", error);
    }
  }

  useEffect(() => {
    fetchCompletedSections();
  }, [user]);

  // Handle section selection
  const handleSectionClick = async (section) => {
    setSelectedSection(section);
    setAnswers({});
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
    const unanswered = selectedSection.questions.filter((q) => {
      const ans = answers[q.id];
      return q.type === "multipleSelect" ? !ans || ans.length === 0 : !ans || ans === "";
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
    selectedSection.questions.forEach((q) => {
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
    };

    try {
      if (existingSubmission) {
        await updateDoc(doc(db, "sectionResults", existingSubmission.id), submission);
        alert("Your answers have been updated successfully!");
      } else {
        const newDoc = await addDoc(collection(db, "sectionResults"), submission);
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
          computedScores[categoryKey].sections[sectionNumber] = sectionScore;
          computedScores[categoryKey].total = Object.values(
            computedScores[categoryKey].sections
          ).reduce((sum, val) => sum + (val || 0), 0);
        }
      });

      await updateDoc(userDocRef, { computedScores });
    } catch (error) {
      console.error("Error submitting/updating answers:", error);
      alert("There was an error submitting your answers. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-white shadow-lg p-6 sticky top-0 z-10 rounded-2xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Business Health Check Assessment
          </h1>
          <button
            onClick={() => setMobileSideContentOpen(!mobileSideContentOpen)}
            className="lg:hidden p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            {mobileSideContentOpen ? "Close" : "Sections"}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row p-6 gap-6">
        {/* Sidebar */}
        <aside
          className={`w-full lg:w-80 Bg-[#101b31] backdrop-blur-sm rounded-2xl p-6 transition-all duration-300 ${
            mobileSideContentOpen ? "block" : "hidden lg:block"
          }`}
        >
          <h2 className="text-xl font-semibold text-white mb-4">Assessment Sections</h2>
          {/* Progress Indicator */}
          <div className="mt-6 mb-6">
            <div className="text-sm font-medium text-white mb-2">
              Progress: {completedSections.length}/{sections.length} sections
            </div>
            <div className="w-full bg-gray-700 h-2 rounded-full">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${(completedSections.length / sections.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="space-y-3">
            {sections.length > 0 ? (
              sections.map((section) => {
                const isCompleted = completedSections.includes(section.title);
                const isActive = selectedSection?.id === section.id;
                return (
                  <div
                    key={section.id}
                    onClick={() => handleSectionClick(section)}
                    className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                      isActive
                        ? "bg-emerald-500/20 border-emerald-500 border"
                        : isCompleted
                        ? "bg-green-500/10 border-green-500 border"
                        : "bg-gray-700/50 border-gray-600 border"
                    } hover:bg-gray-600/70`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium text-white">{section.title}</h3>
                      {isCompleted ? (
                        <span className="text-green-400 text-xs">✓ Completed</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Pending</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {section.questions?.length || 0} questions
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-400 text-sm">Loading sections...</p>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-white rounded-2xl shadow-xl p-8">
          {selectedSection ? (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {selectedSection.title}
                </h2>
                {existingSubmission && !isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                  >
                    Edit Answers
                  </button>
                )}
              </div>
              {selectedSection.beginningText && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-gray-600">
                  {selectedSection.beginningText}
                </div>
              )}

              {selectedSection.questions && selectedSection.questions.length > 0 ? (
                <>
                  {existingSubmission && !isEditMode ? (
                    // Read-Only View
                    <div className="space-y-4">
                      {selectedSection.questions.map((question, qIndex) => (
                        <div
                          key={question.id || qIndex}
                          className="p-6 bg-gray-50 rounded-lg border border-gray-100"
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
                      {selectedSection.questions.map((question, qIndex) => (
                        <div
                          key={question.id || qIndex}
                          className="p-6 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <p className="font-semibold text-gray-900 mb-3">
                            {qIndex + 1}. {question.text}
                          </p>
                          {question.type === "multipleChoice" && question.options ? (
                            <div className="space-y-2">
                              {question.options.map((option, oIndex) => (
                                <label
                                  key={oIndex}
                                  className="flex items-center cursor-pointer p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={option.label}
                                    checked={answers[question.id] === option.label}
                                    onChange={(e) =>
                                      handleRadioAnswerChange(question.id, e.target.value)
                                    }
                                    className="w-4 h-4 text-emerald-500 focus:ring-emerald-400"
                                  />
                                  <span className="ml-3 text-gray-700">{option.label}</span>
                                </label>
                              ))}
                            </div>
                          ) : question.type === "multipleSelect" && question.options ? (
                            <div className="space-y-2">
                              {question.options.map((option, oIndex) => (
                                <label
                                  key={oIndex}
                                  className="flex items-center cursor-pointer p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    name={`question-${question.id}`}
                                    value={option.label}
                                    checked={
                                      answers[question.id]?.includes(option.label) || false
                                    }
                                    onChange={() =>
                                      handleCheckboxAnswerChange(question.id, option.label)
                                    }
                                    className="w-4 h-4 text-emerald-500 focus:ring-emerald-400"
                                  />
                                  <span className="ml-3 text-gray-700">{option.label}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <input
                              type="text"
                              name={`question-${question.id}`}
                              value={answers[question.id] || ""}
                              onChange={(e) =>
                                handleTextAnswerChange(question.id, e.target.value)
                              }
                              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500"
                              placeholder="Your answer"
                            />
                          )}
                        </div>
                      ))}
                      {selectedSection.endingText && (
                        <div className="p-4 bg-gray-50 rounded-lg text-gray-600">
                          {selectedSection.endingText}
                        </div>
                      )}
                      <div className="flex justify-end gap-4">
                        {existingSubmission && (
                          <button
                            type="button"
                            onClick={() => setIsEditMode(false)}
                            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                        >
                          {existingSubmission ? "Save Changes" : "Submit Answers"}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No questions available for this section.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center py-16">
                <h3 className="text-xl font-semibold text-gray-900">
                  Welcome to the BHC Assessment
                </h3>
                <p className="mt-2 text-gray-600">
                  Select a section from the sidebar to begin evaluating your business.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}