import { useState, useEffect } from "react";
import { collection, doc, getDocs, query, orderBy, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import AssessmentUser from "../../AssessmentUser";

export default function AssessmentManagement() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [questionAnalytics, setQuestionAnalytics] = useState({});
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [mobileSideContentOpen, setMobileSideContentOpen] = useState(false);

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    if (selectedSection) {
      fetchQuestionAnalytics(selectedSection.id);
    }
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
        setSelectedSection(sectionsData[0]);
        const sectionWithExtras = {
          beginningText: "",
          endingText: "",
          ...sectionsData[0],
        };
        setEditingSection(JSON.parse(JSON.stringify(sectionWithExtras)));
      }
    } catch (error) {
      console.error("Error fetching sections: ", error);
    }
  }

  async function fetchQuestionAnalytics(sectionId) {
    try {
      setLoadingAnalytics(true);
      // Fetch all section results for this section
      const sectionResultsQuery = query(
        collection(db, "sectionResults")
      );
      const sectionResultsSnapshot = await getDocs(sectionResultsQuery);
      
      // Get the section to match by title
      const sectionDoc = await getDoc(doc(db, "BHC_Assessment", sectionId));
      if (!sectionDoc.exists()) return;
      
      const sectionData = sectionDoc.data();
      const sectionTitle = sectionData.title;
      
      // Filter results for this section
      const relevantResults = sectionResultsSnapshot.docs
        .map(doc => doc.data())
        .filter(result => result.sectionName === sectionTitle);
      
      // Calculate analytics for each question
      const analytics = {};
      
      if (sectionData.questions) {
        sectionData.questions.forEach((question, qIndex) => {
          const questionId = question.id;
          let totalAnswers = 0;
          let totalWeight = 0;
          const answerCounts = {};
          
          relevantResults.forEach(result => {
            if (result.answers && result.answers[questionId]) {
              totalAnswers++;
              const answerData = result.answers[questionId];
              
              if (question.type === 'multipleChoice') {
                const answer = answerData.answer;
                answerCounts[answer] = (answerCounts[answer] || 0) + 1;
                totalWeight += answerData.weight || 0;
              } else if (question.type === 'multipleSelect' && Array.isArray(answerData)) {
                answerData.forEach(item => {
                  const answer = item.answer;
                  answerCounts[answer] = (answerCounts[answer] || 0) + 1;
                  totalWeight += item.weight || 0;
                });
              }
            }
          });
          
          const completionRate = relevantResults.length > 0 
            ? Math.round((totalAnswers / relevantResults.length) * 100)
            : 0;
          const averageWeight = totalAnswers > 0 ? totalWeight / totalAnswers : 0;
          
          // Find most common answer
          let mostCommonAnswer = null;
          let maxCount = 0;
          Object.entries(answerCounts).forEach(([answer, count]) => {
            if (count > maxCount) {
              maxCount = count;
              mostCommonAnswer = answer;
            }
          });
          
          analytics[questionId] = {
            completionRate,
            averageWeight: Math.round(averageWeight * 10) / 10,
            totalAnswers,
            mostCommonAnswer,
            answerDistribution: answerCounts
          };
        });
      }
      
      setQuestionAnalytics(analytics);
    } catch (error) {
      console.error("Error fetching question analytics:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  const updateQuestionIds = (questions) => {
    const sectionOrder = editingSection.order || 0;
    return questions.map((question, i) => ({
      ...question,
      id: `q${sectionOrder}${String.fromCharCode(97 + i)}`,
    }));
  };

  const handleSectionClick = (section) => {
    setSelectedSection(section);
    const sectionWithExtras = {
      beginningText: "",
      endingText: "",
      ...section,
    };
    setEditingSection(JSON.parse(JSON.stringify(sectionWithExtras)));
    setMobileSideContentOpen(false);
  };

  const handleSectionTitleChange = (newTitle) => {
    setEditingSection((prev) => ({ ...prev, title: newTitle }));
  };

  const handleBeginningTextChange = (newText) => {
    setEditingSection((prev) => ({ ...prev, beginningText: newText }));
  };

  const handleEndingTextChange = (newText) => {
    setEditingSection((prev) => ({ ...prev, endingText: newText }));
  };

  const handleQuestionTextChange = (questionIndex, newText) => {
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[questionIndex].text = newText;
      return { ...prev, questions: updatedQuestions };
    });
  };

  const handleQuestionTypeChange = (questionIndex, newType) => {
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[questionIndex].type = newType;
      if (newType !== "multipleChoice" && newType !== "multipleSelect") {
        updatedQuestions[questionIndex].options = [];
      }
      return { ...prev, questions: updatedQuestions };
    });
  };

  const handleOptionChange = (questionIndex, optionIndex, field, newValue) => {
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      const updatedOptions = [...updatedQuestions[questionIndex].options];
      updatedOptions[optionIndex][field] = newValue;
      updatedQuestions[questionIndex].options = updatedOptions;
      return { ...prev, questions: updatedQuestions };
    });
  };

  const handleAddOption = (questionIndex) => {
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      if (!updatedQuestions[questionIndex].options) {
        updatedQuestions[questionIndex].options = [];
      }
      updatedQuestions[questionIndex].options.push({ label: "", weight: 0 });
      return { ...prev, questions: updatedQuestions };
    });
  };

  const handleDeleteOption = (questionIndex, optionIndex) => {
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[questionIndex].options = updatedQuestions[questionIndex].options.filter(
        (_, idx) => idx !== optionIndex
      );
      return { ...prev, questions: updatedQuestions };
    });
  };

  const handleAddNewQuestion = () => {
    setEditingSection((prev) => {
      const newIndex = prev.questions ? prev.questions.length : 0;
      const sectionOrder = prev.order || 0;
      const newLetter = String.fromCharCode(97 + newIndex);
      const newId = `q${sectionOrder}${newLetter}`;
      const newQuestion = {
        id: newId,
        text: "",
        type: "multipleChoice",
        options: [],
      };
      const updatedQuestions = [...(prev.questions || []), newQuestion];
      return { ...prev, questions: updateQuestionIds(updatedQuestions) };
    });
  };

  const handleDeleteQuestion = (questionIndex) => {
    setEditingSection((prev) => {
      const updatedQuestions = prev.questions.filter((_, index) => index !== questionIndex);
      return { ...prev, questions: updateQuestionIds(updatedQuestions) };
    });
  };

  const handleMoveQuestionUp = (qIndex) => {
    if (qIndex <= 0) return;
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      const temp = updatedQuestions[qIndex - 1];
      updatedQuestions[qIndex - 1] = updatedQuestions[qIndex];
      updatedQuestions[qIndex] = temp;
      return { ...prev, questions: updateQuestionIds(updatedQuestions) };
    });
  };

  const handleMoveQuestionDown = (qIndex) => {
    if (qIndex >= editingSection.questions.length - 1) return;
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      const temp = updatedQuestions[qIndex + 1];
      updatedQuestions[qIndex + 1] = updatedQuestions[qIndex];
      updatedQuestions[qIndex] = temp;
      return { ...prev, questions: updateQuestionIds(updatedQuestions) };
    });
  };

  const handleSaveSection = async () => {
    if (!editingSection || !editingSection.id) return;
    try {
      const docRef = doc(db, "BHC_Assessment", editingSection.id);
      await updateDoc(docRef, {
        title: editingSection.title,
        order: editingSection.order || 0,
        beginningText: editingSection.beginningText || "",
        endingText: editingSection.endingText || "",
        questions: editingSection.questions,
      });
      setSections((prevSections) =>
        prevSections.map((sec) =>
          sec.id === editingSection.id ? editingSection : sec
        )
      );
      setSelectedSection(editingSection);
      alert("Section saved successfully!");
    } catch (error) {
      console.error("Error saving section:", error);
      alert("Error saving section. Check console for details.");
    }
  };

  if (previewMode) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Preview Mode</h2>
          <button
            onClick={() => setPreviewMode(false)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Exit Preview
          </button>
        </div>
        <AssessmentUser />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Assessment Management</h2>
          <button
            onClick={() => setPreviewMode(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            Preview Assessment
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className={`w-full lg:w-80 bg-gray-50 border-r border-gray-200 p-6 ${
          mobileSideContentOpen ? "block" : "hidden lg:block"
        }`}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assessment Sections</h3>
          <div className="space-y-2">
            {sections.length > 0 ? (
              sections.map((section) => {
                const isActive = selectedSection?.id === section.id;
                return (
                  <div
                    key={section.id}
                    onClick={() => handleSectionClick(section)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      isActive
                        ? "bg-emerald-500 text-white"
                        : "bg-white border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <div className="font-medium">{section.title}</div>
                    <div className={`text-xs mt-1 ${isActive ? "text-emerald-50" : "text-gray-500"}`}>
                      {section.questions?.length || 0} questions
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 text-sm">Loading sections...</p>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {selectedSection && editingSection ? (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="flex justify-between items-center">
                <input
                  type="text"
                  value={editingSection.title || ""}
                  onChange={(e) => handleSectionTitleChange(e.target.value)}
                  className="text-2xl font-bold text-gray-900 border-b border-gray-200 focus:border-emerald-500 outline-none w-full max-w-md"
                />
                <button
                  onClick={handleSaveSection}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Save Section
                </button>
              </div>

              {/* Beginning/Ending Text */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 font-medium mb-2">Beginning Text</label>
                  <input
                    type="text"
                    value={editingSection.beginningText || ""}
                    onChange={(e) => handleBeginningTextChange(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-2">Ending Text</label>
                  <input
                    type="text"
                    value={editingSection.endingText || ""}
                    onChange={(e) => handleEndingTextChange(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 text-gray-900 bg-white"
                  />
                </div>
              </div>

              {/* Questions */}
              {editingSection.questions && editingSection.questions.length > 0 ? (
                <div className="space-y-6">
                  {editingSection.questions.map((question, qIndex) => {
                    const analytics = questionAnalytics[question.id];
                    return (
                      <div key={question.id || qIndex} className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 mb-2">
                              Question {qIndex + 1} (ID: {question.id})
                            </p>
                            {analytics && (
                              <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm">
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <span className="text-gray-600">Completion Rate: </span>
                                    <span className="font-medium">{analytics.completionRate}%</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Avg Weight: </span>
                                    <span className="font-medium">{analytics.averageWeight}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Total Answers: </span>
                                    <span className="font-medium">{analytics.totalAnswers}</span>
                                  </div>
                                </div>
                                {analytics.mostCommonAnswer && (
                                  <div className="mt-2">
                                    <span className="text-gray-600">Most Common Answer: </span>
                                    <span className="font-medium">{analytics.mostCommonAnswer}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {loadingAnalytics && !analytics && (
                              <div className="mb-3 text-sm text-gray-500">Loading analytics...</div>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => handleMoveQuestionUp(qIndex)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Move Up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestionDown(qIndex)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Move Down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(qIndex)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Question"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={question.text}
                          onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 mb-3 text-gray-900 bg-white"
                          placeholder="Enter question text"
                        />

                        <select
                          value={question.type}
                          onChange={(e) => handleQuestionTypeChange(qIndex, e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 mb-3 text-gray-900 bg-white"
                        >
                          <option value="multipleChoice">Multiple Choice</option>
                          <option value="multipleSelect">Multiple Select</option>
                          <option value="text">Text</option>
                          <option value="other">Other</option>
                        </select>

                        {(question.type === "multipleChoice" || question.type === "multipleSelect") && (
                          <div className="space-y-3">
                            {Array.isArray(question.options) && question.options.length > 0 && (
                              <div>
                                {question.options.map((option, oIndex) => (
                                  <div
                                    key={oIndex}
                                    className="flex items-center space-x-3 mt-2 p-2 bg-white rounded-lg border border-gray-200"
                                  >
                                    <input
                                      type="text"
                                      value={option.label}
                                      onChange={(e) =>
                                        handleOptionChange(qIndex, oIndex, "label", e.target.value)
                                      }
                                      className="flex-1 p-2 border border-gray-200 rounded-lg text-gray-900 bg-white"
                                      placeholder="Option label"
                                    />
                                    <input
                                      type="number"
                                      value={option.weight ?? ""}
                                      onChange={(e) =>
                                        handleOptionChange(qIndex, oIndex, "weight", e.target.value)
                                      }
                                      className="w-20 p-2 border border-gray-200 rounded-lg text-gray-900 bg-white"
                                      placeholder="Weight"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOption(qIndex, oIndex)}
                                      className="text-red-600 hover:text-red-900"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAddOption(qIndex)}
                              className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                            >
                              Add Option
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={handleAddNewQuestion}
                      className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                      Add New Question
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No questions in this section.</p>
                  <button
                    type="button"
                    onClick={handleAddNewQuestion}
                    className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    Add New Question
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center py-16">
                <h3 className="text-xl font-semibold text-gray-900">Manage BHC Assessment</h3>
                <p className="mt-2 text-gray-600">Select a section from the sidebar to edit its details.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
