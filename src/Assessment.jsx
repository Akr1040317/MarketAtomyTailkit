import { useState, useEffect } from "react";
import { collection, doc, getDocs, query, orderBy, updateDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export default function Assessment() {
  // State for toggling mobile side content
  const [mobileSideContentOpen, setMobileSideContentOpen] = useState(false);
  // State for storing sections fetched from Firestore
  const [sections, setSections] = useState([]);
  // State for the currently selected section (from the left list)
  const [selectedSection, setSelectedSection] = useState(null);
  // A copy of the selected section used for editing (so we can modify data in the UI)
  const [editingSection, setEditingSection] = useState(null);

  useEffect(() => {
    async function fetchSections() {
      try {
        // Query the BHC_Assessment collection, ordering by the "order" field
        const q = query(collection(db, "BHC_Assessment"), orderBy("order"));
        const querySnapshot = await getDocs(q);

        // Convert each document into an object with { id, ...data }
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

  /**
   * Helper: Recalculate question IDs using the section order.
   * Format: q{sectionOrder}{letter} where letter = a, b, c, etc.
   */
  const updateQuestionIds = (questions) => {
    const sectionOrder = editingSection.order || 0;
    return questions.map((question, i) => ({
      ...question,
      id: `q${sectionOrder}${String.fromCharCode(97 + i)}`,
    }));
  };

  /**
   * When a section is clicked, set it as selected,
   * and make a copy of it for editing.
   */
  const handleSectionClick = (section) => {
    setSelectedSection(section);
    // Make a deep copy of the section so we can edit safely
    setEditingSection(JSON.parse(JSON.stringify(section)));
  };

  /**
   * Handle changes to the section's title.
   */
  const handleSectionTitleChange = (newTitle) => {
    setEditingSection((prev) => ({
      ...prev,
      title: newTitle,
    }));
  };

  /**
   * Handle changes to a question's text.
   */
  const handleQuestionTextChange = (questionIndex, newText) => {
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[questionIndex].text = newText;
      return { ...prev, questions: updatedQuestions };
    });
  };

  /**
   * Handle changes to a question's type.
   */
  const handleQuestionTypeChange = (questionIndex, newType) => {
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      updatedQuestions[questionIndex].type = newType;
      // If the new type is not multipleChoice or multipleSelect, clear options.
      if (newType !== "multipleChoice" && newType !== "multipleSelect") {
        updatedQuestions[questionIndex].options = [];
      }
      return { ...prev, questions: updatedQuestions };
    });
  };

  /**
   * Handle changes to a question option's label or weight.
   */
  const handleOptionChange = (questionIndex, optionIndex, field, newValue) => {
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      const updatedOptions = [...updatedQuestions[questionIndex].options];
      updatedOptions[optionIndex][field] = newValue;
      updatedQuestions[questionIndex].options = updatedOptions;
      return { ...prev, questions: updatedQuestions };
    });
  };

  /**
   * Add a new option to a question.
   */
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

  /**
   * Delete an option from a question.
   */
  const handleDeleteOption = (questionIndex, optionIndex) => {
    setEditingSection((prev) => {
      const updatedQuestions = [...prev.questions];
      if (updatedQuestions[questionIndex].options) {
        updatedQuestions[questionIndex].options = updatedQuestions[questionIndex].options.filter(
          (_, idx) => idx !== optionIndex
        );
      }
      return { ...prev, questions: updatedQuestions };
    });
  };

  /**
   * Add a new question to the section.
   * The new question's id is generated as "q{sectionOrder}{letter}".
   */
  const handleAddNewQuestion = () => {
    setEditingSection((prev) => {
      const newIndex = prev.questions ? prev.questions.length : 0;
      const sectionOrder = prev.order || 0;
      const newLetter = String.fromCharCode(97 + newIndex); // 'a', 'b', 'c', etc.
      const newId = `q${sectionOrder}${newLetter}`;
      const newQuestion = {
        id: newId,
        text: "",
        type: "multipleChoice", // default type; can be changed by the user
        options: [],
      };
      const updatedQuestions = [...(prev.questions || []), newQuestion];
      return { ...prev, questions: updateQuestionIds(updatedQuestions) };
    });
  };

  /**
   * Delete an entire question.
   */
  const handleDeleteQuestion = (questionIndex) => {
    setEditingSection((prev) => {
      const updatedQuestions = prev.questions.filter((_, index) => index !== questionIndex);
      return { ...prev, questions: updateQuestionIds(updatedQuestions) };
    });
  };

  /**
   * Move a question up in the order.
   */
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

  /**
   * Move a question down in the order.
   */
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

  /**
   * Save the edited section to Firestore.
   */
  const handleSaveSection = async () => {
    if (!editingSection || !editingSection.id) return;
    try {
      // Reference the document in Firestore
      const docRef = doc(db, "BHC_Assessment", editingSection.id);

      // Update the Firestore doc with the new data
      await updateDoc(docRef, {
        title: editingSection.title,
        order: editingSection.order || 0,
        questions: editingSection.questions,
      });

      // Update our local sections array so the UI on the left also reflects changes
      setSections((prevSections) =>
        prevSections.map((sec) =>
          sec.id === editingSection.id ? editingSection : sec
        )
      );

      // Update the "selectedSection" with the newly saved data
      setSelectedSection(editingSection);

      alert("Section saved successfully!");
    } catch (error) {
      console.error("Error saving section:", error);
      alert("Error saving section. Check console for details.");
    }
  };

  return (
    <>
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
      <div className="flex max-w-full flex-auto flex-col lg:flex-row">
        {/* Left Side Content: Scrollable view with section cards */}
        <div
          className={`w-full flex-none p-4 lg:w-80 lg:p-8 xl:w-96 dark:bg-gray-800/25 ${
            mobileSideContentOpen ? "" : "hidden"
          } lg:block`}
        >
          {/* Top Bar with "Sections" title and "Add Section" button */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-100">Sections</h2>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:border-gray-300 hover:text-gray-900 hover:shadow-xs focus:ring-3 focus:ring-gray-300/25 active:border-gray-200 active:shadow-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:focus:ring-gray-600/40 dark:active:border-gray-700"
            >
              Add Section
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
            {sections.length > 0 ? (
              sections.map((section) => (
                <div
                  key={section.id}
                  onClick={() => handleSectionClick(section)}
                  className={`w-full bg-white dark:bg-gray-700 rounded-lg shadow p-4 mb-4 cursor-pointer ${
                    selectedSection && selectedSection.id === section.id
                      ? "border-2 border-blue-500"
                      : "border border-gray-200 dark:border-gray-600"
                  }`}
                >
                  <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    {section.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-300">
                    {section.questions ? section.questions.length : 0} questions
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-300">No sections found</p>
            )}
          </div>
        </div>

        {/* Main Content: Editing the selected section */}
        <div className="mx-auto flex w-full max-w-10xl grow flex-col p-4 lg:p-8">
          {selectedSection ? (
            editingSection ? (
              <div>
                {/* Edit the section title */}
                <div className="mb-4">
                  <label
                    className="block text-gray-100 font-bold mb-2"
                    htmlFor="sectionTitle"
                  >
                    Section Title
                  </label>
                  <input
                    id="sectionTitle"
                    type="text"
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800"
                    value={editingSection.title || ""}
                    onChange={(e) => handleSectionTitleChange(e.target.value)}
                  />
                </div>

                {editingSection.questions && editingSection.questions.length > 0 ? (
                  <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                    {editingSection.questions.map((question, qIndex) => (
                      <div
                        key={question.id || qIndex}
                        className="p-4 bg-white dark:bg-gray-700 rounded-lg shadow"
                      >
                        <div className="flex items-center justify-between mb-2">
                          {/* Display question number */}
                          <p className="font-bold text-gray-800 dark:text-gray-100">
                            Question {qIndex + 1}
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
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Question Text */}
                        <label className="block mb-1 font-semibold text-gray-800 dark:text-gray-100">
                          Question Text:
                        </label>
                        <input
                          type="text"
                          value={question.text}
                          onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                          className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 mb-3"
                        />

                        {/* Question Type */}
                        <label className="block mb-1 font-semibold text-gray-800 dark:text-gray-100">
                          Question Type:
                        </label>
                        <select
                          value={question.type}
                          onChange={(e) => handleQuestionTypeChange(qIndex, e.target.value)}
                          className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 mb-3"
                        >
                          <option value="multipleChoice">multipleChoice</option>
                          <option value="multipleSelect">multipleSelect</option>
                          <option value="text">text</option>
                          <option value="other">other</option>
                        </select>

                        {/* Options: Only for multipleChoice or multipleSelect */}
                        {(question.type === "multipleChoice" || question.type === "multipleSelect") && (
                          <>
                            {Array.isArray(question.options) && question.options.length > 0 && (
                              <div className="mt-3">
                                <p className="font-semibold text-gray-800 dark:text-gray-100">
                                  Options:
                                </p>
                                {question.options.map((option, oIndex) => (
                                  <div key={oIndex} className="mt-2 pl-4 border-l border-gray-400">
                                    {/* Option Label */}
                                    <label className="block text-sm text-gray-800 dark:text-gray-100">
                                      Label:
                                    </label>
                                    <input
                                      type="text"
                                      value={option.label}
                                      onChange={(e) =>
                                        handleOptionChange(qIndex, oIndex, "label", e.target.value)
                                      }
                                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 mb-2"
                                    />

                                    {/* Option Weight */}
                                    <label className="block text-sm text-gray-800 dark:text-gray-100">
                                      Weight:
                                    </label>
                                    <input
                                      type="number"
                                      value={option.weight ?? ""}
                                      onChange={(e) =>
                                        handleOptionChange(qIndex, oIndex, "weight", e.target.value)
                                      }
                                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOption(qIndex, oIndex)}
                                      className="mt-1 text-red-600 hover:text-red-900 text-sm"
                                    >
                                      Delete Option
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAddOption(qIndex)}
                              className="mt-2 px-3 py-1 bg-green-600 text-white rounded"
                            >
                              Add Option
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddNewQuestion}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg"
                    >
                      Add New Question
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSection}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                      Save Section Changes
                    </button>
                  </form>
                ) : (
                  <p className="text-gray-500 dark:text-gray-300">
                    No questions in this section.
                  </p>
                )}
              </div>
            ) : (
              <p>Loading section...</p>
            )
          ) : (
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-64 text-gray-400 dark:border-gray-700 dark:bg-gray-800">
              Select a section to view the assessment
            </div>
          )}
        </div>
      </div>
    </>
  );
}
