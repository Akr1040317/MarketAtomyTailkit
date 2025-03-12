// AssessmentUser.jsx
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
  // Mobile toggle for side content
  const [mobileSideContentOpen, setMobileSideContentOpen] = useState(false);
  // Sections fetched from Firestore
  const [sections, setSections] = useState([]);
  // The section currently selected by the user
  const [selectedSection, setSelectedSection] = useState(null);
  // Stores the user's answers for the selected section's questions (raw strings or arrays)
  const [answers, setAnswers] = useState({});
  // Stores the section names that the current user has completed
  const [completedSections, setCompletedSections] = useState([]);
  // Stores an existing submission (if any) for the selected section
  const [existingSubmission, setExistingSubmission] = useState(null);
  // Controls whether the answers are editable
  const [isEditMode, setIsEditMode] = useState(true);

  const auth = getAuth();
  const user = auth.currentUser;

  // Fetch sections from BHC_Assessment collection
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
      } catch (error) {
        console.error("Error fetching sections: ", error);
      }
    }
    fetchSections();
  }, []);

  // Fetch completed sections for the current user from sectionResults collection
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
      // Remove duplicates if any
      const uniqueCompleted = [...new Set(completed)];
      setCompletedSections(uniqueCompleted);
    } catch (error) {
      console.error("Error fetching completed sections:", error);
    }
  }

  // Run once on mount (and when user changes)
  useEffect(() => {
    fetchCompletedSections();
  }, [user]);

  // When a section is clicked, set it as the selected section and fetch any existing submission.
  const handleSectionClick = async (section) => {
    setSelectedSection(section);
    setAnswers({});
    // Fetch existing submission for the selected section (if any)
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

          // Store the original submission doc
          setExistingSubmission({ id: docSnap.id, data });

          // Normalize the fetched answers so that `answers` in state
          // only has raw values (strings or arrays of strings).
          const normalizedAnswers = {};

          if (section.questions && section.questions.length > 0) {
            section.questions.forEach((qItem) => {
              const storedAnswer = data.answers[qItem.id];
              if (!storedAnswer) return;

              if (qItem.type === "multipleChoice") {
                // storedAnswer is something like: { answer: "Yes", weight: 2 }
                normalizedAnswers[qItem.id] = storedAnswer.answer;
              } else if (qItem.type === "multipleSelect") {
                // storedAnswer is an array of objects: [{ answer: "Option A", weight: 1 }, ...]
                if (Array.isArray(storedAnswer)) {
                  normalizedAnswers[qItem.id] = storedAnswer.map((a) => a.answer);
                } else {
                  normalizedAnswers[qItem.id] = [];
                }
              } else {
                // e.g. text input => { answer: "some text", weight: null }
                normalizedAnswers[qItem.id] = storedAnswer.answer;
              }
            });
          }

          setAnswers(normalizedAnswers);
          setIsEditMode(false); // Show read-only view by default
        } else {
          setExistingSubmission(null);
          setIsEditMode(true);
        }
      } catch (error) {
        console.error("Error fetching submission for section:", error);
      }
    }
  };

  // For text and other default inputs
  const handleTextAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // For multipleChoice: radio button change
  const handleRadioAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // For multipleSelect: update an array of selected options
  const handleCheckboxAnswerChange = (questionId, optionLabel) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (current.includes(optionLabel)) {
        return { ...prev, [questionId]: current.filter((item) => item !== optionLabel) };
      } else {
        return { ...prev, [questionId]: [...current, optionLabel] };
      }
    });
  };

  // Handle submission (both new and updates)
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check that every question has been answered.
    const unanswered = selectedSection.questions.filter((q) => {
      const ans = answers[q.id];
      // For multipleSelect, ensure there's at least one option
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

    // Process answers and attach weight information if applicable
    let processedAnswers = {};
    let sectionScore = 0; // Sum of weights for the section
    selectedSection.questions.forEach((q) => {
      const ans = answers[q.id];
      if (q.type === "multipleChoice") {
        const option = q.options.find((o) => o.label === ans);
        const weight = option ? option.weight : 0;
        sectionScore += weight;
        processedAnswers[q.id] = {
          answer: ans,
          weight: weight,
        };
      } else if (q.type === "multipleSelect") {
        processedAnswers[q.id] = ans.map((a) => {
          const option = q.options.find((o) => o.label === a);
          const weight = option ? option.weight : 0;
          sectionScore += weight;
          return { answer: a, weight: weight };
        });
      } else {
        processedAnswers[q.id] = {
          answer: ans,
          weight: 0,
        };
      }
    });

    // Prepare the submission object with computed section score
    const submission = {
      userId: user.uid,
      userEmail: user.email,
      submittedAt: serverTimestamp(),
      sectionName: selectedSection.title,
      answers: processedAnswers,
      sectionScore: sectionScore, // New field for section score
    };

    try {
      if (existingSubmission) {
        // Update the existing document
        await updateDoc(doc(db, "sectionResults", existingSubmission.id), submission);
        alert("Your answers have been updated successfully!");
      } else {
        // Create a new submission
        const newDoc = await addDoc(collection(db, "sectionResults"), submission);
        alert("Your answers have been submitted successfully!");
        setExistingSubmission({ id: newDoc.id, data: submission });
      }
      fetchCompletedSections();
      setIsEditMode(false);

      // Now update the user's computedScores in the "users" collection
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      let userData = {};
      if (userDocSnap.exists()) {
        userData = userDocSnap.data();
      }
      // Initialize computedScores map if it doesn't exist
      let computedScores = userData.computedScores || {
        foundationalStructure: { sections: {}, total: 0 },
        financialPosition: { sections: {}, total: 0 },
        salesMarketing: { sections: {}, total: 0 },
        productService: { sections: {}, total: 0 },
        general: { sections: {}, total: 0 },
      };

      // Determine the section number (assuming it's stored in selectedSection.order)
      const sectionNumber = selectedSection.order;

      // Define category mapping: which sections belong to which categories
      const categoryMapping = {
        foundationalStructure: [2, 3, 5, 6, 7],
        financialPosition: [4, 8, 11, 12, 16, 17, 18],
        salesMarketing: [10, 12, 13, 14, 15],
        productService: [8, 9, 19],
        general: [20, 21],
      };

      // Update computedScores for categories that include this section
      Object.keys(categoryMapping).forEach((categoryKey) => {
        if (categoryMapping[categoryKey].includes(sectionNumber)) {
          // Update the score for this section in the category
          computedScores[categoryKey].sections[sectionNumber] = sectionScore;
          // Recalculate the total score for this category
          const totalScore = Object.values(computedScores[categoryKey].sections).reduce(
            (sum, val) => sum + (val || 0),
            0
          );
          computedScores[categoryKey].total = totalScore;
        }
      });

      // Update the user document with the new computedScores
      await updateDoc(userDocRef, { computedScores: computedScores });
    } catch (error) {
      console.error("Error submitting/updating answers:", error);
      alert("There was an error submitting your answers. Please try again.");
    }
  };

  return (
    <div className="overflow-x-hidden bg-[#101b31] min-h-screen">
      {/* Mobile Toggle for Side Content */}
      <div className="w-full bg-gray-50 p-4 lg:hidden lg:p-8 dark:bg-gray-800/25">
        <button
          onClick={() => setMobileSideContentOpen(!mobileSideContentOpen)}
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-xs focus:ring-3 focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
        >
          Toggle Side Content
        </button>
      </div>

      {/* Layout: Left (Side) and Right (Main) Content */}
      <div className="flex flex-col lg:flex-row">
        {/* Left Side Content */}
        <div
          className={`w-full flex-none p-4 lg:w-80 lg:p-8 xl:w-96 dark:bg-gray-800/25 ${
            mobileSideContentOpen ? "" : "hidden"
          } lg:block`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-100">Sections</h2>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
            {sections.length > 0 ? (
              sections.map((section) => {
                // Check if the current section is completed by the user
                const isCompleted = completedSections.includes(section.title);
                return (
                  <div
                    key={section.id}
                    onClick={() => handleSectionClick(section)}
                    className={`w-full rounded-lg shadow p-4 mb-4 cursor-pointer relative border ${
                      isCompleted
                        ? "border-green-500 bg-green-100"
                        : "border-gray-200 dark:border-gray-600 bg-white"
                    }`}
                  >
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                      {section.title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      {section.questions ? section.questions.length : 0} questions
                    </p>
                    {/* Status Icon and Text in Bottom Right */}
                    <span
                      className={`absolute bottom-2 right-2 flex items-center ${
                        isCompleted ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <span className="mr-1">➤</span>
                          <span>Completed</span>
                        </>
                      ) : (
                        <>
                          <span className="mr-1">❌</span>
                          <span>Not Completed</span>
                        </>
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 dark:text-gray-300">No sections found</p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto flex w-full max-w-screen-xl grow flex-col p-4 lg:p-8 min-w-0">
          {selectedSection ? (
            <div>
              {/* Display beginning text (instructions) if available */}
              {selectedSection.beginningText && (
                <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded">
                  <p className="text-gray-800 dark:text-gray-100">
                    {selectedSection.beginningText}
                  </p>
                </div>
              )}

              {selectedSection.questions && selectedSection.questions.length > 0 ? (
                <>
                  {/* Read-Only View if a submission exists and not editing */}
                  {existingSubmission && !isEditMode ? (
                    <div>
                      {selectedSection.questions.map((question, qIndex) => (
                        <div
                          key={question.id || qIndex}
                          className="p-4 bg-white dark:bg-gray-700 rounded-lg shadow mb-4"
                        >
                          <p className="font-bold text-gray-800 dark:text-gray-100">
                            {`Question ${qIndex + 1}: ${question.text}`}
                          </p>
                          <p className="text-gray-800 dark:text-gray-100">
                            Answer:{" "}
                            {(() => {
                              const ans = answers[question.id];
                              if (Array.isArray(ans)) {
                                // multipleSelect: array of strings
                                return ans.join(", ");
                              } else {
                                // multipleChoice or text input: string
                                return ans;
                              }
                            })()}
                          </p>
                        </div>
                      ))}
                      <button
                        onClick={() => setIsEditMode(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                      >
                        Edit Answers
                      </button>
                    </div>
                  ) : (
                    // Editable Form
                    <form className="space-y-6" onSubmit={handleSubmit}>
                      {selectedSection.questions.map((question, qIndex) => (
                        <div
                          key={question.id || qIndex}
                          className="p-4 bg-white dark:bg-gray-700 rounded-lg shadow mb-4"
                        >
                          <p className="font-bold text-gray-800 dark:text-gray-100">
                            {`Question ${qIndex + 1}: ${question.text}`}
                          </p>
                          {/* Render answer input based on question type */}
                          {question.type === "multipleChoice" && question.options ? (
                            <div className="mt-2">
                              {question.options.map((option, oIndex) => (
                                <div key={oIndex} className="flex items-center mt-1">
                                  <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={option.label}
                                    checked={answers[question.id] === option.label}
                                    onChange={(e) =>
                                      handleRadioAnswerChange(question.id, e.target.value)
                                    }
                                    className="mr-2"
                                  />
                                  <label className="text-gray-800 dark:text-gray-100">
                                    {option.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          ) : question.type === "multipleSelect" && question.options ? (
                            <div className="mt-2">
                              {question.options.map((option, oIndex) => (
                                <div key={oIndex} className="flex items-center mt-1">
                                  <input
                                    type="checkbox"
                                    name={`question-${question.id}`}
                                    value={option.label}
                                    checked={
                                      answers[question.id] &&
                                      answers[question.id].includes(option.label)
                                    }
                                    onChange={() =>
                                      handleCheckboxAnswerChange(question.id, option.label)
                                    }
                                    className="mr-2"
                                  />
                                  <label className="text-gray-800 dark:text-gray-100">
                                    {option.label}
                                  </label>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2">
                              <input
                                type="text"
                                name={`question-${question.id}`}
                                value={answers[question.id] || ""}
                                onChange={(e) =>
                                  handleTextAnswerChange(question.id, e.target.value)
                                }
                                className="w-full p-2 border border-gray-300 rounded-lg"
                                placeholder="Your answer"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Display ending text if available */}
                      {selectedSection.endingText && (
                        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded">
                          <p className="text-gray-800 dark:text-gray-100">
                            {selectedSection.endingText}
                          </p>
                        </div>
                      )}
                      <button
                        type="submit"
                        className="px-4 py-2 bg-green-600 text-white rounded-lg"
                      >
                        {existingSubmission ? "Save" : "Submit Answers"}
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <p className="text-gray-500 dark:text-gray-300">
                  No questions in this section.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-64 text-gray-400 dark:border-gray-700 dark:bg-gray-800">
              Select a section to take the quiz
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
