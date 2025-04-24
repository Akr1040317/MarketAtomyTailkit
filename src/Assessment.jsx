import { useState, useEffect } from "react";
import { collection, doc, getDocs, query, orderBy, updateDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export default function Assessment() {
  const [mobileSideContentOpen, setMobileSideContentOpen] = useState(false);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [editingSection, setEditingSection] = useState(null);

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
    setMobileSideContentOpen(false); // Close sidebar on mobile
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-white shadow-lg p-6 sticky top-0 z-10 rounded-2xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Admin: Business Health Check Assessment
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
          className={`w-full lg:w-80 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 transition-all duration-300 ${
            mobileSideContentOpen ? "block" : "hidden lg:block"
          }`}
        >
          <h2 className="text-xl font-semibold text-white mb-4">Assessment Sections</h2>
          <div className="space-y-3">
            {sections.length > 0 ? (
              sections.map((section) => {
                const isActive = selectedSection?.id === section.id;
                return (
                  <div
                    key={section.id}
                    onClick={() => handleSectionClick(section)}
                    className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                      isActive
                        ? "bg-emerald-500/20 border-emerald-500 border"
                        : "bg-gray-700/50 border-gray-600 border"
                    } hover:bg-gray-600/70`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium text-white">{section.title}</h3>
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
          {/* Add Section Button */}
          <button
            type="button"
            className="mt-6 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors w-full"
          >
            Add Section
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-white rounded-2xl shadow-xl p-8">
          {selectedSection && editingSection ? (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="flex justify-between items-center">
                <input
                  type="text"
                  value={editingSection.title || ""}
                  onChange={(e) => handleSectionTitleChange(e.target.value)}
                  className="text-2xl font-bold text-gray-900 tracking-tight border-b border-gray-200 focus:border-emerald-500 outline-none w-full max-w-md"
                />
                <button
                  onClick={handleSaveSection}
                  className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                >
                  Save Section
                </button>
              </div>

              {/* Beginning Text */}
              <div>
                <label className="block text-gray-600 font-medium mb-2">Beginning Text</label>
                <input
                  type="text"
                  value={editingSection.beginningText || ""}
                  onChange={(e) => handleBeginningTextChange(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500"
                />
              </div>

              {/* Ending Text */}
              <div>
                <label className="block text-gray-600 font-medium mb-2">Ending Text</label>
                <input
                  type="text"
                  value={editingSection.endingText || ""}
                  onChange={(e) => handleEndingTextChange(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500"
                />
              </div>

              {editingSection.questions && editingSection.questions.length > 0 ? (
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  {editingSection.questions.map((question, qIndex) => (
                    <div
                      key={question.id || qIndex}
                      className="p-6 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-semibold text-gray-900">
                          Question {qIndex + 1} (ID: {question.id})
                        </p>
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

                      {/* Question Text */}
                      <input
                        type="text"
                        value={question.text}
                        onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500 mb-3"
                        placeholder="Enter question text"
                      />

                      {/* Question Type */}
                      <select
                        value={question.type}
                        onChange={(e) => handleQuestionTypeChange(qIndex, e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500 mb-3"
                      >
                        <option value="multipleChoice">Multiple Choice</option>
                        <option value="multipleSelect">Multiple Select</option>
                        <option value="text">Text</option>
                        <option value="other">Other</option>
                      </select>

                      {/* Options */}
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
                                    className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500"
                                    placeholder="Option label"
                                  />
                                  <input
                                    type="number"
                                    value={option.weight ?? ""}
                                    onChange={(e) =>
                                      handleOptionChange(qIndex, oIndex, "weight", e.target.value)
                                    }
                                    className="w-20 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500"
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
                  ))}
                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={handleAddNewQuestion}
                      className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                      Add New Question
                    </button>
                  </div>
                </form>
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
                <h3 className="text-xl font-semibold text-gray-900">
                  Admin: Manage BHC Assessment
                </h3>
                <p className="mt-2 text-gray-600">
                  Select a section from the sidebar to edit its details.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}